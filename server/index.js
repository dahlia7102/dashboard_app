const express = require('express');
const app = express();
const port = 5000; // HTTP and WebSocket server will share this port

const chokidar = require('chokidar');
const fs = require('fs');
const WebSocket = require('ws'); // Import WebSocket library

/**
 * Parses a log line to extract structured data.
 * @param {string} line - The log line to parse.
 * @returns {object|null} - A structured log object, or null if parsing fails.
 */
function parseLogLine(line) {
  const primaryRegex = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})\s+-\s+([A-Z]+)\s+\d+\s+\[([^\]]+)\]\s+([^\s]+)\s+:\s+(.*)$/;
  const match = line.match(primaryRegex);

  if (!match) {
    // Handle special block headers
    if (line.includes('////////////')) {
      const playIdMatch = line.match(/PlayId\s*:\s*(\S+)/);
      if (playIdMatch) {
        return { type: 'block_start', playId: playIdMatch[1], raw: line };
      }
    }
    return null; // Or return a basic object with the raw line
  }

  const [, timestamp, level, thread, logger, message] = match;
  const logObject = { timestamp, level, thread, logger, message, raw: line };

  // Secondary regexes for specific details
  const ipRegex = /Login Success \[ ([\d\.]+) \]|Login fail DeviceIp\[([\d\.]+)\]/;
  const ipMatch = message.match(ipRegex);
  if (ipMatch) {
    logObject.ip = ipMatch[1] || ipMatch[2];
  }
  
  const processingTimeRegex = /(\d+ms|\d+\.\d+sec)/g;
  const timeMatches = message.match(processingTimeRegex);
  if (timeMatches) {
      logObject.processingTimes = timeMatches;
  }

  const urlRegex = /동영상저장: (http:.*\.dav)|HTTP Snapshot 저장 성공: (C:.*\.jpg)/;
  const urlMatch = message.match(urlRegex);
  if (urlMatch) {
    logObject.url = urlMatch[1] || urlMatch[2];
  }

  const cameraIdRegex = /\[(\d+\/\d+)\]/;
  const cameraIdMatch = message.match(cameraIdRegex);
  if (cameraIdMatch) {
    logObject.cameraId = cameraIdMatch[1];
  }
  
  const playIdRegex = /PlayId\s*:\s*(\S+)/;
  const playIdMatch = message.match(playIdRegex);
  if(playIdMatch){
    logObject.playId = playIdMatch[1];
  }

  return logObject;
}

const systemState = {
  global: {
    totalLogLines: 0,
    totalRequests: 0, // Placeholder for actual requests
    errorCount: 0,
    lastUpdate: null,
  },
  // 'cameras' will map to the '25 Linux servers' concept, using cameraId from logs
  cameras: {}, // Key: cameraId (e.g., '9/1'), Value: { status, lastActivity, ip, processingTimes, avgProcessingTime }
};

// WebSocket clients
const clients = new Set();

/**
 * Broadcasts the current system state to all connected WebSocket clients.
 */
function broadcastState() {
  if (clients.size === 0) {
    // console.log("No WebSocket clients connected to broadcast state.");
    return;
  }
  const stateJson = JSON.stringify(systemState);
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(stateJson);
    }
  });
  // console.log(`Broadcasted state to ${clients.size} clients.`);
}


/**
 * Updates the in-memory system state based on a parsed log line.
 * @param {object} parsedLog - The structured log object.
 */
function updateState(parsedLog) {
  systemState.global.totalLogLines++;
  systemState.global.lastUpdate = new Date().toISOString();

  if (parsedLog.level === 'ERROR') {
    systemState.global.errorCount++;
  }

  // Update camera-specific state
  if (parsedLog.cameraId) {
    const camId = parsedLog.cameraId;
    if (!systemState.cameras[camId]) {
      systemState.cameras[camId] = {
        id: camId,
        status: 'idle', // Default status
        lastActivity: null,
        ip: null,
        processingTimes: [], // Store last few processing times
        averageProcessingTime: 0,
        requestCount: 0,
        errorCount: 0,
      };
    }

    const camera = systemState.cameras[camId];
    camera.lastActivity = parsedLog.timestamp; // Use log timestamp for activity
    camera.requestCount++;

    if (parsedLog.ip) {
      camera.ip = parsedLog.ip;
    }

    if (parsedLog.level === 'ERROR') {
      camera.status = 'error';
      camera.errorCount++;
    } else if (parsedLog.message.includes('Login Success')) {
      camera.status = 'idle'; // Assuming success means it's ready/idle
    } else if (parsedLog.message.includes('spending') || parsedLog.message.includes('spend for') || parsedLog.message.includes('delaying')) {
        // More sophisticated logic needed to determine 'analyzing'
        // For now, any processing log suggests activity
        camera.status = 'analyzing';
    }


    if (parsedLog.processingTimes && parsedLog.processingTimes.length > 0) {
      // Convert 'ms' or 'sec' to milliseconds and add to array
      parsedLog.processingTimes.forEach(timeStr => {
        let value;
        if (timeStr.endsWith('ms')) {
          value = parseFloat(timeStr);
        } else if (timeStr.endsWith('sec')) {
          value = parseFloat(timeStr) * 1000;
        }
        if (typeof value === 'number' && !isNaN(value)) {
          camera.processingTimes.push(value);
          // Keep only the last N values
          if (camera.processingTimes.length > 10) { // Keep last 10
            camera.processingTimes.shift();
          }
          // Recalculate average
          const sum = camera.processingTimes.reduce((a, b) => a + b, 0);
          camera.averageProcessingTime = sum / camera.processingTimes.length;
        }
      });
    }
  }

  // For debugging, print the state of the camera that was just updated
  if(parsedLog.cameraId && systemState.cameras[parsedLog.cameraId]) {
    console.log("Updated Camera State:", JSON.stringify(systemState.cameras[parsedLog.cameraId], null, 2));
  }
  
  // Broadcast state after update
  broadcastState();
}


// --- Chokidar Implementation ---

// Define the path to the Spring Boot Access Log file
const logFilePath = 'C:\\tomcat-8.5.82\\golfApp\\webapps\\logs\\AegaServerLog.log';

// Variable to keep track of the last read size of the file
let lastReadSize = 0;
try {
    const stats = fs.statSync(logFilePath);
    lastReadSize = stats.size;
    console.log(`Log file found. Initial size: ${lastReadSize}. Watching for new changes.`);
} catch (error) {
    console.error(`Error getting initial log file stats for ${logFilePath}: ${error.message}`);
    console.error("The file may not exist yet. The watcher will still try to monitor the path.");
}

// Initialize chokidar watcher
const watcher = chokidar.watch(logFilePath, {
  persistent: true,
  usePolling: true, // Important for locked files on Windows and network drives
  interval: 1000,   // Poll every 1 second
});

// Function to process new log data from a file path
const processNewData = (path) => {
    try {
        const stats = fs.statSync(path);
        const newSize = stats.size;

        if (newSize < lastReadSize) {
            console.log("Log file truncated. Resetting read position.");
            lastReadSize = 0;
        }
        
        if (newSize > lastReadSize) {
            const stream = fs.createReadStream(path, { start: lastReadSize, end: newSize, encoding: 'utf8' });
            let data = '';
            stream.on('data', (chunk) => {
                data += chunk;
            });
            stream.on('end', () => {
                const newLines = data.split(/\r?\n/);
                newLines.forEach(line => {
                    if (line) { // Process only non-empty lines
                        const parsedLog = parseLogLine(line);
                        if (parsedLog) {
                            updateState(parsedLog);
                        }
                    }
                });
                lastReadSize = newSize;
            });
            stream.on('error', (err) => {
                console.error("Read stream error:", err);
            });
        }
    } catch(error) {
        console.error(`Error processing file change for ${path}:`, error.message);
    }
};

// Add chokidar event listeners
console.log(`Setting up watcher for ${logFilePath}...`);
watcher
  .on('add', path => {
    console.log(`File ${path} has been added. Starting to process.`);
    processNewData(path);
  })
  .on('change', path => {
    processNewData(path);
  })
  .on('error', error => console.error(`Watcher error: ${error}`))
  .on('ready', () => console.log('Initial scan complete. Ready for changes.'));

// --- End of Chokidar Implementation ---


app.get('/api/test', (req, res) => {
  res.json({ message: 'Hello from Node.js Express Backend!' });
});

app.get('/api/state', (req, res) => {
  res.json(systemState);
});

const server = app.listen(port, () => {
  console.log(`HTTP server listening on port ${port}`);
});

// Create WebSocket server, integrated with the HTTP server
const wss = new WebSocket.Server({ server });

wss.on('connection', ws => {
  console.log('Client connected via WebSocket.');
  clients.add(ws);

  // Send initial state to the new client
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(systemState));
  }

  ws.on('close', () => {
    console.log('Client disconnected from WebSocket.');
    clients.delete(ws);
  });

  ws.on('error', error => {
    console.error('WebSocket error:', error);
  });
});

console.log(`WebSocket server integrated with HTTP server on port ${port}`);
