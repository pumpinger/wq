import React, { useState, useEffect } from 'react';
import { ConfigProvider, Layout, Menu, theme, Dropdown, Space, Avatar, Typography, Button, Tag } from 'antd';
import {
  TeamOutlined,
  AppstoreOutlined,
  SettingOutlined,
  FormOutlined,
  UserOutlined,
  LogoutOutlined,
  BankOutlined,
  UsergroupAddOutlined,
  ArrowLeftOutlined,
  SafetyOutlined,
  EnvironmentOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import zhCN from 'antd/locale/zh_CN';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import CustomerList from './pages/CustomerList';
import TemplateList from './pages/TemplateList';
import FieldList from './pages/FieldList';
import TenantList from './pages/admin/TenantList';
import UserList from './pages/tenant/UserList';
import RoleList from './pages/tenant/RoleList';
import RegionList from './pages/tenant/RegionList';
import CustomerMap from './pages/CustomerMap';
import CustomerPool from './pages/CustomerPool';
import ErrorBoundary from './components/ErrorBoundary';

const { Header, Content, Sider } = Layout;
const { Text } = Typography;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// 主应用内容
const AppContent: React.FC = () => {
  const { user, isAuthenticated, isLoading, logout, selectedTenant, isInTenantMode, exitTenantMode } = useAuth();
  const getInitialKey = () => {
    if (user?.is_super_admin && !isInTenantMode) return 'tenants';
    if (user?.is_super_admin || user?.role === 'tenant_admin') return 'users';
    return 'customers';
  };
  const [selectedKey, setSelectedKey] = useState(getInitialKey);
  const queryClient = useQueryClient();

  // 超管进入/退出租户模式时重置菜单选择
  useEffect(() => {
    if (user?.is_super_admin) {
      if (isInTenantMode) {
        setSelectedKey('users');
      } else {
        setSelectedKey('tenants');
      }
      // 刷新数据
      queryClient.invalidateQueries();
    }
  }, [isInTenantMode, user?.is_super_admin, queryClient]);

  // 加载中
  if (isLoading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}>
        加载中...
      </div>
    );
  }

  // 未登录显示登录页
  if (!isAuthenticated) {
    return <Login />;
  }

  // 根据用户角色生成菜单
  const getMenuItems = () => {
    const items: any[] = [];

    // 超级管理员 - 平台管理模式
    if (user?.is_super_admin && !isInTenantMode) {
      items.push({
        key: 'tenants',
        icon: <BankOutlined />,
        label: '租户管理',
      });
      return items; // 平台模式只显示租户管理
    }

    // 超级管理员 - 租户管理模式 或 租户管理员
    if (user?.is_super_admin || user?.role === 'tenant_admin') {
      items.push({
        key: 'users',
        icon: <UsergroupAddOutlined />,
        label: '员工管理',
      });
    }

    // 业务菜单（所有用户）
    items.push({
      key: 'customers',
      icon: <TeamOutlined />,
      label: '客户管理',
    });

    items.push({
      key: 'customer-map',
      icon: <EnvironmentOutlined />,
      label: '客户分布',
    });

    items.push({
      key: 'customer-pool',
      icon: <InboxOutlined />,
      label: '客户公海',
    });

    // 配置菜单（管理员）
    if (user?.is_super_admin || user?.role === 'tenant_admin') {
      items.push({
        key: 'settings',
        icon: <SettingOutlined />,
        label: '系统配置',
        children: [
          {
            key: 'templates',
            icon: <AppstoreOutlined />,
            label: '模板管理',
          },
          {
            key: 'fields',
            icon: <FormOutlined />,
            label: '字段管理',
          },
          {
            key: 'roles',
            icon: <SafetyOutlined />,
            label: '角色权限',
          },
          {
            key: 'regions',
            icon: <EnvironmentOutlined />,
            label: '区域管理',
          },
        ],
      });
    }

    return items;
  };

  // 渲染页面内容
  const renderContent = () => {
    switch (selectedKey) {
      case 'tenants':
        return user?.is_super_admin ? <TenantList /> : null;
      case 'users':
        return <UserList />;
      case 'customers':
        return <CustomerList />;
      case 'customer-map':
        return <CustomerMap />;
      case 'customer-pool':
        return <CustomerPool />;
      case 'templates':
        return <TemplateList />;
      case 'fields':
        return <FieldList />;
      case 'roles':
        return <RoleList />;
      case 'regions':
        return <RegionList />;
      default:
        return <CustomerList />;
    }
  };

  // 处理登出：先清除缓存再登出
  const handleLogout = () => {
    queryClient.clear();
    logout();
  };

  // 用户下拉菜单
  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人信息',
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ];

  // 获取显示名称
  const displayName = user?.real_name || user?.username || '用户';
  const roleText = user?.is_super_admin ? '超级管理员' :
    user?.role === 'tenant_admin' ? '管理员' : '员工';

  // 获取当前租户名称
  const currentTenantName = isInTenantMode ? selectedTenant?.name : user?.tenant_name;

  // Header 背景色：平台模式用深色，租户模式用蓝色
  const headerBgColor = user?.is_super_admin && !isInTenantMode ? '#1a1a2e' : '#001529';

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        background: headerBgColor,
      }}>
        <Space>
          {/* 超管在租户模式下显示返回按钮 */}
          {user?.is_super_admin && isInTenantMode && (
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={exitTenantMode}
              style={{ color: 'white', marginRight: 8 }}
            >
              返回平台
            </Button>
          )}
          <h1 style={{ color: 'white', margin: 0, fontSize: 18 }}>
            外勤管理系统
            {currentTenantName && (
              <Tag color="blue" style={{ marginLeft: 12, fontSize: 14 }}>
                {currentTenantName}
              </Tag>
            )}
            {user?.is_super_admin && !isInTenantMode && (
              <Tag color="purple" style={{ marginLeft: 12, fontSize: 14 }}>
                平台管理
              </Tag>
            )}
          </h1>
        </Space>
        <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
          <Space style={{ cursor: 'pointer', color: 'white' }}>
            <Avatar size="small" icon={<UserOutlined />} />
            <span>{displayName}</span>
            <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>
              ({roleText})
            </Text>
          </Space>
        </Dropdown>
      </Header>
      <Layout>
        <Sider width={200} style={{ background: '#fff' }}>
          <Menu
            mode="inline"
            selectedKeys={[selectedKey]}
            defaultOpenKeys={['settings']}
            onClick={({ key }) => setSelectedKey(key)}
            style={{ height: '100%', borderRight: 0 }}
            items={getMenuItems()}
          />
        </Sider>
        <Layout style={{ padding: '0 12px 12px' }}>
          <Content
            style={{
              padding: 16,
              margin: 0,
              minHeight: 280,
              background: '#fff',
              marginTop: 12,
              borderRadius: 8,
              overflow: 'auto',
            }}
          >
            <ErrorBoundary>
              {renderContent()}
            </ErrorBoundary>
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
};

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider locale={zhCN} theme={{ algorithm: theme.defaultAlgorithm }}>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ConfigProvider>
    </QueryClientProvider>
  );
};

export default App;
