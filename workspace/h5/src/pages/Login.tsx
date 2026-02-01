import React, { useState } from 'react';
import { Form, Input, Button, Toast, Divider, Tag } from 'antd-mobile';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

// 测试账号列表 (密码统一为 123456)
const testAccounts = [
  { username: 'superadmin', password: '123456', label: '超级管理员', color: '#ff4d4f' },
  { username: 'bj_admin', password: '123456', label: '北京-管理员', color: '#1677ff' },
  { username: 'bj_manager_张伟', password: '123456', label: '北京-经理', color: '#722ed1' },
  { username: 'bj_sales_李明', password: '123456', label: '北京-销售', color: '#52c41a' },
  { username: 'sh_admin', password: '123456', label: '上海-管理员', color: '#fa8c16' },
];

const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const doLogin = async (username: string, password: string) => {
    setLoading(true);
    try {
      await login(username, password);
      Toast.show({ icon: 'success', content: '登录成功' });
      navigate('/', { replace: true });
    } catch (error: any) {
      Toast.show({
        icon: 'fail',
        content: error.response?.data?.detail || '登录失败',
      });
    } finally {
      setLoading(false);
    }
  };

  const onFinish = (values: { username: string; password: string }) => {
    doLogin(values.username, values.password);
  };

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      padding: '0 24px',
      background: 'linear-gradient(180deg, #e8f4ff 0%, #fff 50%)',
    }}>
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <h1 style={{ fontSize: 24, color: '#1677ff', marginBottom: 8 }}>外勤管理系统</h1>
        <p style={{ color: '#999', fontSize: 14 }}>员工移动端</p>
      </div>

      <Form
        onFinish={onFinish}
        layout="horizontal"
        style={{ '--border-inner': 'none', '--border-top': 'none', '--border-bottom': 'none' } as any}
        footer={
          <Button
            block
            type="submit"
            color="primary"
            size="large"
            loading={loading}
            style={{ marginTop: 16 }}
          >
            登录
          </Button>
        }
      >
        <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
          <Input placeholder="用户名" clearable style={{
            '--font-size': '16px',
            padding: '12px 16px',
            background: '#f5f5f5',
            borderRadius: 8,
          } as any} />
        </Form.Item>
        <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
          <Input type="password" placeholder="密码" clearable style={{
            '--font-size': '16px',
            padding: '12px 16px',
            background: '#f5f5f5',
            borderRadius: 8,
          } as any} />
        </Form.Item>
      </Form>

      <Divider style={{ margin: '24px 0 16px', color: '#999', fontSize: 12 }}>
        测试快捷登录
      </Divider>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
        {testAccounts.map((acc) => (
          <Tag
            key={acc.username}
            color="default"
            fill="outline"
            style={{
              '--border-color': acc.color,
              '--text-color': acc.color,
              padding: '4px 10px',
              fontSize: 12,
            } as any}
            onClick={() => doLogin(acc.username, acc.password)}
          >
            {acc.label}
          </Tag>
        ))}
      </div>

      <p style={{ textAlign: 'center', color: '#ccc', fontSize: 11, marginTop: 16 }}>
        测试期间可用，正式环境请移除
      </p>
    </div>
  );
};

export default Login;
