import React, { useState } from 'react';
import { Card, Spin, Tooltip, Tag, Empty, Row, Col, Modal, Descriptions } from 'antd'; // Import Modal and Descriptions
import { SyncOutlined, CheckCircleOutlined, CloseCircleOutlined, QuestionCircleOutlined } from '@ant-design/icons';

// Removed gridStyle - we'll use Row/Col instead

const statusConfig = {
  idle: {
    color: 'cyan',
    icon: <CheckCircleOutlined />,
    text: 'Idle',
  },
  analyzing: {
    color: 'gold',
    icon: <SyncOutlined spin />,
    text: 'Analyzing',
  },
  error: {
    color: 'red',
    icon: <CloseCircleOutlined />,
    text: 'Error',
  },
  unknown: {
    color: 'default',
    icon: <QuestionCircleOutlined />,
    text: 'Unknown',
  }
};

const ServerGridWidget = ({ state }) => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedCameraData, setSelectedCameraData] = useState(null);

  const showModal = (camera) => {
    setSelectedCameraData(camera);
    setIsModalVisible(true);
  };

  const handleCancel = () => {
    setIsModalVisible(false);
    setSelectedCameraData(null);
  };

  if (!state || !state.cameras) {
    return (
      <Card title="Linux Analysis Server Status" style={{ minHeight: '200px' }}>
        <Spin tip="Loading camera states..."/>
      </Card>
    );
  }

  const cameras = Object.values(state.cameras).sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

  const renderTooltipContent = (camera) => (
    <div>
      <p><strong>ID:</strong> {camera.id}</p>
      <p><strong>Status:</strong> {statusConfig[camera.status]?.text || 'Unknown'}</p>
      <p><strong>IP:</strong> {camera.ip || 'N/A'}</p>
      <p><strong>Last Activity:</strong> {camera.lastActivity || 'N/A'}</p>
      <p><strong>Avg. Processing:</strong> {camera.averageProcessingTime ? `${camera.averageProcessingTime.toFixed(0)} ms` : 'N/A'}</p>
    </div>
  );

  return (
    <Card title="Linux Analysis Server Status">
      {cameras.length === 0 ? (
        <Empty description="No camera data received yet." />
      ) : (
        <Row gutter={[16, 16]}> {/* Use Row for the grid, with gutter between items */}
          {cameras.map(camera => {
            const config = statusConfig[camera.status] || statusConfig.unknown;
            return (
              <Col key={camera.id} xs={24} sm={12} md={8} lg={6} xl={4}> {/* Responsive columns */}
                <Tooltip title={renderTooltipContent(camera)}>
                  <div 
                    onClick={() => showModal(camera)} // Add onClick handler
                    style={{
                      backgroundColor: 'rgba(0, 0, 0, 0.2)', // Darker background for each item
                      padding: '10px',
                      borderRadius: '4px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      border: `1px solid ${config.color === 'default' ? '#d9d9d9' : config.color}`, // Border color based on status
                      height: '80px', // Fixed height for consistent look
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      alignItems: 'center',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{camera.id}</div>
                    <Tag color={config.color} icon={config.icon} style={{ marginTop: '5px' }}>
                      {config.text}
                    </Tag>
                  </div>
                </Tooltip>
              </Col>
            );
          })}
        </Row>
      )}

      {/* Camera Detail Modal */}
      <Modal
        title={`Camera Details: ${selectedCameraData?.id || ''}`}
        visible={isModalVisible}
        onCancel={handleCancel}
        footer={null} // No footer buttons
      >
        {selectedCameraData && (
          <Descriptions column={1} bordered>
            <Descriptions.Item label="ID">{selectedCameraData.id}</Descriptions.Item>
            <Descriptions.Item label="Status">{statusConfig[selectedCameraData.status]?.text || 'Unknown'}</Descriptions.Item>
            <Descriptions.Item label="IP">{selectedCameraData.ip || 'N/A'}</Descriptions.Item>
            <Descriptions.Item label="Last Activity">{selectedCameraData.lastActivity || 'N/A'}</Descriptions.Item>
            <Descriptions.Item label="Request Count">{selectedCameraData.requestCount}</Descriptions.Item>
            <Descriptions.Item label="Error Count">{selectedCameraData.errorCount}</Descriptions.Item>
            <Descriptions.Item label="Avg. Processing Time">{selectedCameraData.averageProcessingTime ? `${selectedCameraData.averageProcessingTime.toFixed(2)} ms` : 'N/A'}</Descriptions.Item>
            <Descriptions.Item label="Recent Processing Times">{selectedCameraData.processingTimes && selectedCameraData.processingTimes.length > 0 ? selectedCameraData.processingTimes.join(', ') : 'N/A'}</Descriptions.Item>
            {/* Add more details as needed */}
          </Descriptions>
        )}
      </Modal>
    </Card>
  );
};

export default ServerGridWidget;
