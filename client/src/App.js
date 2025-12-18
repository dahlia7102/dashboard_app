import React, { useState, useEffect } from 'react';
import { Layout, ConfigProvider, theme, Row, Col, Typography, Badge } from 'antd';
import { CheckCircleOutlined, SyncOutlined, CloseCircleOutlined } from '@ant-design/icons';
import './App.css';

// Import placeholder widgets
import SystemStatusWidget from './components/SystemStatusWidget';
import ServerGridWidget from './components/ServerGridWidget';
import KpiWidget from './components/KpiWidget';
import PipelineWidget from './components/PipelineWidget';

const { Header, Content, Footer } = Layout;
const { Title } = Typography;

function App() {
  const [dashboardState, setDashboardState] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
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
    };

    return () => {
      ws.close();
    };
  }, []);

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#09a1a6', // A professional cyan/teal color
        },
      }}
    >
      <Layout style={{ minHeight: '100vh' }}>
        <Header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Title level={3} style={{ color: 'white', margin: 0 }}>Golf Ball Tracking - Monitoring Dashboard</Title>
          <Badge 
            status={isConnected ? "success" : "error"} 
            text={isConnected ? 'Connected' : 'Disconnected'} 
            icon={isConnected ? <CheckCircleOutlined /> : <CloseCircleOutlined />} 
          />
        </Header>
        <Content style={{ padding: '24px' }}>
          <div className="App">
            <Row gutter={[24, 24]}>
              {/* Row 1: Main Status and KPIs */}
              <Col span={8}>
                <SystemStatusWidget state={dashboardState} />
              </Col>
              <Col span={16}>
                <KpiWidget state={dashboardState} />
              </Col>

              {/* Row 2: Server Grid */}
              <Col span={24}>
                <ServerGridWidget state={dashboardState} />
              </Col>

              {/* Row 3: Pipeline/Logs */}
              <Col span={24}>
                <PipelineWidget state={dashboardState} />
              </Col>
            </Row>
          </div>
        </Content>
        <Footer style={{ textAlign: 'center' }}>
          Monitoring Dashboard ©2025 Created with Me
        </Footer>
      </Layout>
    </ConfigProvider>
  );
}

export default App;


