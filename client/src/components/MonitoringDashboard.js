import React, { useState, useEffect } from 'react';
import { Activity, AlertTriangle, CheckCircle, XCircle, Server, Eye } from 'lucide-react';
import axios from 'axios';

const MonitoringDashboard = () => {
  const [dashboardState, setDashboardState] = useState({});
  const [isConnected, setIsConnected] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedServer, setSelectedServer] = useState(null);

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
  const { global = {}, cameras = {}, kpiData = [], recentLogs = [] } = dashboardState;
  const { linuxServerDetails: servers = [], windowServerStatus, nginxStatus } = global;

  const analysisResults = recentLogs.filter(log => log.matchingResult === 'true').map(log => ({
    ...log,
    type: 'detection', // Assign a default type for display
    result: log.message.includes('Ball found') ? '객체 감지됨' : log.message // Derive result message
  }));

  const errorLogs = recentLogs.filter(log => log.level === 'ERROR' || log.level === 'CRITICAL').map(log => ({
    ...log,
    type: log.level === 'ERROR' ? 'error' : 'critical', // Assign type based on level
    result: log.message // Use the message directly for errors
  }));


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
        case 'critical': return 'text-red-500 bg-red-950';
        case 'error': return 'text-red-400 bg-red-950';
        case 'warning': return 'text-yellow-400 bg-yellow-950';
        default: return 'text-blue-400 bg-blue-950';
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
        {/* 상단 헤더 */}
        <header className="bg-gray-900 border-b border-gray-800 px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <Activity className="w-7 h-7 text-blue-500" />
                서버 모니터링 시스템
              </h1>
              <p className="text-gray-400 text-sm mt-1">실시간 서버 상태 및 영상분석 모니터링</p>
            </div>
            <div className="text-right">
              <div className="text-gray-400 text-sm">마지막 업데이트</div>
              <div className="text-white font-mono">{currentTime.toLocaleTimeString('ko-KR')}</div>
            </div>
          </div>
  
          {/* 헬스체크 인디케이터 */}
          <div className="mt-3">
            <div
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer hover:scale-105 transition-transform mr-2 ${
                windowsServer.status === 'active' // Changed from 'normal'
                  ? 'bg-green-950 border-green-700'
                  : 'bg-red-950 border-red-700'
              }`}
              title="Windows 서버 상태"
            >
              <div className={`w-2.5 h-2.5 rounded-full ${
                windowsServer.status === 'active' ? 'bg-green-500' : 'bg-red-500' // Changed from 'normal'
              } animate-pulse`}></div>
              <span className="text-xs font-semibold text-white">Windows</span>
            </div>
            <div
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer hover:scale-105 transition-transform ${
                nginxServer.status === 'active' // Changed from 'normal'
                  ? 'bg-green-950 border-green-700'
                  : 'bg-red-950 border-red-700'
              }`}
              title="Nginx 서버 상태"
            >
              <div className={`w-2.5 h-2.5 rounded-full ${
                nginxServer.status === 'active' ? 'bg-green-500' : 'bg-red-500' // Changed from 'normal'
              } animate-pulse`}></div>
              <span className="text-xs font-semibold text-white">Nginx</span>
            </div>
          </div>
  
          {/* 상태 요약 */}
          <div className="flex items-center gap-4 mt-4">
            <div className="grid grid-cols-3 gap-4 flex-1">
              <div className="bg-green-950 border border-green-800 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-green-400 text-sm">정상</div>
                    <div className="text-3xl font-bold text-white">{statusCounts.normal}</div>
                  </div>
                  <CheckCircle className="w-10 h-10 text-green-500" />
                </div>
              </div>
              <div className="bg-yellow-950 border border-yellow-800 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-yellow-400 text-sm">경고</div>
                    <div className="text-3xl font-bold text-white">{statusCounts.warning}</div>
                  </div>
                  <AlertTriangle className="w-10 h-10 text-yellow-500" />
                </div>
              </div>
              <div className="bg-red-950 border border-red-800 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-red-400 text-sm">에러</div>
                    <div className="text-3xl font-bold text-white">{statusCounts.error}</div>
                  </div>
                  <XCircle className="w-10 h-10 text-red-500" />
                </div>
              </div>
            </div>
  
          {/* 헬스체크 인디케이터 */}
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* 서버 그리드 섹션 */}
        <section>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Server className="w-5 h-5 text-blue-400" />
            Linux 서버 현황 (25대)
          </h2>
          <div className="grid grid-cols-5 gap-3">
            {servers.map((server) => {
              console.log("Rendering server:", server); // Added console.log
              return (
              <div
                key={server.id}
                onClick={() => setSelectedServer(server)}
                className={`bg-gray-900 border rounded-lg p-3 cursor-pointer hover:border-blue-500 transition-all ${
                  server.status === 'error' ? 'border-red-500' :
                  server.status === 'warning' ? 'border-yellow-500' : 'border-gray-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-sm font-semibold">{server.id}</span>
                  <span className={getStatusColor(server.status) + ' w-3 h-3 rounded-full'}></span>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-400">CPU</span>
                    <span className={server.cpu > 80 ? 'text-red-400' : 'text-gray-300'}>{server.cpu}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">MEM</span>
                    <span className={server.memory > 80 ? 'text-red-400' : 'text-gray-300'}>{server.memory}%</span>
                  </div>
                </div>
              </div>
            )})}
          </div>

          {/* Windows & Nginx 서버 */}
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

        {/* 영상분석 결과 */}
        <section>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Eye className="w-5 h-5 text-green-400" />
            영상분석 결과 (TRUE)
          </h2>
          <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
            <div className="max-h-64 overflow-y-auto">
              {analysisResults.map((result) => (
                <div key={result.id} className="border-b border-gray-800 p-4 hover:bg-gray-850 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`${getAnalysisTypeColor(result.type)} px-2 py-1 rounded text-xs font-semibold text-white`}>
                        {result.type.toUpperCase()}
                      </span>
                      <span className="font-mono text-sm text-gray-400">{result.time}</span>
                      <span className="text-blue-400 font-semibold">{result.server}</span>
                    </div>
                    <span className="text-gray-300">{result.result}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 에러 로그 */}
        <section>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            에러 로그
          </h2>
          <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
            <div className="max-h-64 overflow-y-auto">
              {errorLogs.map((log) => (
                <div key={log.id} className="border-b border-gray-800 p-4 hover:bg-gray-850 transition-colors">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`${getLevelColor(log.level)} px-2 py-1 rounded text-xs font-bold uppercase`}>
                      {log.level}
                    </span>
                    <span className="font-mono text-sm text-gray-400">{log.time}</span>
                    <span className="text-blue-400 font-semibold">{log.server}</span>
                  </div>
                  <p className="text-gray-300 text-sm pl-3">{log.message}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* 서버 상세 모달 */}
      {selectedServer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setSelectedServer(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4">{selectedServer.name} 상세 정보</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">상태</span>
                <div className="flex items-center gap-2">
                  {getStatusIcon(selectedServer.status)}
                  <span className="capitalize">{selectedServer.status}</span>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">CPU 사용률</span>
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