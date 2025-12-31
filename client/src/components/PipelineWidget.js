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

  return (
    <Card
      title="Real-time Request Pipeline"
      style={{ height: '400px', display: 'flex', flexDirection: 'column' }} // Fixed height for the Card
      bodyStyle={{ flex: 1, padding: '10px' }} // bodyStyle only handles flex and padding
    >
      <div // This div will be the scrollable area
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
                    <Text type="secondary" style={{ marginLeft: 8 }}>{new Date(log.timestamp).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</Text>
                  </>
                }
                description={
                  (() => {
                    const message = log.message || '';
                    const match = message.match(/리눅스: (.*?), .*총: (.*?초)/); // Extract "초" as well
                    if (match) {
                      const linuxName = match[1];
                      const totalTime = match[2].replace('초', 's'); // Replace "초" with "s"
                      const matchingResult = String(log.matchingResult) || 'N/A';
                      return (
                        <Text style={{ display: 'block', wordBreak: 'break-word' }}>
                          {`Linux: ${linuxName}, Total: ${totalTime}, Matching: ${matchingResult}`}
                        </Text>
                      );
                    }
                    // Fallback to original message if format is unexpected
                    return <Text style={{ display: 'block', wordBreak: 'break-word' }}>{message}</Text>;
                  })()
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