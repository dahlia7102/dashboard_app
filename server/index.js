process.on('uncaughtException', (err) => {
  console.error('Unhandled Exception:', err.message);
  console.error(err.stack);
  // process.exit(1); // Exit with a failure code
});

// --- Core Modules ---
const express = require('express');
const WebSocket = require('ws');
const cors = require('cors'); // Import cors middleware

const { exec } = require('child_process');

// --- Custom Modules ---
const { startLogWatcher } = require('./log-watcher.js');
const { startHealthChecks, linuxServers } = require('./health-checker.js'); // Import linuxServers

// --- Server and State Setup ---
const app = express();
app.use(cors()); // Enable CORS for all routes
const port = 5000;

const systemState = {
  global: {
    totalLogLines: 0,
    totalRequests: 0,
    errorCount: 0,
    lastUpdate: null,
    windowServerStatus: null,
    nginxStatus: null,
    linuxServersTotal: linuxServers.length,
    linuxServersOnline: 0,
    linuxServersOffline: 0,
    linuxServersIssues: 0,
    linuxServerDetails: [],
  },
  cameras: {},
  recentLogs: [],
  mapImageRequests: {}, // Store GetMapImageRequest data, keyed by playId
};

// --- WebSocket Management ---
const clients = new Set();
let broadcastTimeout = null;
const BROADCAST_DEBOUNCE_DELAY = 200; // milliseconds

/**
 * Broadcasts the current system state to all connected WebSocket clients.
 */
function broadcastState() {
  if (clients.size === 0) {
    return;
  }
  if (broadcastTimeout) {
    clearTimeout(broadcastTimeout);
  }
  broadcastTimeout = setTimeout(() => {
    const stateJson = JSON.stringify(systemState);
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(stateJson);
      }
    });
    console.log('System state broadcasted to clients.');
  }, BROADCAST_DEBOUNCE_DELAY);
}

// --- State Update Functions ---

/**
 * Updates the in-memory system state based on parsed log data from the watcher.
 * @param {object} logObject - An object with `type` and `data` properties.
 */
function updateStateFromLog(logObject) {
  const { type, data } = logObject;
  systemState.global.totalLogLines++;
  systemState.global.lastUpdate = data.timestamp;

  switch (type) {
    case 'findSaveRequest': {
      const camId = `${data.holeNo}/${data.cameraNo}`;

      if (!systemState.cameras[camId]) {
        systemState.cameras[camId] = {
          id: camId,
          status: 'found',
          lastActivity: null,
          requestCount: 0,
          successCount: 0,
        };
      }

      const camera = systemState.cameras[camId];
      camera.lastActivity = data.timestamp;
      camera.requestCount++;
      camera.successCount++;
      camera.status = 'found';
      
      const logEntry = {
        ...data,
        id: `${data.playId}-${data.timestamp}`, // Create a unique ID
        cameraId: camId,
        level: 'INFO',
        raw: `Ball found for PlayID ${data.playId} on camera ${camId}`,
      };

      systemState.recentLogs.push(logEntry);
      if (systemState.recentLogs.length > 50) {
        systemState.recentLogs.shift();
      }
      break;
    }

    case 'getMapImageRequest': {
      systemState.mapImageRequests[data.playId] = {
        ...data,
        imagePath: null, // Initialize imagePath
      };
      // Clean up old requests to prevent memory leak
      const requestKeys = Object.keys(systemState.mapImageRequests);
      if (requestKeys.length > 100) {
          delete systemState.mapImageRequests[requestKeys[0]]; // Delete the oldest entry
      }
      break;
    }

    case 'imagePath': {
      if (systemState.mapImageRequests[data.playId]) {
        systemState.mapImageRequests[data.playId].imagePath = data.path;
      }
      break;
    }

    default:
      console.warn(`Unknown log type received: ${type}`);
      return; // Do not broadcast if type is unknown
  }
  
  broadcastState();
}

/**
 * Updates the health status of a server in the system state (Window/Nginx).
 * This function is passed as a callback to the health checker.
 * @param {'window'|'nginx'} serverName - The name of the server.
 * @param {'active'|'error'} status - The new status.
 */
function updateHttpHealthStatus(serverName, status) { // Renamed for clarity
    const statusProp = serverName === 'window' ? 'windowServerStatus' : 'nginxStatus';
    if (systemState.global[statusProp] !== status) {
        systemState.global[statusProp] = status;
        console.log(`HTTP Health status updated: ${serverName}=${status}`);
        broadcastState();
    }
}

/**
 * Updates the health status of Linux servers in the system state.
 * This function is passed as a callback to the health checker.
 * @param {Array<object>} linuxHealthResults - Array of { id, host, port, status } for each Linux server.
 */
function updateLinuxHealthStatus(linuxHealthResults) {
    let changed = false;
    // Check if the overall array or any individual status has changed
    // Deep comparison using JSON.stringify is simple but might be inefficient for very large arrays
    if (JSON.stringify(systemState.global.linuxServerDetails) !== JSON.stringify(linuxHealthResults)) {
        systemState.global.linuxServerDetails = linuxHealthResults; // Update detailed status

        // Calculate aggregated counts
        const onlineCount = linuxHealthResults.filter(s => s.status === 'active').length;
        const offlineCount = linuxHealthResults.filter(s => s.status === 'error').length;
        // Issues count will come from Zabbix, for now it's 0 or can be combined with offline
        const issuesCount = 0; // Placeholder for Zabbix issues

        if (systemState.global.linuxServersOnline !== onlineCount ||
            systemState.global.linuxServersOffline !== offlineCount ||
            systemState.global.linuxServersIssues !== issuesCount) {
            
            systemState.global.linuxServersOnline = onlineCount;
            systemState.global.linuxServersOffline = offlineCount;
            systemState.global.linuxServersIssues = issuesCount;
            changed = true;
        }

        changed = true; // Mark as changed if details or counts are different
    }

    if (changed) {
        console.log(`Linux server health status updated: Online=${systemState.global.linuxServersOnline}, Offline=${systemState.global.linuxServersOffline}`);
        broadcastState();
    }
}





// --- API Routes ---
app.get('/api/test', (req, res) => {
  res.json({ message: 'Hello from Node.js Express Backend!' });
});

app.get('/api/state', (req, res) => {
  res.json(systemState);
});

app.get('/api/open-folder', (req, res) => {
    const { path } = req.query;
    if (!path) {
        return res.status(400).json({ error: 'Path is required' });
    }

    const decodedPath = decodeURIComponent(path);
    
    // Security check: Ensure the path is within the expected directory
    const allowedBasePath = 'C:\\tomcat-8.5.82\\golfApp\\webapps\\images\\camera';
    if (!decodedPath.startsWith(allowedBasePath)) {
        return res.status(403).json({ error: 'Access to this path is forbidden.' });
    }

    // Replace with the correct command for your OS if not Windows
    const command = `explorer.exe "${decodedPath}"`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error opening folder: ${error.message}`);
            return res.status(500).json({ error: 'Failed to open folder.', details: error.message });
        }
        if (stderr) {
            console.warn(`Stderr while opening folder: ${stderr}`);
        }
        res.json({ message: `Successfully attempted to open folder: ${decodedPath}` });
    });
});


// --- Server Initialization ---
const server = app.listen(port, () => {
  console.log(`HTTP server listening on port ${port}`);
});

const wss = new WebSocket.Server({ server });

wss.on('connection', ws => {
  console.log('Client connected via WebSocket.');
  clients.add(ws);

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


// --- Start Background Services ---
startLogWatcher(updateStateFromLog);
startHealthChecks(updateHttpHealthStatus, updateLinuxHealthStatus); // Pass both callbacks

