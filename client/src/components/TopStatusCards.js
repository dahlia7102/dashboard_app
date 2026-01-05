import React from 'react';
import { Row, Col, Card, Typography, Badge } from 'antd';
import { PieChart, Pie, Cell, ResponsiveContainer, Text } from 'recharts';

const TopStatusCards = ({ global, statusMap }) => {
  // Define colors for each status type for robustness
  const COLORS = {
    Online: '#52c41a',
    Offline: '#f5222d',
    Issues: '#faad14',
    Unknown: '#8c8c8c', // Gray for unknown/loading state
  };

  // Prepare data for the donut chart
  let linuxChartData = [
    { name: 'Online', value: global.linuxServersOnline || 0 },
    { name: 'Offline', value: global.linuxServersOffline || 0 },
    { name: 'Issues', value: global.linuxServersIssues || 0 },
  ];

  // If all data points are 0 (e.g., on initial load), show a single 'Unknown' slice
  const totalValue = linuxChartData.reduce((sum, entry) => sum + entry.value, 0);
  if (totalValue === 0) {
    linuxChartData = [{ name: 'Unknown', value: 1 }];
  } else {
    // Otherwise, filter out any sections with a value of 0
    linuxChartData = linuxChartData.filter(item => item.value > 0);
  }

  return (
    <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
      {/* Window Server Card */}
      <Col xs={24} sm={6} md={6} lg={6} xl={6}>
        <Card
          bordered={false}
          style={{ height: '90px', backgroundColor: '#1C212E', borderRadius: '8px' }}
          bodyStyle={{ padding: '12px', height: '100%' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', height: '100%' }}>
            <Typography.Text style={{ fontSize: '16px', marginBottom: '8px' }}>Window Server</Typography.Text>
            <Badge
              status={global.windowServerStatus === 'active' ? 'success' : global.windowServerStatus === 'error' ? 'error' : 'default'}
              text={global.windowServerStatus ? statusMap[global.windowServerStatus].text : statusMap.null.text}
            />
          </div>
        </Card>
      </Col>

      {/* Nginx Card */}
      <Col xs={24} sm={6} md={6} lg={6} xl={6}>
        <Card
          bordered={false}
          style={{ height: '90px', backgroundColor: '#1C212E', borderRadius: '8px' }}
          bodyStyle={{ padding: '12px', height: '100%' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', height: '100%' }}>
            <Typography.Text style={{ fontSize: '16px', marginBottom: '8px' }}>Nginx</Typography.Text>
            <Badge
              status={global.nginxStatus === 'active' ? 'success' : global.nginxStatus === 'error' ? 'error' : 'default'}
              text={global.nginxStatus ? statusMap[global.nginxStatus].text : statusMap.null.text}
            />
          </div>
        </Card>
      </Col>

      {/* Total Errors Card */}
      <Col xs={24} sm={6} md={6} lg={6} xl={6}>
        <Card
          bordered={false}
          style={{ height: '90px', backgroundColor: '#1C212E', borderRadius: '8px' }}
          bodyStyle={{ padding: '12px', height: '100%' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', height: '100%' }}>
            <Typography.Text style={{ fontSize: '16px', marginBottom: '8px' }}>Total Errors</Typography.Text>
            <Badge
              count={global.errorCount}
              style={{ backgroundColor: global.errorCount > 0 ? '#f5222d' : '#52c41a' }}
              overflowCount={999}
            />
          </div>
        </Card>
      </Col>

      {/* Linux Servers Donut Chart Card */}
      <Col xs={24} sm={6} md={6} lg={6} xl={6}>
        <Card
          bordered={false}
          style={{
            height: '90px',
            backgroundColor: '#1C212E',
            borderRadius: '8px',
          }}
          bodyStyle={{ padding: '0', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}
        >
          <Typography.Text style={{ fontSize: '16px', marginBottom: '4px' }}>Linux Servers</Typography.Text>
          <ResponsiveContainer width="100%" height={60}>
            <PieChart>
              <Pie
                data={linuxChartData}
                cx="50%"
                cy="50%"
                innerRadius={18}
                outerRadius={25}
                fill="#8884d8"
                paddingAngle={0}
                dataKey="value"
                isAnimationActive={totalValue > 0} // Animate only when there's real data
              >
                {linuxChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[entry.name]} />
                ))}
              </Pie>
              <Text
                x="50%"
                y="50%"
                textAnchor="middle"
                dominantBaseline="central"
                fill="#FFFFFF"
                style={{ fontSize: '10px' }}
              >
                {totalValue > 0 ? `${global.linuxServersOnline}/${global.linuxServersTotal}` : `.../${global.linuxServersTotal}`}
              </Text>
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </Col>
    </Row>
  );
};

export default TopStatusCards;
