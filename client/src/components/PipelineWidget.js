import React, { useRef, useEffect } from 'react';
import { Card, List, Typography, Tag } from 'antd';

const { Text } = Typography;

const getLogLevelColor = (level) => {
  switch (level) {
    case 'ERROR':
      return 'volcano';
    case 'WARN':
      return 'gold';
    case 'INFO':
      return 'geekblue';
    case 'DEBUG':
      return 'green';
    default:
      return 'default';
  }
};

const PipelineWidget = ({ state }) => {
  const recentLogs = state?.recentLogs || [];
  const scrollableRef = useRef(null); // Ref for the scrollable area

  // Effect to scroll to bottom when recentLogs change
  useEffect(() => {
    if (scrollableRef.current) {
      scrollableRef.current.scrollTop = scrollableRef.current.scrollHeight;
    }
  }, [recentLogs]); // Rerun when recentLogs change

  return (
    <Card
      title="Real-time Request Pipeline"
      style={{ height: '400px', display: 'flex', flexDirection: 'column' }} // Fixed height for the Card
      bodyStyle={{ flex: 1, padding: '10px' }} // bodyStyle only handles flex and padding
    >
      <div // This div will be the scrollable area
        ref={scrollableRef}
        className="pipeline-widget-body" // Apply custom scrollbar styles here
        style={{ overflowY: 'auto', maxHeight: '324px' }} // Explicit maxHeight in pixels
      >
        <List
          itemLayout="horizontal"
          dataSource={recentLogs.slice().reverse()} // Display newest logs first
          renderItem={(log, index) => (
            <List.Item key={index} style={{ padding: '8px 0' }}>
              <List.Item.Meta
                title={
                  <>
                    <Tag color={getLogLevelColor(log.level)}>{log.level}</Tag>
                    <Text type="secondary" style={{ marginLeft: 8 }}>{log.timestamp}</Text>
                  </>
                }
                description={
                  <Text style={{ display: 'block', wordBreak: 'break-word' }}>{log.message}</Text>
                }
              />
              {log.cameraId && <Text type="secondary" style={{ whiteSpace: 'nowrap', marginRight: '5px' }}>Camera: {log.cameraId}</Text>}
              {log.ip && <Text type="secondary" style={{ whiteSpace: 'nowrap' }}>IP: {log.ip}</Text>}
              {log.processingTimes && log.processingTimes.length > 0 && 
                <Text type="secondary" style={{ whiteSpace: 'nowrap', marginLeft: '5px' }}>Proc Time: {log.processingTimes.join(', ')}</Text>}
            </List.Item>
          )}
        />
      </div>
    </Card>
  );
};

export default PipelineWidget;