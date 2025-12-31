process.on('uncaughtException', (err) => {
  console.error('Unhandled Exception:', err.message);
  console.error(err.stack);
  // process.exit(1); // Exit with a failure code
});

// --- Core Modules ---
const express = require('express');
const WebSocket = require('ws');
const cors = require('cors'); // Import cors middleware

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
    // Linux Server Health Status
    linuxServersTotal: linuxServers.length, // Total number of Linux servers
    linuxServersOnline: 0, // Count of online servers
    linuxServersOffline: 0, // Count of offline servers
    linuxServersIssues: 0, // Count of servers with Zabbix issues (future)
    linuxServerDetails: [], // Detailed status for each Linux server
  },
  cameras: {}, // Existing camera data (from log parsing)
  kpiData: [],
  recentLogs: [],
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
    // console.log('System state broadcasted to clients.'); // Uncomment for debugging
  }, BROADCAST_DEBOUNCE_DELAY);
}

// --- State Update Functions ---

/**
 * Updates the in-memory system state based on a parsed 'FindSaveRequest' block.
 * This function is passed as a callback to the log watcher.
 * @param {object} ballFindData - The structured data from a successful ball find log.
 */
function updateStateFromLog(ballFindData) {
  systemState.global.totalLogLines++;
  systemState.global.lastUpdate = ballFindData.timestamp;

  const camId = `${ballFindData.holeNo}/${ballFindData.cameraNo}`;

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
  camera.lastActivity = ballFindData.timestamp;
  camera.requestCount++;
  camera.successCount++;
  camera.status = 'found';
  
  const logEntry = {
    ...ballFindData,
    cameraId: camId,
    level: 'INFO',
    raw: `Ball found for PlayID ${ballFindData.playId} on camera ${camId}`,
  };

  systemState.recentLogs.unshift(logEntry); // Add to the beginning of the array
  if (systemState.recentLogs.length > 50) {
    systemState.recentLogs.pop(); // Remove from the end
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


// --- KPI Aggregation ---
setInterval(() => {
    let totalRequestsAcrossCameras = 0;
    Object.values(systemState.cameras).forEach(camera => {
        totalRequestsAcrossCameras += camera.requestCount;
    });

    const currentHourMinute = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    
    systemState.kpiData.push({
        name: currentHourMinute,
        hourlyRequests: totalRequestsAcrossCameras,
        avgProcessingTime: 0,
    });

    if (systemState.kpiData.length > 60) {
        systemState.kpiData.shift();
    }
    broadcastState();
}, 60 * 1000);


// --- API Routes ---
app.get('/api/test', (req, res) => {
  res.json({ message: 'Hello from Node.js Express Backend!' });
});

app.get('/api/state', (req, res) => {
  res.json(systemState);
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

