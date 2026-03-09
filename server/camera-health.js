const fs = require('fs');
const net = require('net');

const CHECK_INTERVAL = 60000; // 1분마다 체크
const TIMEOUT = 2000; // 2초 타임아웃
const TARGET_HOLES = [1, 3, 4, 5, 7, 8, 9]; // 3번 홀 추가, 2번 홀 제외

const manualCameraConfig = {
    1: [
        { ip: '172.16.1.110', port: 80, cameraNo: 1 }, { ip: '172.16.1.111', port: 80, cameraNo: 2 },
        { ip: '172.16.1.112', port: 80, cameraNo: 3 }, { ip: '172.16.1.113', port: 80, cameraNo: 4 },
        { ip: '172.16.1.114', port: 80, cameraNo: 5 }, { ip: '172.16.1.115', port: 80, cameraNo: 6 },
        { ip: '172.16.1.116', port: 80, cameraNo: 7 }, { ip: '172.16.1.117', port: 80, cameraNo: 8 },
        { ip: '172.16.1.118', port: 80, cameraNo: 9 }, { ip: '172.16.1.119', port: 80, cameraNo: 10 },
        { ip: '172.16.1.120', port: 80, cameraNo: 11 }, { ip: '172.16.1.121', port: 80, cameraNo: 12 },
        { ip: '172.16.1.122', port: 80, cameraNo: 13 }
    ],
    3: [
        { ip: '172.16.1.20', port: 80, cameraNo: 1 }, { ip: '172.16.1.21', port: 80, cameraNo: 2 },
        { ip: '172.16.1.22', port: 80, cameraNo: 3 }, { ip: '172.16.1.107', port: 80, cameraNo: 4 },
        { ip: '172.16.1.24', port: 80, cameraNo: 5 }, { ip: '172.16.1.25', port: 80, cameraNo: 6 },
        { ip: '172.16.1.26', port: 80, cameraNo: 7 }, { ip: '172.16.1.31', port: 80, cameraNo: 8 },
        { ip: '172.16.1.28', port: 80, cameraNo: 9 }, { ip: '172.16.1.29', port: 80, cameraNo: 10 },
        { ip: '172.16.1.30', port: 80, cameraNo: 11 }
    ],
    4: [
        { ip: '172.16.1.37', port: 80, cameraNo: 1 }, { ip: '172.16.1.38', port: 80, cameraNo: 2 },
        { ip: '172.16.1.39', port: 80, cameraNo: 3 }, { ip: '172.16.1.40', port: 80, cameraNo: 4 },
        { ip: '172.16.1.41', port: 80, cameraNo: 5 }, { ip: '172.16.1.42', port: 80, cameraNo: 6 },
        { ip: '172.16.1.43', port: 80, cameraNo: 7 }, { ip: '172.16.1.44', port: 80, cameraNo: 8 },
        { ip: '172.16.1.45', port: 80, cameraNo: 9 }, { ip: '172.16.1.46', port: 80, cameraNo: 10 }
    ],
    5: [
        { ip: '172.16.1.49', port: 80, cameraNo: 1 }, { ip: '172.16.1.50', port: 80, cameraNo: 2 },
        { ip: '172.16.1.51', port: 80, cameraNo: 3 }, { ip: '172.16.1.52', port: 80, cameraNo: 4 },
        { ip: '172.16.1.53', port: 80, cameraNo: 5 }, { ip: '172.16.1.54', port: 80, cameraNo: 6 },
        { ip: '172.16.1.55', port: 80, cameraNo: 7 }, { ip: '172.16.1.56', port: 80, cameraNo: 8 },
        { ip: '172.16.1.57', port: 80, cameraNo: 9 }, { ip: '172.16.1.58', port: 80, cameraNo: 10 },
        { ip: '172.16.1.59', port: 80, cameraNo: 11 }, { ip: '172.16.1.60', port: 80, cameraNo: 12 },
        { ip: '172.16.1.61', port: 80, cameraNo: 13 }
    ],
    7: [
        { ip: '172.16.1.64', port: 80, cameraNo: 1 }, { ip: '172.16.1.65', port: 80, cameraNo: 2 },
        { ip: '172.16.1.66', port: 80, cameraNo: 3 }, { ip: '172.16.1.67', port: 80, cameraNo: 4 },
        { ip: '172.16.1.68', port: 80, cameraNo: 5 }, { ip: '172.16.1.69', port: 80, cameraNo: 6 },
        { ip: '172.16.1.70', port: 80, cameraNo: 7 }, { ip: '172.16.1.71', port: 80, cameraNo: 8 },
        { ip: '172.16.1.72', port: 80, cameraNo: 9 }, { ip: '172.16.1.73', port: 80, cameraNo: 10 },
        { ip: '172.16.1.74', port: 80, cameraNo: 11 }, { ip: '172.16.1.75', port: 80, cameraNo: 12 },
        { ip: '172.16.1.123', port: 80, cameraNo: 13 }, { ip: '172.16.1.77', port: 80, cameraNo: 14 }
    ],
    8: [
        { ip: '172.16.1.79', port: 80, cameraNo: 1 }, { ip: '172.16.1.80', port: 80, cameraNo: 2 },
        { ip: '172.16.1.81', port: 80, cameraNo: 3 }, { ip: '172.16.1.82', port: 80, cameraNo: 4 },
        { ip: '172.16.1.83', port: 80, cameraNo: 5 }, { ip: '172.16.1.84', port: 80, cameraNo: 6 },
        { ip: '172.16.1.85', port: 80, cameraNo: 7 }, { ip: '172.16.1.86', port: 80, cameraNo: 8 },
        { ip: '172.16.1.87', port: 80, cameraNo: 9 }, { ip: '172.16.1.88', port: 80, cameraNo: 10 },
        { ip: '172.16.1.89', port: 80, cameraNo: 11 }, { ip: '172.16.1.90', port: 80, cameraNo: 12 },
        { ip: '172.16.1.91', port: 80, cameraNo: 13 }, { ip: '172.16.1.92', port: 80, cameraNo: 14 }
    ],
    9: [
        { ip: '172.16.1.94', port: 80, cameraNo: 1 }, { ip: '172.16.1.95', port: 80, cameraNo: 2 },
        { ip: '172.16.1.96', port: 80, cameraNo: 3 }, { ip: '172.16.1.97', port: 80, cameraNo: 4 },
        { ip: '172.16.1.98', port: 80, cameraNo: 5 }, { ip: '172.16.1.99', port: 80, cameraNo: 6 },
        { ip: '172.16.1.100', port: 80, cameraNo: 7 }, { ip: '172.16.1.101', port: 80, cameraNo: 8 },
        { ip: '172.16.1.102', port: 80, cameraNo: 9 }, { ip: '172.16.1.103', port: 80, cameraNo: 10 },
        { ip: '172.16.1.104', port: 80, cameraNo: 11 }, { ip: '172.16.1.105', port: 80, cameraNo: 12 }
    ]
};

function checkCamera(ip, port) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(TIMEOUT);
        socket.on('connect', () => { socket.destroy(); resolve(true); });
        socket.on('timeout', () => { socket.destroy(); resolve(false); });
        socket.on('error', () => { socket.destroy(); resolve(false); });
        socket.connect(port, ip);
    });
}

async function performHealthCheck() {
    console.log('[CameraHealth] Starting health check for all holes...');
    const results = {};
    for (const holeNo of TARGET_HOLES) {
        const cameras = manualCameraConfig[holeNo] || [];
        if (cameras.length === 0) {
            results[holeNo] = { status: 'unknown', active: 0, total: 0, detail: [] };
            continue;
        }
        const checks = await Promise.all(cameras.map(async (cam) => {
            const isActive = await checkCamera(cam.ip, cam.port);
            return { ...cam, isActive };
        }));
        const activeCount = checks.filter(c => c.isActive).length;
        const totalCount = checks.length;
        let status = 'warning';
        if (activeCount === totalCount && totalCount > 0) status = 'active';
        if (activeCount === 0 && totalCount > 0) status = 'error';
        results[holeNo] = { status, active: activeCount, total: totalCount, detail: checks };
    }
    console.log('[CameraHealth] Health check complete.');
    return results;
}

function startCameraHealthChecks(onStatusChange) {
    performHealthCheck().then(onStatusChange);
    setInterval(async () => {
        const results = await performHealthCheck();
        onStatusChange(results);
    }, CHECK_INTERVAL);
}

module.exports = { startCameraHealthChecks };
