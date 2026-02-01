import React, { useState } from 'react';
import { List, Button, Dialog, Toast, Card, Tag, Form, Input } from 'antd-mobile';
import { UserOutline, LockOutline, InformationCircleOutline } from 'antd-mobile-icons';
import { useAuth } from '../../contexts/AuthContext';
import { authApi } from '../../api';

const Profile: React.FC = () => {
  const { user, logout } = useAuth();
  const [showPwdForm, setShowPwdForm] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [form] = Form.useForm();

  const handleLogout = () => {
    Dialog.confirm({
      content: '确定退出登录？',
      onConfirm: () => {
        logout();
        Toast.show({ icon: 'success', content: '已退出' });
      },
    });
  };

  const handleChangePassword = async () => {
    try {
      const values = await form.validateFields();
      if (values.newPassword !== values.confirmPassword) {
        Toast.show({ icon: 'fail', content: '两次密码不一致' });
        return;
      }
      setPwdLoading(true);
      await authApi.changePassword(values.oldPassword, values.newPassword);
      Toast.show({ icon: 'success', content: '密码修改成功，请重新登录' });
      setShowPwdForm(false);
      form.resetFields();
      logout();
    } catch (err: any) {
      Toast.show({ icon: 'fail', content: err.response?.data?.detail || '修改失败' });
    } finally {
      setPwdLoading(false);
    }
  };

  const roleText = user?.is_super_admin ? '超级管理员'
    : user?.role === 'tenant_admin' ? '管理员' : '员工';

  return (
    <div style={{ padding: 12, background: '#f5f5f5', minHeight: '100%' }}>
      {/* 用户信息卡片 */}
      <Card style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: '#1677ff', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20,
          }}>
            <UserOutline />
          </div>
          <div>
            <div style={{ fontWeight: 500, fontSize: 16 }}>{user?.real_name || user?.username}</div>
            <div style={{ color: '#999', fontSize: 13, marginTop: 2 }}>
              <Tag color="primary" fill="outline" style={{ '--font-size': '11px' } as any}>{roleText}</Tag>
              {user?.tenant_name && (
                <span style={{ marginLeft: 8 }}>{user.tenant_name}</span>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* 功能列表 */}
      <Card style={{ marginBottom: 12 }}>
        <List style={{ '--border-top': 'none', '--border-bottom': 'none' } as any}>
          <List.Item prefix={<LockOutline />} onClick={() => setShowPwdForm(true)} arrow>
            修改密码
          </List.Item>
          <List.Item prefix={<InformationCircleOutline />} extra="v2.0.0">
            关于系统
          </List.Item>
        </List>
      </Card>

      <Button block color="danger" fill="outline" onClick={handleLogout} style={{ marginTop: 24 }}>
        退出登录
      </Button>

      {/* 修改密码弹窗 */}
      <Dialog
        visible={showPwdForm}
        title="修改密码"
        content={
          <Form form={form} layout="horizontal" style={{ '--border-top': 'none' } as any}>
            <Form.Item name="oldPassword" label="原密码" rules={[{ required: true }]}>
              <Input type="password" placeholder="请输入原密码" />
            </Form.Item>
            <Form.Item name="newPassword" label="新密码" rules={[{ required: true }, { min: 6, type: 'string', message: '至少6位' }]}>
              <Input type="password" placeholder="请输入新密码" />
            </Form.Item>
            <Form.Item name="confirmPassword" label="确认密码" rules={[{ required: true }]}>
              <Input type="password" placeholder="再次输入新密码" />
            </Form.Item>
          </Form>
        }
        actions={[
          [
            { key: 'cancel', text: '取消', onClick: () => { setShowPwdForm(false); form.resetFields(); } },
            { key: 'confirm', text: '确定', bold: true, onClick: handleChangePassword },
          ],
        ]}
      />
    </div>
  );
};

export default Profile;
