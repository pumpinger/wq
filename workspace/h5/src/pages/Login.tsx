import React, { useState } from 'react';
import { Form, Input, Button, Toast } from 'antd-mobile';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      await login(values.username, values.password);
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
    </div>
  );
};

export default Login;
