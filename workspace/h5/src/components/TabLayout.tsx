import React, { useMemo } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { TabBar } from 'antd-mobile';
import { TeamOutline, GlobalOutline, UserOutline, CalendarOutline, ClockCircleOutline } from 'antd-mobile-icons';
import { useAuth } from '../contexts/AuthContext';

const allTabs = [
  { key: '/customers', title: '我的客户', icon: <TeamOutline />, module: 'customer' },
  { key: '/visits', title: '工作', icon: <CalendarOutline />, module: 'visit' },
  { key: '/attendance', title: '考勤', icon: <ClockCircleOutline />, module: 'attendance' },
  { key: '/pool', title: '客户公海', icon: <GlobalOutline />, module: 'customer' },
  { key: '/me', title: '我的', icon: <UserOutline />, module: null },
];

const TabLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const tabs = useMemo(() => {
    const modules = user?.enabled_modules;
    return allTabs.filter((tab) => {
      if (!tab.module) return true; // 无模块限制的始终显示
      if (!modules) return tab.module !== 'attendance'; // modules 未返回时默认不显示考勤
      return modules[tab.module] !== false;
    });
  }, [user?.enabled_modules]);

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
