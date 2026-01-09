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
    let serverName = 'N/A'; // Default server name
    if (blockData.Message && blockData.Message.includes('리눅스:')) {
      // Extracts the server name, e.g., "LAPTOP-GUD7CGGO" from "리눅스: LAPTOP-GUD7CGGO, ..."
      const match = blockData.Message.match(/리눅스: ([\w-]+)/);
      if (match && match[1]) {
        serverName = match[1];
      }
    }

    return {
      holeNo: blockData.HoleNo,
      cameraNo: blockData.CameraNo,
      kioskTyCode: blockData.KioskTyCode,
      playId: blockData.PlayId,
      matchingResult: blockData.MatchingResult,
      coordinateX: blockData.CoordinateX,
      coordinateY: blockData.CoordinateY,
      message: blockData.Message,
      server: serverName, // Add the extracted server name
      timestamp: new Date().toISOString(), // Add a current timestamp for the event.
    };
  }

  return null;
}


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

  if (blockData.MatchingResult === 'true') {
    let serverName = 'N/A';
    if (blockData.Message && blockData.Message.includes('리눅스:')) {
      const match = blockData.Message.match(/리눅스: ([\w-]+)/);
      if (match && match[1]) {
        serverName = match[1];
      }
    }

    return {
      holeNo: blockData.HoleNo,
      cameraNo: blockData.CameraNo,
      kioskTyCode: blockData.KioskTyCode,
      playId: blockData.PlayId,
      matchingResult: blockData.MatchingResult,
      coordinateX: blockData.CoordinateX,
      coordinateY: blockData.CoordinateY,
      message: blockData.Message,
      server: serverName,
      timestamp: new Date().toISOString(),
    };
  }

  return null;
}

/**
 * Parses a 'GetMapImageRequest' log block from an array of lines.
 * @param {string[]} lines - The lines constituting the log block.
 * @returns {object|null} A structured object with the parsed data.
 */
function parseGetMapImageRequestBlock(lines) {
    const blockData = {};
    lines.forEach(line => {
        const parts = line.split(' : ');
        if (parts.length === 2) {
            const key = parts[0].trim().toLowerCase(); // Normalize keys
            const value = parts[1].trim();
            blockData[key] = value;
        }
    });

    if (blockData.playid) {
        return {
            glcr: blockData.glcr,
            golfCoursId: blockData.golfcoursid,
            holeNo: blockData.holeno,
            kioskTyCode: blockData.kiosktycode,
            playId: blockData.playid,
            timestamp: new Date().toISOString(),
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
    let currentBlockType = null; // Can be 'FindSaveRequest', 'GetMapImageRequest'
    let lastReadSize = 0;

    // State for linking GetMapImageRequest with its path
    let isExpectingImagePath = false;
    let lastParsedGetMapImagePlayId = null;

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
                currentBlockType = null;
                blockLines = [];
                isExpectingImagePath = false;
                lastParsedGetMapImagePlayId = null;
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

                        // --- Block Detection ---
                        if (line.includes('////////////FindSaveRequest////////////')) {
                            currentBlockType = 'FindSaveRequest';
                            blockLines = [];
                            return;
                        }
                        
                        if (line.includes('////////////GetMapImageRequest////////////')) {
                            currentBlockType = 'GetMapImageRequest';
                            blockLines = [];
                            return;
                        }

                        if (line.includes('///////////////////////////////////////')) {
                            if (currentBlockType) {
                                let parsedBlock = null;
                                if (currentBlockType === 'FindSaveRequest') {
                                    parsedBlock = parseFindSaveRequestBlock(blockLines);
                                    if (parsedBlock) {
                                        console.log("Ball Found event processed, calling back:", parsedBlock);
                                        onNewLogData({ type: 'findSaveRequest', data: parsedBlock });
                                    }
                                } else if (currentBlockType === 'GetMapImageRequest') {
                                    parsedBlock = parseGetMapImageRequestBlock(blockLines);
                                    if (parsedBlock) {
                                        console.log("GetMapImageRequest event processed, calling back:", parsedBlock);
                                        onNewLogData({ type: 'getMapImageRequest', data: parsedBlock });
                                        // Set state to look for the upcoming path
                                        isExpectingImagePath = true;
                                        lastParsedGetMapImagePlayId = parsedBlock.playId;
                                    }
                                }
                                
                                blockLines = [];
                                currentBlockType = null;
                            }
                            return;
                        }

                        if (currentBlockType) {
                            blockLines.push(line);
                        } 
                        // --- Image Path Detection ---
                        else if (isExpectingImagePath && line.includes('c.a.w.d.s.s.ImageService') && line.includes('C:\\')) {
                            // This is the line with the path. Extract it.
                            const pathMatch = line.match(/(C:\\\S+)/);
                            if (pathMatch && pathMatch[1]) {
                                const imagePath = pathMatch[1];
                                console.log(`Found image path "${imagePath}" for PlayID ${lastParsedGetMapImagePlayId}`);
                                onNewLogData({
                                    type: 'imagePath',
                                    data: {
                                        playId: lastParsedGetMapImagePlayId,
                                        path: imagePath,
                                        timestamp: new Date().toISOString(),
                                    }
                                });
                                // Reset the expectation state
                                isExpectingImagePath = false;
                                lastParsedGetMapImagePlayId = null;
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
