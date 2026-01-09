const http = require('http');
const net = require('net'); // Added for TCP checks

// Configurable constants
const HEALTH_CHECK_INTERVAL = 300000; // 5 minutes (changed from 10000)
const HEALTH_CHECK_TIMEOUT = 5000; // 5 seconds

// List of Linux analysis servers from nginx.conf
const linuxServers = [
    { id: 'linux01', host: '192.168.1.11', port: 7011 },
    { id: 'linux02', host: '192.168.1.12', port: 7012 },
    { id: 'linux03', host: '192.168.1.13', port: 7013 },
    { id: 'linux04', host: '192.168.1.14', port: 7014 },
    { id: 'linux05', host: '192.168.1.15', port: 7015 },
    { id: 'linux06', host: '192.168.1.16', port: 7016 },
    { id: 'linux07', host: '192.168.1.17', port: 7017 },
    { id: 'linux08', host: '192.168.1.18', port: 7018 },
    { id: 'linux09', host: '192.168.1.19', port: 7019 },
    { id: 'linux10', host: '192.168.1.20', port: 7020 },
    { id: 'linux11', host: '192.168.1.21', port: 7021 },
    { id: 'linux12', host: '192.168.1.22', port: 7022 },
    { id: 'linux13', host: '192.168.1.23', port: 7023 },
    { id: 'linux14', host: '192.168.1.24', port: 7024 },
    { id: 'linux15', host: '192.168.1.25', port: 7025 },
    { id: 'linux16', host: '192.168.1.26', port: 7026 },
    { id: 'linux17', host: '192.168.1.27', port: 7027 },
    { id: 'linux18', host: '192.168.1.28', port: 7028 },
    { id: 'linux19', host: '192.168.1.29', port: 7029 },
    { id: 'linux20', host: '192.168.1.30', port: 7030 },
    { id: 'linux21', host: '192.168.1.31', port: 7031 },
    { id: 'linux22', host: '192.168.1.32', port: 7032 },
    { id: 'linux23', host: '192.168.1.33', port: 7033 },
    { id: 'linux24', host: '192.168.1.34', port: 7034 },
    { id: 'linux25', host: '192.168.1.35', port: 7035 },
];


/**
 * Performs a GET request to a URL to check its HTTP health.
 * @param {string} url - The URL to check.
 * @returns {Promise<'active'|'error'>} - A promise that resolves to the server status.
 */
function checkHttpHealth(url) {
  return new Promise((resolve) => {
    const request = http.get(url, { timeout: HEALTH_CHECK_TIMEOUT }, (res) => {
      // --- START DEBUG LOGGING ---
      console.log(`[DEBUG] HTTP Check for ${url} received status code: ${res.statusCode}`);
      // --- END DEBUG LOGGING ---
      
      if (res.statusCode >= 200 && res.statusCode < 400) {
        resolve('active');
      } else {
        // HTTP status code indicates an error or redirect that we don't consider active
        resolve('error');
      }
      res.resume();
    });

    request.on('error', (err) => {
      // --- START DEBUG LOGGING ---
      console.error(`[DEBUG] HTTP Check for ${url} failed with error: ${err.message}`);
      // --- END DEBUG LOGGING ---
      resolve('error');
    });

    request.on('timeout', () => {
      request.destroy();
      console.error(`HTTP health check timeout for ${url}`);
      resolve('error');
    });
  });
}

/**
 * Performs a TCP connection check to a host and port.
 * @param {string} host - The IP address or hostname.
 * @param {number} port - The port number.
 * @returns {Promise<'active'|'error'>} - A promise that resolves to the server status.
 */
function checkTcpHealth(host, port) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        let connected = false;

        socket.setTimeout(HEALTH_CHECK_TIMEOUT);

        socket.connect(port, host, () => {
            connected = true;
            socket.destroy(); // Close the connection immediately
            console.log(`[DEBUG] TCP Check for ${host}:${port} successful.`); // Debug log
            resolve('active');
        });

        socket.on('timeout', () => {
            console.error(`[DEBUG] TCP Check for ${host}:${port} timed out after ${HEALTH_CHECK_TIMEOUT}ms.`); // Debug log
            socket.destroy();
            resolve('error');
        });

        socket.on('error', (err) => {
            if (!connected) {
                console.error(`[DEBUG] TCP Check for ${host}:${port} failed: ${err.message}`); // Debug log
            }
            socket.destroy();
            resolve('error');
        });
    });
}

/**
 * Starts the periodic health checks for all configured servers.
 * @param {function(string, 'active'|'error'): void} onHttpHealthChange - Callback for Window/Nginx HTTP health.
 * @param {function(object): void} onLinuxHealthChange - Callback for aggregated and detailed Linux server health.
 */
function startHealthChecks(onHttpHealthChange, onLinuxHealthChange) {
    const windowServerUrl = 'http://192.168.1.1:8081/noAuth/test'; // Confirmed
    const nginxUrl = 'http://192.168.1.5:7777/health'; // Confirmed

    // --- Initial Checks ---
    (async () => {
        // HTTP Checks
        onHttpHealthChange('window', await checkHttpHealth(windowServerUrl));
        onHttpHealthChange('nginx', await checkHttpHealth(nginxUrl));

        // Linux TCP Checks
        const linuxHealthResults = await Promise.all(
            linuxServers.map(async (server) => {
                const status = await checkTcpHealth(server.host, server.port);
                return { id: server.id, host: server.host, port: server.port, status: status };
            })
        );
        onLinuxHealthChange(linuxHealthResults);

    })(); // IIFE for initial async calls

    // --- Periodic HTTP Checks (Window Server, Nginx) ---
    setInterval(async () => {
        const newWindowStatus = await checkHttpHealth(windowServerUrl);
        const newNginxStatus = await checkHttpHealth(nginxUrl);
        onHttpHealthChange('window', newWindowStatus);
        onHttpHealthChange('nginx', newNginxStatus);
    }, HEALTH_CHECK_INTERVAL);

    // --- Periodic Linux Server TCP Checks ---
    setInterval(async () => {
        const linuxHealthResults = await Promise.all(
            linuxServers.map(async (server) => {
                const status = await checkTcpHealth(server.host, server.port);
                return { id: server.id, host: server.host, port: server.port, status: status };
            })
        );
        onLinuxHealthChange(linuxHealthResults);
    }, HEALTH_CHECK_INTERVAL);
}

module.exports = { startHealthChecks, linuxServers }; // Export linuxServers for index.js to use in systemState
