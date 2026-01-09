import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Activity, AlertTriangle, CheckCircle, XCircle, Server, Eye } from 'lucide-react';
import axios from 'axios';

const MonitoringDashboard = () => {
  const [dashboardState, setDashboardState] = useState({});
  const [isConnected, setIsConnected] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedServer, setSelectedServer] = useState(null);
  const [activityData, setActivityData] = useState({}); // Changed from activityTimestamps
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);

  const analysisLogsContainerRef = useRef(null);
  const errorLogsContainerRef = useRef(null);

  useEffect(() => {
    const wsUrl = 'ws://localhost:5000'; // Adjust as needed
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket connection established');
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const newData = JSON.parse(event.data);
        console.log("Received WebSocket data:", newData); // Add this line
        setDashboardState(newData); // Update state with new data
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket connection closed');
      setIsConnected(false);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return () => {
      ws.close();
    };
  }, []);

  // Initial data fetch via REST API
  useEffect(() => {
    if (Object.keys(dashboardState).length === 0 && !isConnected) {
      axios.get('http://localhost:5000/api/state')
        .then(response => {
          setDashboardState(response.data);
        })
        .catch(error => {
          console.error('Error fetching initial state:', error);
        });
    }
  }, [dashboardState, isConnected]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Use optional chaining for dashboardState properties
  const { global = {}, cameras = {}, recentLogs = [] } = dashboardState;
  const { linuxServerDetails: servers = [], windowServerStatus, nginxStatus } = global;

  useEffect(() => {
    if (isAutoScrollEnabled) {
      const analysisContainer = analysisLogsContainerRef.current;
      if (analysisContainer) {
        analysisContainer.scrollTop = analysisContainer.scrollHeight;
      }
      const errorContainer = errorLogsContainerRef.current;
      if (errorContainer) {
        errorContainer.scrollTop = errorContainer.scrollHeight;
      }
    }
  }, [recentLogs, isAutoScrollEnabled]);

  const parseAnalysisMessageDetails = (message) => {
    const regex = /리눅스: ([\w-]+), 다운로드: ([\d.]+)초, 분석: ([\d.]+)초, 총: ([\d.]+)초/;
    const match = message.match(regex);
    if (match) {
      let linuxName = match[1];
      // Remove "caddie" suffix if present to match server.id format
      if (linuxName.endsWith('caddie')) {
        linuxName = linuxName.replace('caddie', '');
      }

      return {
        parsed: true,
        linuxName: linuxName, // Use the cleaned name
        downloadTime: `${match[2]}s`,
        analysisTime: `${match[3]}s`,
        totalTime: `${match[4]}s`,
        summary: 'Analysis Complete'
      };
    }
    return { parsed: false, linuxName: 'N/A', downloadTime: 'N/A', analysisTime: 'N/A', totalTime: 'N/A', summary: message };
  };

  const analysisResults = useMemo(() => {
    return recentLogs.filter(log => log.matchingResult === 'true').map(log => {
      const details = parseAnalysisMessageDetails(log.message);
      return {
        ...log,
        type: 'detection',
        linuxName: details.linuxName,
        downloadTime: details.downloadTime,
        analysisTime: details.analysisTime,
        totalTime: details.totalTime,
        desc: details.summary
      };
    });
  }, [recentLogs]);

  useEffect(() => {
    if (analysisResults.length > 0) {
      // Assuming analysisResults is sorted by time, get the latest
      const latestResult = analysisResults[analysisResults.length - 1];
      if (latestResult && latestResult.linuxName && latestResult.linuxName !== 'N/A') {
        setActivityData(prev => ({
          ...prev,
          [latestResult.linuxName]: {
            timestamp: Date.now(),
            playId: latestResult.playId || 'N/A', // Store playId
            location: latestResult.linuxName, // Store location, which is server.id/linuxName
          },
        }));
      }
    }
  }, [analysisResults]);

  const errorLogs = useMemo(() => {
    return recentLogs.filter(log => log.level === 'ERROR' || log.level === 'CRITICAL').map(log => ({
      ...log,
      type: log.level === 'ERROR' ? 'error' : 'critical',
      desc: log.message
    }));
  }, [recentLogs]);


  const windowsServer = {
    name: 'Windows-01', // Name remains static as it's a fixed server
    status: windowServerStatus || 'unknown', // Use actual status from backend
    cpu: 0, memory: 0 // Placeholder, as CPU/MEM are not in current global state
  };

  const nginxServer = {
    name: 'Nginx-01', // Name remains static
    status: nginxStatus || 'unknown', // Use actual status from backend
    cpu: 0, memory: 0 // Placeholder
  };

  const linuxOverallStatus = (() => {
    if (!servers || servers.length === 0) return 'unknown';
    if (servers.some(s => s.status === 'error')) return 'error';
    if (servers.some(s => s.status === 'warning')) return 'warning';
    return 'active';
  })();

  const linuxStatusIndicator = {
    name: 'Linux',
    status: linuxOverallStatus,
  };

  // Derive statusCounts from dashboardState
  const statusCounts = {
    normal: servers.filter(s => s.status === 'active').length + (windowsServer.status === 'active' ? 1 : 0) + (nginxServer.status === 'active' ? 1 : 0),
    warning: servers.filter(s => s.status === 'warning').length + (windowsServer.status === 'warning' ? 1 : 0) + (nginxServer.status === 'warning' ? 1 : 0),
    error: servers.filter(s => s.status === 'error').length + (windowsServer.status === 'error' ? 1 : 0) + (nginxServer.status === 'error' ? 1 : 0),
    unknown: servers.filter(s => s.status === 'unknown').length + (windowsServer.status === 'unknown' ? 1 : 0) + (nginxServer.status === 'unknown' ? 1 : 0),
  };



    const getStatusColor = (status) => {
      switch(status) {
        case 'active': return 'bg-green-500';
        case 'warning': return 'bg-yellow-500';
        case 'error': return 'bg-red-500';
        default: return 'bg-gray-500';
      }
    };
  
    const getStatusIcon = (status) => {
      switch(status) {
        case 'active': return <CheckCircle className="w-5 h-5" />;
        case 'warning': return <AlertTriangle className="w-5 h-5" />;
        case 'error': return <XCircle className="w-5 h-5" />;
        default: return null;
      }
    };
  
    const getLevelColor = (level) => {
      switch(level) {
        case 'critical': return 'text-red-500';
        case 'error': return 'text-red-400';
        case 'warning': return 'text-yellow-400';
        default: return 'text-blue-400';
      }
    };
  
    const getAnalysisTypeColor = (type) => {
      switch(type) {
        case 'intrusion': return 'bg-red-500';
        case 'anomaly': return 'bg-orange-500';
        case 'motion': return 'bg-blue-500';
        case 'detection': return 'bg-green-500'; // Added for derived 'detection' type
        default: return 'bg-green-500';
      }
    };
  
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100">
        <header className="bg-gray-900 border-b border-gray-800 px-6 pb-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                {/* <Activity className="w-7 h-7 text-blue-500" /> */}
                Server Monitoring System
              </h1>
              {/* <p className="text-gray-400 text-sm mt-1">실시간 서버 상태 및 영상분석 모니터링</p> */}
            </div>
            <div className="text-right">
              <div className="text-gray-400 text-sm">Last Updated</div>
              <div className="text-white font-mono">
                {currentTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 mt-4">
            <div className="flex gap-2">
              <div
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer hover:scale-105 transition-transform ${
                  windowsServer.status === 'active'
                    ? 'bg-green-950 border-green-700'
                    : windowsServer.status === 'warning'
                    ? 'bg-yellow-950 border-yellow-700'
                    : 'bg-red-950 border-red-700'
                }`}
                title="Windows 서버 상태"
              >
                <div className={`w-2.5 h-2.5 rounded-full ${
                  windowsServer.status === 'active'
                    ? 'bg-green-500'
                    : windowsServer.status === 'warning'
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
                } animate-pulse`}></div>
                <span className="text-xs font-semibold text-white">Windows</span>
              </div>
              <div
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer hover:scale-105 transition-transform ${
                  nginxServer.status === 'active'
                    ? 'bg-green-950 border-green-700'
                    : nginxServer.status === 'warning'
                    ? 'bg-yellow-950 border-yellow-700'
                    : 'bg-red-950 border-red-700'
                }`}
                title="Nginx 서버 상태"
              >
                <div className={`w-2.5 h-2.5 rounded-full ${
                  nginxServer.status === 'active'
                    ? 'bg-green-500'
                    : nginxServer.status === 'warning'
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
                } animate-pulse`}></div>
                <span className="text-xs font-semibold text-white">Nginx</span>
              </div>
              <div
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer hover:scale-105 transition-transform ${
                  linuxStatusIndicator.status === 'active'
                    ? 'bg-green-950 border-green-700'
                    : linuxStatusIndicator.status === 'warning'
                    ? 'bg-yellow-950 border-yellow-700'
                    : 'bg-red-950 border-red-700'
                }`}
                title="전체 Linux 서버 상태"
              >
                <div className={`w-2.5 h-2.5 rounded-full ${
                  linuxStatusIndicator.status === 'active'
                    ? 'bg-green-500'
                    : linuxStatusIndicator.status === 'warning'
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
                } animate-pulse`}></div>
                <span className="text-xs font-semibold text-white">Linux</span>
              </div>
            </div>

                      <div className="flex gap-3">
                        <div className="bg-green-950 border border-green-800 rounded-lg px-4 py-2.5 w-[400px]">
                          <div className="flex items-center gap-3">
                            <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0" />
                            <div>
                              <div className="text-green-400 text-xs">Nomal</div>
                              <div className="text-2xl font-bold text-white">{statusCounts.normal}</div>
                            </div>
                          </div>
                        </div>
                        <div className="bg-yellow-950 border border-yellow-800 rounded-lg px-4 py-2.5 w-[400px]">
                          <div className="flex items-center gap-3">
                            <AlertTriangle className="w-6 h-6 text-yellow-500 flex-shrink-0" />
                            <div>
                              <div className="text-yellow-400 text-xs">Warning</div>
                              <div className="text-2xl font-bold text-white">{statusCounts.warning}</div>
                            </div>
                          </div>
                        </div>
                        <div className="bg-red-950 border border-red-800 rounded-lg px-4 py-2.5 w-[400px]">
                          <div className="flex items-center gap-3">
                            <XCircle className="w-6 h-6 text-red-500 flex-shrink-0" />
                            <div>
                              <div className="text-red-400 text-xs">Error</div>
                              <div className="text-2xl font-bold text-white">{statusCounts.error}</div>
                            </div>
                          </div>
                        </div>
                      </div>          </div>
        </header>

        <div className="p-6 space-y-6">
        {/* 영상분석 결과 */}
        <section>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Eye className="w-5 h-5 text-green-400" />
              Video Analysis Results
            </h2>
            <button
              onClick={() => setIsAutoScrollEnabled(!isAutoScrollEnabled)}
              className={`flex items-center gap-2 px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                isAutoScrollEnabled
                  ? 'bg-gray-700 text-green-400 hover:bg-gray-600'
                  : 'bg-red-800 text-white hover:bg-red-700'
              }`}
              title={isAutoScrollEnabled ? "자동 스크롤 끄기" : "자동 스크롤 켜기"}
            >
              {isAutoScrollEnabled ? 'Auto-Scroll ON' : 'Auto-Scroll OFF'}
            </button>
          </div>
          <div className="bg-black rounded-lg p-4 text-xs font-mono">
            <div className="grid grid-cols-[90px_110px_150px_150px_150px_80px_100px_100px_1fr] gap-x-4 items-baseline font-bold text-gray-400 border-b border-gray-700 pb-2 mb-2">
              <div>Time</div>
              <div>Type</div>
              <div>Server</div>
              <div>PlayId</div>
              <div>Name</div>
              <div>DL</div>
              <div>Analysis</div>
              <div>Total</div>
              <div>Message</div>
            </div>
            <div ref={analysisLogsContainerRef} className="h-36 overflow-y-scroll">
              {analysisResults.map((log) => (
                <div key={log.id} className="grid grid-cols-[90px_110px_150px_150px_150px_80px_100px_100px_1fr] gap-x-4 items-baseline leading-relaxed py-1">
                  <div className="text-gray-500 truncate">{new Date(log.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })}</div>
                  <div className="font-bold text-green-400">[{log.type.toUpperCase()}]</div>
                  <div className="text-blue-400 truncate">[{log.server || 'N/A'}]</div>
                  <div className="text-cyan-400 truncate">{log.playId}</div>
                  <div className="text-purple-400 truncate">{log.linuxName}</div>
                  <div className="text-yellow-400 truncate">{log.downloadTime}</div>
                  <div className="text-orange-400 truncate">{log.analysisTime}</div>
                  <div className="text-red-400 truncate">{log.totalTime}</div>
                  <div className="text-gray-300">{log.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 서버 그리드 섹션 */}
        <section>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Server className="w-5 h-5 text-blue-400" />
            Linux Server Status
          </h2>
          <div className="grid grid-cols-5 gap-3">
            {servers.map((server) => {
              const activity = activityData[server.id];
              const isGreenGlowing = activity && (Date.now() - activity.timestamp < 2000);

              const animationClass = (() => {
                if (server.status === 'error') return 'glow-pulse-red';
                if (server.status === 'warning') return 'glow-pulse-yellow';
                if (isGreenGlowing) return 'glow-pulse-green';
                return '';
              })();

              return (
                <div
                  key={server.id}
                  onClick={() => setSelectedServer(server)}
                  className={`bg-gray-900 border rounded-lg p-3 cursor-pointer hover:border-blue-500 transition-all ${
                    server.status === 'error' ? 'border-red-500' :
                    server.status === 'warning' ? 'border-yellow-500' : 'border-gray-700'
                  } ${animationClass}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-sm font-semibold">{server.id}</span>
                    <span className={getStatusColor(server.status) + ' w-3 h-3 rounded-full'}></span>
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-400">PLAY ID</span>
                      <span className="text-gray-300">
                        {activity ? activity.playId : '-'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">LOCATION</span>
                      <span className="text-gray-300">
                        {activity ? activity.location : '-'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-3 mt-3">
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold">{windowsServer.name}</span>
                {getStatusIcon(windowsServer.status)}
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">CPU</span>
                  <span>{windowsServer.cpu}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Memory</span>
                  <span>{windowsServer.memory}%</span>
                </div>
              </div>
            </div>
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold">{nginxServer.name}</span>
                {getStatusIcon(nginxServer.status)}
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">CPU</span>
                  <span>{nginxServer.cpu}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Memory</span>
                  <span>{nginxServer.memory}%</span>
                </div>
              </div>
            </div>
          </div>
        </section>

          <section>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                Error Logs
              </h2>
              <button
                onClick={() => setIsAutoScrollEnabled(!isAutoScrollEnabled)}
                className={`flex items-center gap-2 px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                  isAutoScrollEnabled
                    ? 'bg-gray-700 text-green-400 hover:bg-gray-600'
                    : 'bg-red-800 text-white hover:bg-red-700'
                }`}
                title={isAutoScrollEnabled ? "자동 스크롤 끄기" : "자동 스크롤 켜기"}
              >
                {isAutoScrollEnabled ? 'Auto-Scroll ON' : 'Auto-Scroll OFF'}
              </button>
            </div>
            <div className="bg-black rounded-lg p-4 text-xs font-mono">
              <div className="grid grid-cols-[90px_110px_150px_1fr] gap-x-4 items-baseline font-bold text-gray-400 border-b border-gray-700 pb-2 mb-2">
                <div>Time</div>
                <div>Level</div>
                <div>Server</div>
                <div>Message</div>
              </div>
              <div ref={errorLogsContainerRef} className="h-36 overflow-y-scroll">
                {errorLogs.map((log) => (
                  <div key={log.id} className="grid grid-cols-[90px_110px_150px_1fr] gap-x-4 items-baseline leading-relaxed py-1">
                    <div className="text-gray-500 truncate">{new Date(log.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })}</div>
                    <div className={`font-bold ${getLevelColor(log.level)}`}>[{log.level.toUpperCase()}]</div>
                    <div className="text-blue-400 truncate">[{log.server || 'N/A'}]</div>
                    <div className="text-gray-300">{log.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        {selectedServer && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setSelectedServer(null)}>
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
              <h3 className="text-xl font-bold mb-4">{selectedServer.id} 상세 정보</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">상태</span>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(selectedServer.status)}
                    <span className="capitalize">{selectedServer.status}</span>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-400">CPU 사용률</span>
                  <span>{selectedServer.cpu}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">메모리 사용률</span>
                  <span>{selectedServer.memory}%</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedServer(null)}
                className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

export default MonitoringDashboard;