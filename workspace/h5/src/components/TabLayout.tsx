import React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { TabBar } from 'antd-mobile';
import { TeamOutline, GlobalOutline, UserOutline } from 'antd-mobile-icons';

const tabs = [
  { key: '/customers', title: '我的客户', icon: <TeamOutline /> },
  { key: '/pool', title: '客户公海', icon: <GlobalOutline /> },
  { key: '/me', title: '我的', icon: <UserOutline /> },
];

const TabLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <Outlet />
      </div>
      <div className="safe-area-bottom" style={{ borderTop: '1px solid #eee' }}>
        <TabBar
          activeKey={location.pathname}
          onChange={(key) => navigate(key)}
        >
          {tabs.map((tab) => (
            <TabBar.Item key={tab.key} icon={tab.icon} title={tab.title} />
          ))}
        </TabBar>
      </div>
    </div>
  );
};

export default TabLayout;
