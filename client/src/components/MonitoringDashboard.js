import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Activity, AlertTriangle, CheckCircle, XCircle, Server, Eye, FolderOutput } from 'lucide-react';
import axios from 'axios';

const MonitoringDashboard = () => {
  const [dashboardState, setDashboardState] = useState({});
  const [isConnected, setIsConnected] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedServer, setSelectedServer] = useState(null);
  const [activityData, setActivityData] = useState({});
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);

  const analysisLogsContainerRef = useRef(null);
  const errorLogsContainerRef = useRef(null);

  const handleOpenFolder = (path) => {
    if (!path) return;
    const directory = path.substring(0, path.lastIndexOf('\\'));
    axios.get(`http://localhost:5000/api/open-folder?path=${encodeURIComponent(directory)}`)
      .then(response => console.log(response.data.message))
      .catch(error => console.error('Error opening folder:', error));
  };

  useEffect(() => {
    const wsUrl = 'ws://localhost:5000';
    const ws = new WebSocket(wsUrl);
    ws.onopen = () => setIsConnected(true);
    ws.onclose = () => setIsConnected(false);
    ws.onerror = (error) => console.error('WebSocket error:', error);
    ws.onmessage = (event) => {
      try {
        setDashboardState(JSON.parse(event.data));
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    return () => ws.close();
  }, []);

  useEffect(() => {
    if (Object.keys(dashboardState).length === 0 && !isConnected) {
      axios.get('http://localhost:5000/api/state')
        .then(response => setDashboardState(response.data))
        .catch(error => console.error('Error fetching initial state:', error));
    }
  }, [dashboardState, isConnected]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const { global = {}, recentLogs = [], mapImageRequests = {} } = dashboardState;
  const { linuxServerDetails: servers = [], windowServerStatus, nginxStatus } = global;

  const detailsForModal = useMemo(() => {
    if (!selectedServer || !activityData[selectedServer.id]) return null;
    const lastPlayId = activityData[selectedServer.id].playId;
    if (!lastPlayId) return null;

    const findSaveLog = recentLogs.find(log => log.playId === lastPlayId && log.matchingResult === 'true');
    const mapImageLog = mapImageRequests[lastPlayId];

    return {
      playId: lastPlayId,
      cameraNo: findSaveLog?.cameraNo,
      coordinateX: findSaveLog?.coordinateX,
      coordinateY: findSaveLog?.coordinateY,
      holeNo: mapImageLog?.holeNo || findSaveLog?.holeNo,
      imagePath: mapImageLog?.imagePath,
    };
  }, [selectedServer, activityData, recentLogs, mapImageRequests]);

  useEffect(() => {
    if (isAutoScrollEnabled) {
      analysisLogsContainerRef.current?.scrollTo({ top: analysisLogsContainerRef.current.scrollHeight, behavior: 'smooth' });
      errorLogsContainerRef.current?.scrollTo({ top: errorLogsContainerRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [recentLogs, isAutoScrollEnabled]);

  const parseAnalysisMessageDetails = (message) => {
    const regex = /리눅스: ([\w-]+), 다운로드: ([\d.]+)초, 분석: ([\d.]+)초, 총: ([\d.]+)초/;
    const match = message.match(regex);
    if (match) {
      let linuxName = match[1];
      if (linuxName.endsWith('caddie')) {
        linuxName = linuxName.replace('caddie', '');
      }
      return { parsed: true, linuxName, downloadTime: `${match[2]}s`, analysisTime: `${match[3]}s`, totalTime: `${match[4]}s`, summary: 'Analysis Complete' };
    }
    return { parsed: false, linuxName: 'N/A', downloadTime: 'N/A', analysisTime: 'N/A', totalTime: 'N/A', summary: message };
  };

  const analysisResults = useMemo(() =>
    recentLogs
      .filter(log => log.matchingResult === 'true')
      .map(log => ({ ...log, type: 'detection', ...parseAnalysisMessageDetails(log.message) })),
    [recentLogs]
  );

  useEffect(() => {
    if (analysisResults.length > 0) {
      const latestResult = analysisResults[analysisResults.length - 1];
      if (latestResult && latestResult.linuxName && latestResult.linuxName !== 'N/A') {
        setActivityData({
          [latestResult.linuxName]: {
            timestamp: Date.now(),
            playId: latestResult.playId || 'N/A',
            location: latestResult.linuxName,
          },
        });
      }
    }
  }, [analysisResults]);

  const errorLogs = useMemo(() =>
    recentLogs
      .filter(log => log.level === 'ERROR' || log.level === 'CRITICAL')
      .map(log => ({ ...log, type: log.level, desc: log.message })),
    [recentLogs]
  );

  const windowsServer = { name: 'Windows-01', status: windowServerStatus || 'unknown', cpu: 0, memory: 0 };
  const nginxServer = { name: 'Nginx-01', status: nginxStatus || 'unknown', cpu: 0, memory: 0 };

  const linuxOverallStatus = (() => {
    if (!servers || servers.length === 0) return 'unknown';
    if (servers.some(s => s.status === 'error')) return 'error';
    if (servers.some(s => s.status === 'warning')) return 'warning';
    return 'active';
  })();
  
  const linuxStatusIndicator = { name: 'Linux', status: linuxOverallStatus };

  const statusCounts = useMemo(() => ({
    normal: servers.filter(s => s.status === 'active').length + (windowsServer.status === 'active' ? 1 : 0) + (nginxServer.status === 'active' ? 1 : 0),
    warning: servers.filter(s => s.status === 'warning').length + (windowsServer.status === 'warning' ? 1 : 0) + (nginxServer.status === 'warning' ? 1 : 0),
    error: servers.filter(s => s.status === 'error').length + (windowsServer.status === 'error' ? 1 : 0) + (nginxServer.status === 'error' ? 1 : 0),
    unknown: servers.filter(s => s.status === 'unknown').length + (windowsServer.status === 'unknown' ? 1 : 0) + (nginxServer.status === 'unknown' ? 1 : 0),
  }), [servers, windowServerStatus, nginxStatus]);

  const getStatusColor = (status) => ({ 'active': 'bg-green-500', 'warning': 'bg-yellow-500', 'error': 'bg-red-500' }[status] || 'bg-gray-500');
  const getStatusIcon = (status) => ({ 'active': <CheckCircle className="w-5 h-5" />, 'warning': <AlertTriangle className="w-5 h-5" />, 'error': <XCircle className="w-5 h-5" /> }[status] || null);
  const getLevelColor = (level) => ({ 'critical': 'text-red-500', 'error': 'text-red-400', 'warning': 'text-yellow-400' }[level] || 'text-blue-400');

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="bg-gray-900 border-b border-gray-800 px-6 pb-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">Server Monitoring System</h1>
            </div>
            <div className="text-right">
              <div className="text-gray-400 text-sm">Last Updated</div>
              <div className="text-white font-mono">{currentTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })}</div>
            </div>
          </div>
          <div className="flex items-center justify-between gap-4 mt-4">
            <div className="flex gap-2">
              {[windowsServer, nginxServer, linuxStatusIndicator].map(s => (
                <div key={s.name} className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer hover:scale-105 transition-transform ${s.status === 'active' ? 'bg-green-950 border-green-700' : s.status === 'warning' ? 'bg-yellow-950 border-yellow-700' : 'bg-red-950 border-red-700'}`} title={`${s.name} 서버 상태`}>
                  <div className={`w-2.5 h-2.5 rounded-full ${s.status === 'active' ? 'bg-green-500' : s.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'} animate-pulse`}></div>
                  <span className="text-xs font-semibold text-white">{s.name}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <div className="bg-green-950 border border-green-800 rounded-lg px-4 py-2.5 w-[400px]">
                <div className="flex items-center gap-3"><CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0" /><div><div className="text-green-400 text-xs">Normal</div><div className="text-2xl font-bold text-white">{statusCounts.normal}</div></div></div>
              </div>
              <div className="bg-yellow-950 border border-yellow-800 rounded-lg px-4 py-2.5 w-[400px]">
                <div className="flex items-center gap-3"><AlertTriangle className="w-6 h-6 text-yellow-500 flex-shrink-0" /><div><div className="text-yellow-400 text-xs">Warning</div><div className="text-2xl font-bold text-white">{statusCounts.warning}</div></div></div>
              </div>
              <div className="bg-red-950 border border-red-800 rounded-lg px-4 py-2.5 w-[400px]">
                <div className="flex items-center gap-3"><XCircle className="w-6 h-6 text-red-500 flex-shrink-0" /><div><div className="text-red-400 text-xs">Error</div><div className="text-2xl font-bold text-white">{statusCounts.error}</div></div></div>
              </div>
            </div>
          </div>
      </header>

      <main className="p-6 space-y-6">
        <section>
          <div className="flex justify-between items-center mb-4"><h2 className="text-xl font-semibold flex items-center gap-2"><Eye className="w-5 h-5 text-green-400" />Video Analysis Results</h2><button onClick={() => setIsAutoScrollEnabled(p => !p)} className={`flex items-center gap-2 px-3 py-1 rounded-md text-xs font-semibold transition-colors ${isAutoScrollEnabled ? 'bg-gray-700 text-green-400 hover:bg-gray-600' : 'bg-red-800 text-white hover:bg-red-700'}`} title={isAutoScrollEnabled ? "자동 스크롤 끄기" : "자동 스크롤 켜기"}>{isAutoScrollEnabled ? 'Auto-Scroll ON' : 'Auto-Scroll OFF'}</button></div>
          <div className="bg-black rounded-lg p-4 text-xs font-mono">
            <div className="grid grid-cols-[90px_110px_150px_150px_150px_80px_100px_100px_1fr] gap-x-4 items-baseline font-bold text-gray-400 border-b border-gray-700 pb-2 mb-2">
              <div>Time</div><div>Type</div><div>Server</div><div>PlayId</div><div>Name</div><div>DL</div><div>Analysis</div><div>Total</div><div>Message</div>
            </div>
            <div ref={analysisLogsContainerRef} className="h-36 overflow-y-scroll">{analysisResults.map((log, index) => (<div key={`${log.id}-${index}`} className="grid grid-cols-[90px_110px_150px_150px_150px_80px_100px_100px_1fr] gap-x-4 items-baseline leading-relaxed py-1"><div className="text-gray-500 truncate">{new Date(log.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })}</div><div className="font-bold text-green-400">[{log.type.toUpperCase()}]</div><div className="text-blue-400 truncate">[{log.server || 'N/A'}]</div><div className="text-cyan-400 truncate">{log.playId}</div><div className="text-purple-400 truncate">{log.linuxName}</div><div className="text-yellow-400 truncate">{log.downloadTime}</div><div className="text-orange-400 truncate">{log.analysisTime}</div><div className="text-red-400 truncate">{log.totalTime}</div><div className="text-gray-300">{log.desc}</div></div>))}</div>
          </div>
        </section>
        
        <section>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><Server className="w-5 h-5 text-blue-400" />Linux Server Status</h2>
          <div className="grid grid-cols-5 gap-3">{servers.map((server) => { const activity = activityData[server.id]; const isGreenGlowing = activity && (Date.now() - activity.timestamp < 2000); const animationClass = server.status === 'error' ? 'glow-pulse-red' : server.status === 'warning' ? 'glow-pulse-yellow' : isGreenGlowing ? 'glow-pulse-green' : ''; return (<div key={server.id} onClick={() => setSelectedServer(server)} className={`bg-gray-900 border rounded-lg p-3 cursor-pointer hover:border-blue-500 transition-all ${server.status === 'error' ? 'border-red-500' : server.status === 'warning' ? 'border-yellow-500' : 'border-gray-700'} ${animationClass}`}><div className="flex items-center justify-between mb-2"><span className="font-mono text-sm font-semibold">{server.id}</span><span className={getStatusColor(server.status) + ' w-3 h-3 rounded-full'}></span></div><div className="space-y-1 text-xs"><div className="flex justify-between"><span className="text-gray-400">PLAY ID</span><span className="text-cyan-400">{activity ? activity.playId : '-'}</span></div><div className="flex justify-between"><span className="text-gray-400">LOCATION</span><span className="text-purple-400">{activity ? activity.location : '-'}</span></div></div></div>);})}</div>
        </section>

        <section>
            <div className="flex justify-between items-center mb-4"><h2 className="text-xl font-semibold flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-red-400" />Error Logs</h2><button onClick={() => setIsAutoScrollEnabled(p => !p)} className={`flex items-center gap-2 px-3 py-1 rounded-md text-xs font-semibold transition-colors ${isAutoScrollEnabled ? 'bg-gray-700 text-green-400 hover:bg-gray-600' : 'bg-red-800 text-white hover:bg-red-700'}`} title={isAutoScrollEnabled ? "자동 스크롤 끄기" : "자동 스크롤 켜기"}>{isAutoScrollEnabled ? 'Auto-Scroll ON' : 'Auto-Scroll OFF'}</button></div>
            <div className="bg-black rounded-lg p-4 text-xs font-mono">
              <div className="grid grid-cols-[90px_110px_150px_1fr] gap-x-4 items-baseline font-bold text-gray-400 border-b border-gray-700 pb-2 mb-2"><div>Time</div><div>Level</div><div>Server</div><div>Message</div></div>
              <div ref={errorLogsContainerRef} className="h-36 overflow-y-scroll">{errorLogs.map((log, index) => (<div key={`${log.id}-${index}`} className="grid grid-cols-[90px_110px_150px_1fr] gap-x-4 items-baseline leading-relaxed py-1"><div className="text-gray-500 truncate">{new Date(log.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })}</div><div className={`font-bold ${getLevelColor(log.level)}`}>[{log.level.toUpperCase()}]</div><div className="text-blue-400 truncate">[{log.server || 'N/A'}]</div><div className="text-gray-300">{log.desc}</div></div>))}</div>
            </div>
        </section>
      </main>

      {selectedServer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setSelectedServer(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-4xl w-full mx-4 h-[48rem] flex flex-col" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4 flex-shrink-0">{selectedServer.id} 상세 정보</h3>
            <div className="space-y-3 flex-grow overflow-y-auto">
              <div className="flex justify-between items-center"><span className="text-gray-400">상태</span><div className="flex items-center gap-2">{getStatusIcon(selectedServer.status)}<span className="capitalize">{selectedServer.status}</span></div></div>
              {detailsForModal && (
                  <>
                    <div className="border-t border-gray-700 my-4"></div>
                    <h4 className="text-lg font-semibold mb-2 text-gray-300">Last Analysis Details</h4>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                        <span className="text-gray-400">Play ID</span>
                        <span className="font-mono text-cyan-400">{detailsForModal.playId || '-'}</span>
                        <span className="text-gray-400">Hole No</span>
                        <span className="font-mono">{detailsForModal.holeNo || '-'}</span>
                        <span className="text-gray-400">Camera No</span>
                        <span className="font-mono">{detailsForModal.cameraNo || '-'}</span>
                        <span className="text-gray-400">Coordinates (X, Y)</span>
                        <span className="font-mono">{detailsForModal.coordinateX && detailsForModal.coordinateY ? `${detailsForModal.coordinateX}, ${detailsForModal.coordinateY}`: '-'}</span>
                        <span className="text-gray-400 col-span-2 mt-2">Image Path</span>
                        {detailsForModal.imagePath ? (
                          <button onClick={() => handleOpenFolder(detailsForModal.imagePath)} className="font-mono text-yellow-500 col-span-2 break-all text-left hover:text-yellow-400 flex items-center gap-2"><FolderOutput className="w-4 h-4 flex-shrink-0" />{detailsForModal.imagePath}</button>
                        ) : (
                          <span className="font-mono text-gray-500 col-span-2 break-all">Not available</span>
                        )}
                    </div>
                  </>
              )}
            </div>
            <button onClick={() => setSelectedServer(null)} className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg transition-colors flex-shrink-0">닫기</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MonitoringDashboard;