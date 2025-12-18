import React from 'react';
import { Card, Descriptions, Badge, Spin } from 'antd';
import { CheckCircleTwoTone, SyncOutlined, CloseCircleTwoTone } from '@ant-design/icons';

const SystemStatusWidget = ({ state }) => {
  if (!state || !state.global) {
    return (
      <Card title="System Overall Status" style={{ height: '100%' }}>
        <Spin tip="Loading state..."/>
      </Card>
    );
  }

  // --- Derived Status Logic ---
  
  // Spring Boot Status: Active if logs were updated in the last 5 minutes
  const lastUpdate = new Date(state.global.lastUpdate);
  const now = new Date();
  const isSpringBootActive = (now - lastUpdate) < 5 * 60 * 1000;

  // Analysis Servers (Cameras) Status
  const totalCameras = Object.keys(state.cameras).length;
  const errorCameras = Object.values(state.cameras).filter(cam => cam.status === 'error').length;
  const analysisServerStatus = errorCameras > 0 ? 'error' : 'active';
  
  const statusMap = {
    active: { color: 'green', text: 'Operational', icon: <CheckCircleTwoTone twoToneColor="#52c41a" /> },
    inactive: { color: 'gold', text: 'Inactive', icon: <SyncOutlined spin /> },
    error: { color: 'red', text: 'Error', icon: <CloseCircleTwoTone twoToneColor="#eb2f96" /> },
  };

  const getStatusBadge = (status) => {
    const { color, text, icon } = statusMap[status];
    return <Badge color={color} text={text} icon={icon} />;
  }

  return (
    <Card title="System Overall Status" style={{ height: '100%' }}>
      <Descriptions column={1} layout="horizontal" bordered>
        <Descriptions.Item label="Windows Server">
          {getStatusBadge('active')}
        </Descriptions.Item>
        <Descriptions.Item label="Nginx Proxy">
          {getStatusBadge('active')}
        </Descriptions.Item>
        <Descriptions.Item label="Spring Boot App">
          {getStatusBadge(isSpringBootActive ? 'active' : 'inactive')}
        </Descriptions.Item>
        <Descriptions.Item label="Analysis Servers">
          {getStatusBadge(analysisServerStatus)}
          <span style={{ marginLeft: '10px' }}>({totalCameras - errorCameras} / {totalCameras} Online)</span>
        </Descriptions.Item>
      </Descriptions>
    </Card>
  );
};

export default SystemStatusWidget;
