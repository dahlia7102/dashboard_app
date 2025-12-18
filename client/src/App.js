import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [dashboardState, setDashboardState] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // WebSocket URL, it should point to the integrated server
    const wsUrl = 'ws://localhost:5000';
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket connection established');
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setDashboardState(data);
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
      setIsConnected(false);
    };

    // Cleanup function to close the connection when the component unmounts
    return () => {
      ws.close();
    };
  }, []); // Empty dependency array means this effect runs once on mount

  return (
    <div className="App">
      <header className="App-header">
        <h1>Dashboard</h1>
        <p>WebSocket Connection Status: {isConnected ? 'Connected' : 'Disconnected'}</p>
        <div style={{ textAlign: 'left', width: '80%', margin: '20px auto', backgroundColor: '#222', padding: '15px', borderRadius: '8px' }}>
          <h2>Live System State:</h2>
          <pre>{dashboardState ? JSON.stringify(dashboardState, null, 2) : 'Waiting for data...'}</pre>
        </div>
      </header>
    </div>
  );
}

export default App;


