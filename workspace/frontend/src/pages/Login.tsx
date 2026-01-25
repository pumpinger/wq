import React, { useState } from 'react';
import { Form, Input, Button, Card, message, Typography, Divider, Space, Tag } from 'antd';
import { UserOutlined, LockOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';

const { Title, Text } = Typography;

interface LoginFormData {
  username: string;
  password: string;
}

interface LoginProps {
  onSuccess?: () => void;
}

// 测试账号列表 (密码统一为 123456)
const testAccounts = [
  { username: 'superadmin', password: '123456', label: '超级管理员', color: 'red' },
  { username: 'bj_admin', password: '123456', label: '北京-管理员', color: 'blue' },
  { username: 'bj_manager_张伟', password: '123456', label: '北京-经理(团队)', color: 'geekblue' },
  { username: 'bj_sales_李明', password: '123456', label: '北京-销售(仅自己)', color: 'green' },
  { username: 'bj_sales_陈杰', password: '123456', label: '北京-销售(全部)', color: 'orange' },
  { username: 'sh_admin', password: '123456', label: '上海-管理员', color: 'purple' },
];

const Login: React.FC<LoginProps> = ({ onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const { login } = useAuth();
  const queryClient = useQueryClient();

  const handleSubmit = async (values: LoginFormData) => {
    setLoading(true);
    try {
      // 登录前清除所有缓存，避免看到其他用户的数据
      queryClient.clear();
      await login(values.username, values.password);
      message.success('登录成功');
      onSuccess?.();
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || '登录失败，请检查用户名和密码';
      message.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (username: string, password: string) => {
    setLoading(true);
    try {
      // 登录前清除所有缓存，避免看到其他用户的数据
      queryClient.clear();
      await login(username, password);
      message.success('登录成功');
      onSuccess?.();
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || '登录失败';
      message.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
    >
      <Card
        style={{
          width: 420,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          borderRadius: 8,
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={3} style={{ marginBottom: 8 }}>
            外勤管理系统
          </Title>
          <Text type="secondary">SaaS 多租户平台</Text>
        </div>

        <Form
          form={form}
          name="login"
          onFinish={handleSubmit}
          size="large"
          initialValues={{ remember: true }}
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="用户名"
              autoComplete="username"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="密码"
              autoComplete="current-password"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              style={{ height: 44 }}
            >
              登 录
            </Button>
          </Form.Item>
        </Form>

        <Divider style={{ margin: '16px 0' }}>
          <Space>
            <ThunderboltOutlined />
            <Text type="secondary" style={{ fontSize: 12 }}>测试快速登录</Text>
          </Space>
        </Divider>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          {testAccounts.map((account) => (
            <Button
              key={account.username}
              size="small"
              onClick={() => handleQuickLogin(account.username, account.password)}
              disabled={loading}
              style={{ marginBottom: 4 }}
            >
              <Tag color={account.color} style={{ margin: 0 }}>{account.label}</Tag>
            </Button>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Text type="secondary" style={{ fontSize: 11 }}>
            测试期间可使用快速登录，正式环境请移除
          </Text>
        </div>
      </Card>
    </div>
  );
};

export default Login;
