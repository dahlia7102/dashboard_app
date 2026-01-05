const chokidar = require('chokidar');
const fs = require('fs');

/**
 * Parses a 'FindSaveRequest' log block from an array of lines.
 * @param {string[]} lines - The lines constituting the log block.
 * @returns {object|null} A structured object with the required data, or null if it's not a successful match.
 */
function parseFindSaveRequestBlock(lines) {
  const blockData = {};
  lines.forEach(line => {
    const parts = line.split(' : ');
    if (parts.length === 2) {
      const key = parts[0].trim();
      const value = parts[1].trim();
      blockData[key] = value;
    }
  });

  // Only proceed if the log block indicates a successful match.
  if (blockData.MatchingResult === 'true') {
    return {
      holeNo: blockData.HoleNo,
      cameraNo: blockData.CameraNo,
      kioskTyCode: blockData.KioskTyCode,
      playId: blockData.PlayId,
      matchingResult: blockData.MatchingResult,
      coordinateX: blockData.CoordinateX,
      coordinateY: blockData.CoordinateY,
      message: blockData.Message,
      timestamp: new Date().toISOString(), // Add a current timestamp for the event.
    };
  }

  return null;
}


/**
 * Starts watching the log file for changes and processes new entries.
 * @param {function(object): void} onNewLogData - Callback function to execute with the parsed log data.
 */
function startLogWatcher(onNewLogData) {
    const logFilePath = 'C:\\tomcat-8.5.82\\golfApp\\webapps\\logs\\AegaServerLog.log';
    
    // State for multi-line block parsing
    let blockLines = [];
    let isInsideBlock = false;
    let lastReadSize = 0;

    try {
        const stats = fs.statSync(logFilePath);
        lastReadSize = stats.size;
        console.log(`Log file found. Initial size: ${lastReadSize}. Watching for new changes.`);
    } catch (error) {
        console.error(`Error getting initial log file stats for ${logFilePath}: ${error.message}`);
        console.error("The file may not exist yet. The watcher will still try to monitor the path.");
    }
    
    const processNewData = (path, forceFullRead = false) => {
        try {
            const stats = fs.statSync(path);
            const newSize = stats.size;

            let startByte = lastReadSize;
            if (forceFullRead || newSize < lastReadSize) {
                console.log(forceFullRead ? "Force full read." : "Log file truncated. Resetting read position.");
                startByte = 0;
                lastReadSize = 0;
                isInsideBlock = false;
                blockLines = [];
            }
            
            if (newSize > startByte) {
                const stream = fs.createReadStream(path, { start: startByte, end: newSize, encoding: 'utf8' });
                let data = '';
                stream.on('data', (chunk) => {
                    data += chunk;
                });
                stream.on('end', () => {
                    const newLines = data.split(/\r?\n/);
                    
                    newLines.forEach(line => {
                        if (!line) return;

                        if (line.includes('////////////FindSaveRequest////////////')) {
                            isInsideBlock = true;
                            blockLines = []; // Start a new block
                            return;
                        }

                        if (line.includes('///////////////////////////////////////')) {
                            if (isInsideBlock) {
                                isInsideBlock = false;
                                const parsedBlock = parseFindSaveRequestBlock(blockLines);

                                // If a block was successfully parsed, execute the callback
                                if (parsedBlock) {
                                    console.log("Ball Found event processed, calling back:", parsedBlock);
                                    onNewLogData(parsedBlock);
                                }
                                blockLines = [];
                            }
                            return;
                        }

                        if (isInsideBlock) {
                            blockLines.push(line);
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

    const watcher = chokidar.watch(logFilePath, {
        persistent: true,
        usePolling: true,
        interval: 1000,
    });

    console.log(`Setting up watcher for ${logFilePath}...`);
    watcher
        .on('add', path => {
            console.log(`File ${path} has been added. Starting to process.`);
            processNewData(path, true);
        })
        .on('change', path => {
            processNewData(path);
        })
        .on('error', error => console.error(`Watcher error: ${error}`))
        .on('ready', () => {
            console.log('Initial scan complete. Ready for changes.');
            processNewData(logFilePath, true);
        });
}

module.exports = { startLogWatcher };
