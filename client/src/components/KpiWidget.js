import React from 'react';
import { Card, Col, Row, Statistic } from 'antd';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const KpiWidget = ({ state }) => {
  const kpiData = state?.kpiData || [];

  // Calculate current/latest values for display
  const latestData = kpiData[kpiData.length - 1] || {};
  const totalHourlyRequests = latestData.hourlyRequests !== undefined ? latestData.hourlyRequests : 'N/A';
  const currentAvgProcessingTime = latestData.avgProcessingTime !== undefined ? `${latestData.avgProcessingTime}ms` : 'N/A';

  return (
    <Card title="Key Performance Indicators (KPI)" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <Card size="small">
            <Statistic title="Total Hourly Requests (Latest)" value={totalHourlyRequests} />
          </Card>
        </Col>
        <Col span={12}>
          <Card size="small">
            <Statistic title="Avg. Processing Time (Latest)" value={currentAvgProcessingTime} />
          </Card>
        </Col>
      </Row>

      <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <Card size="small" title="Hourly Requests Trend" style={{ flex: 1 }}>
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={kpiData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#444" />
              <XAxis dataKey="name" stroke="#999" />
              <YAxis stroke="#999" />
              <Tooltip
                contentStyle={{ backgroundColor: '#333', border: 'none' }}
                labelStyle={{ color: '#fff' }}
                itemStyle={{ color: '#09a1a6' }}
              />
              <Line type="monotone" dataKey="hourlyRequests" stroke="#09a1a6" activeDot={{ r: 8 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card size="small" title="Average Processing Time Trend" style={{ flex: 1 }}>
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={kpiData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#444" />
              <XAxis dataKey="name" stroke="#999" />
              <YAxis stroke="#999" />
              <Tooltip
                contentStyle={{ backgroundColor: '#333', border: 'none' }}
                labelStyle={{ color: '#fff' }}
                itemStyle={{ color: '#a10909' }} // Different color for distinction
              />
              <Line type="monotone" dataKey="avgProcessingTime" stroke="#a10909" activeDot={{ r: 8 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </Card>
  );
};

export default KpiWidget;
