import React, { useState } from 'react';
import { Card, Spin, Tooltip, Empty, Row, Col, Modal, Descriptions, Badge, Typography } from 'antd';

// Removed all icon imports - not needed with Badge status
// Removed gridStyle - we'll use Row/Col instead

// Helper to determine overall status for Badge and styling
const getOverallStatusConfig = (tcpStatus, appStatus) => {
  // If TCP check fails, the server is definitively offline
  if (tcpStatus === 'error') {
    return {
      badgeStatus: 'error',
      text: 'Offline',
      borderColor: '#f5222d', // Red border for offline
      backgroundColor: 'rgba(245, 34, 45, 0.15)', // Light red background
    };
  }

  // If TCP is active, check application status
  switch (appStatus) {
    case 'idle':
      return {
        badgeStatus: 'success',
        text: 'Idle',
        borderColor: '#52c41a', // Green border
        backgroundColor: 'rgba(82, 196, 26, 0.15)', // Light green background
      };
    case 'analyzing':
      return {
        badgeStatus: 'processing',
        text: 'Analyzing',
        borderColor: '#faad14', // Yellow/Orange border
        backgroundColor: 'rgba(250, 173, 20, 0.15)', // Light yellow background
      };
    case 'error': // Application specific error (e.g., from logs)
      return {
        badgeStatus: 'error',
        text: 'App Error',
        borderColor: '#f5222d', // Red border
        backgroundColor: 'rgba(245, 34, 45, 0.15)', // Light red background
      };
    default: // TCP active but app status unknown -> now defaults to Idle
      return {
        badgeStatus: 'success', // Assume success/idle
        text: 'Idle',
        borderColor: '#52c41a', // Green border
        backgroundColor: 'rgba(82, 196, 26, 0.15)', // Light green background
      };
  }
};


const ServerGridWidget = ({ state }) => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedServerData, setSelectedServerData] = useState(null); // Renamed from selectedCameraData

  const showModal = (server) => { // Renamed from camera
    setSelectedServerData(server);
    setIsModalVisible(true);
  };

  const handleCancel = () => {
    setIsModalVisible(false);
    setSelectedServerData(null);
  };

  if (!state || !state.global || !state.global.linuxServerDetails) {
    return (
      <Card title="Linux Analysis Server Status" style={{ minHeight: '200px' }}>
        <Spin tip="Loading server states..."/>
      </Card>
    );
  }

  // Combine TCP health status with application status (from cameras)
  const combinedServers = state.global.linuxServerDetails.map(linuxServer => {
    const cameraData = state.cameras[linuxServer.id]; // Get application status if available
    return {
      ...linuxServer, // id, host, port, status (tcpStatus)
      appStatus: cameraData ? cameraData.status : 'unknown', // idle, analyzing, error, etc.
      // Pass cameraData for tooltip/modal if needed, or extract relevant parts
      cameraDetails: cameraData // Store original camera data for detailed view
    };
  });

  // Sort by ID for consistent display
  const sortedServers = combinedServers.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

  const renderTooltipContent = (server) => {
    const config = getOverallStatusConfig(server.status, server.appStatus);
    const cameraDetails = server.cameraDetails;
    return (
      <div>
        <p><strong>ID:</strong> {server.id}</p>
        <p><strong>Network:</strong> <Badge status={config.badgeStatus} text={config.text} /></p>
        <p><strong>IP:</strong> {server.host}:{server.port}</p>
        {cameraDetails && (
          <>
            <p><strong>Last Activity:</strong> {cameraDetails.lastActivity || 'N/A'}</p>
            <p><strong>Request Count:</strong> {cameraDetails.requestCount || 0}</p>
            {/* Add more app-specific details if available */}
          </>
        )}
        {/* Potentially add Zabbix details here later */}
      </div>
    );
  };

  return (
    <Card title={`Linux Analysis Servers (${state.global.linuxServersOnline}/${state.global.linuxServersTotal} Online)`}>
      {combinedServers.length === 0 ? (
        <Empty description="No Linux server data received yet." />
      ) : (
        <Row gutter={[16, 16]}>
          {sortedServers.map(server => {
            const config = getOverallStatusConfig(server.status, server.appStatus);
            const isProblematic = server.status === 'error' || server.appStatus === 'error'; // Highlight if TCP or App has error
            return (
              <Col key={server.id} xs={24} sm={12} md={8} lg={6} xl={4}>
                <Tooltip title={renderTooltipContent(server)}>
                  <div
                    onClick={() => showModal(server)}
                    style={{
                      backgroundColor: isProblematic ? config.backgroundColor : 'rgba(0, 0, 0, 0.2)', // Highlight problematic servers
                      padding: '10px',
                      borderRadius: '8px', // Slightly more rounded corners
                      textAlign: 'center',
                      cursor: 'pointer',
                      border: `1px solid ${isProblematic ? config.borderColor : '#434343'}`, // Dynamic border color
                      height: '80px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      alignItems: 'center',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      boxShadow: isProblematic ? '0 0 8px rgba(245, 34, 45, 0.6)' : 'none', // Glow for problematic servers
                    }}
                  >
                    <Typography.Text strong style={{ fontSize: '16px' }}>{server.id}</Typography.Text>
                    <Badge status={config.badgeStatus} text={config.text} style={{ marginTop: '5px' }} />
                  </div>
                </Tooltip>
              </Col>
            );
          })}
        </Row>
      )}

      {/* Server Detail Modal */}
      <Modal
        title={`Server Details: ${selectedServerData?.id || ''}`}
        visible={isModalVisible}
        onCancel={handleCancel}
        footer={null}
      >
        {selectedServerData && (
          <Descriptions column={1} bordered>
            <Descriptions.Item label="ID">{selectedServerData.id}</Descriptions.Item>
            <Descriptions.Item label="IP:Port">{selectedServerData.host}:{selectedServerData.port}</Descriptions.Item>
            <Descriptions.Item label="Network Status"><Badge status={getOverallStatusConfig(selectedServerData.status, selectedServerData.appStatus).badgeStatus} text={getOverallStatusConfig(selectedServerData.status, selectedServerData.appStatus).text} /></Descriptions.Item>
            {selectedServerData.cameraDetails && (
              <>
                <Descriptions.Item label="App Status">{selectedServerData.cameraDetails.status}</Descriptions.Item>
                <Descriptions.Item label="Last Activity">{selectedServerData.cameraDetails.lastActivity || 'N/A'}</Descriptions.Item>
                <Descriptions.Item label="Request Count">{selectedServerData.cameraDetails.requestCount || 0}</Descriptions.Item>
                <Descriptions.Item label="Error Count">{selectedServerData.cameraDetails.errorCount || 0}</Descriptions.Item>
                <Descriptions.Item label="Avg. Processing Time">{selectedServerData.cameraDetails.averageProcessingTime ? `${selectedServerData.cameraDetails.averageProcessingTime.toFixed(2)} ms` : 'N/A'}</Descriptions.Item>
              </>
            )}
            {/* Add more details as needed from Zabbix, etc. */}
          </Descriptions>
        )}
      </Modal>
    </Card>
  );
};

export default ServerGridWidget;
