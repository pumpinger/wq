import React, { useState } from 'react';
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  Tag,
  message,
  Popconfirm,
  Card,
  Checkbox,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SafetyOutlined, EnvironmentOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userApi, roleApi, regionApi } from '../../api';
import { queryKeys } from '../../api/queryKeys';
import dayjs from 'dayjs';
import type { Region } from '../../types';

interface User {
  id: number;
  username: string;
  real_name?: string;
  email?: string;
  phone?: string;
  role: string;
  status: string;
  is_super_admin: boolean;
  tenant_id?: number;
  manager_id?: number;
  data_scope?: string;
  created_at: string;
}

interface Role {
  id: number;
  name: string;
  code: string;
  is_system: boolean;
  data_scope: string;
}

const UserList: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isRegionModalOpen, setIsRegionModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [roleAssignUser, setRoleAssignUser] = useState<User | null>(null);
  const [regionAssignUser, setRegionAssignUser] = useState<User | null>(null);
  const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([]);
  const [selectedRegionIds, setSelectedRegionIds] = useState<number[]>([]);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  // 获取用户列表
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.users.list(),
    queryFn: async () => {
      const response = await userApi.list({ page: 1, page_size: 100 });
      return response.data;
    },
  });

  // 获取角色列表
  const { data: roles } = useQuery({
    queryKey: queryKeys.roles.list(),
    queryFn: async () => {
      const response = await roleApi.list();
      return response.data as Role[];
    },
  });

  // 获取区域列表
  const { data: regions } = useQuery({
    queryKey: queryKeys.regions.list(),
    queryFn: async () => {
      const response = await regionApi.list();
      return response.data?.items as Region[] || [];
    },
  });

  // 创建用户
  const createMutation = useMutation({
    mutationFn: (data: any) => userApi.create(data),
    onSuccess: () => {
      message.success('用户创建成功');
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.users.options() });
      setIsModalOpen(false);
      form.resetFields();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || '创建失败');
    },
  });

  // 更新用户
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => userApi.update(id, data),
    onSuccess: () => {
      message.success('用户更新成功');
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.users.options() });
      setIsModalOpen(false);
      setEditingUser(null);
      form.resetFields();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || '更新失败');
    },
  });

  // 删除用户
  const deleteMutation = useMutation({
    mutationFn: (id: number) => userApi.delete(id),
    onSuccess: () => {
      message.success('用户删除成功');
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.users.options() });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || '删除失败');
    },
  });

  // 分配角色
  const assignRolesMutation = useMutation({
    mutationFn: ({ userId, roleIds }: { userId: number; roleIds: number[] }) =>
      roleApi.assignUserRoles(userId, roleIds),
    onSuccess: () => {
      message.success('角色分配成功');
      setIsRoleModalOpen(false);
      setRoleAssignUser(null);
      setSelectedRoleIds([]);
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || '分配失败');
    },
  });

  // 分配区域
  const assignRegionsMutation = useMutation({
    mutationFn: ({ userId, regionIds }: { userId: number; regionIds: number[] }) =>
      regionApi.assignUserRegions(userId, regionIds),
    onSuccess: () => {
      message.success('区域分配成功');
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.users.options() });
      setIsRegionModalOpen(false);
      setRegionAssignUser(null);
      setSelectedRegionIds([]);
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || '分配失败');
    },
  });

  // 获取可选为上级的用户列表（排除自己）
  const getManagerOptions = (excludeId?: number) => {
    const users = data?.items || [];
    return users.filter((u: User) => u.id !== excludeId);
  };

  const handleOpenModal = (user?: User) => {
    if (user) {
      setEditingUser(user);
      form.setFieldsValue({
        ...user,
        password: undefined, // 不回显密码
      });
    } else {
      setEditingUser(null);
      form.resetFields();
    }
    setIsModalOpen(true);
  };

  const handleOpenRoleModal = async (user: User) => {
    setRoleAssignUser(user);
    // 获取用户当前角色
    try {
      const response = await roleApi.getUserRoles(user.id);
      const userRoles = response.data as Role[];
      setSelectedRoleIds(userRoles.map(r => r.id));
    } catch (error) {
      setSelectedRoleIds([]);
    }
    setIsRoleModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      if (editingUser) {
        // 更新时如果没有填密码，移除密码字段
        const { username, ...updateData } = values;
        if (!updateData.password) {
          delete updateData.password;
        }
        updateMutation.mutate({ id: editingUser.id, data: updateData });
      } else {
        createMutation.mutate(values);
      }
    } catch (error) {
      // 表单验证失败
    }
  };

  const handleOpenRegionModal = async (user: User) => {
    setRegionAssignUser(user);
    try {
      const response = await regionApi.getUserRegions(user.id);
      setSelectedRegionIds(response.data.region_ids || []);
    } catch (error) {
      setSelectedRegionIds([]);
    }
    setIsRegionModalOpen(true);
  };

  const handleAssignRegions = () => {
    if (regionAssignUser) {
      assignRegionsMutation.mutate({
        userId: regionAssignUser.id,
        regionIds: selectedRegionIds,
      });
    }
  };

  const handleAssignRoles = () => {
    if (roleAssignUser) {
      assignRolesMutation.mutate({
        userId: roleAssignUser.id,
        roleIds: selectedRoleIds,
      });
    }
  };

  const columns = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      width: 100,
    },
    {
      title: '姓名',
      dataIndex: 'real_name',
      key: 'real_name',
      width: 80,
      render: (name: string) => name || '-',
    },
    {
      title: '手机号',
      dataIndex: 'phone',
      key: 'phone',
      width: 120,
      render: (phone: string) => phone || '-',
    },
    {
      title: '上级',
      dataIndex: 'manager_id',
      key: 'manager_id',
      width: 80,
      render: (managerId: number) => {
        if (!managerId) return '-';
        const manager = data?.items?.find((u: User) => u.id === managerId);
        return manager?.real_name || manager?.username || '-';
      },
    },
    {
      title: '数据权限',
      dataIndex: 'data_scope',
      key: 'data_scope',
      width: 100,
      render: (scope: string) => {
        const scopeMap: Record<string, { text: string; color: string }> = {
          self: { text: '仅自己', color: 'default' },
          team: { text: '团队', color: 'blue' },
          all: { text: '全部', color: 'green' },
        };
        const info = scopeMap[scope] || scopeMap.self;
        return <Tag color={info.color}>{info.text}</Tag>;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          active: 'green',
          inactive: 'gray',
        };
        const textMap: Record<string, string> = {
          active: '正常',
          inactive: '禁用',
        };
        return <Tag color={colorMap[status]}>{textMap[status]}</Tag>;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 100,
      render: (date: string) => dayjs(date).format('MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right' as const,
      render: (_: any, record: User) => (
        <Space size={0}>
          <Button type="link" size="small" onClick={() => handleOpenModal(record)}>编辑</Button>
          <Button type="link" size="small" onClick={() => handleOpenRoleModal(record)}>角色</Button>
          <Button type="link" size="small" onClick={() => handleOpenRegionModal(record)}>区域</Button>
          <Popconfirm title="确定删除该用户吗？" onConfirm={() => deleteMutation.mutate(record.id)} okText="确定" cancelText="取消">
            <Button type="link" size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card title="员工管理" extra={
      <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>
        新建员工
      </Button>
    }>
      <Table
        columns={columns}
        dataSource={data?.items || []}
        rowKey="id"
        loading={isLoading}
        scroll={{ x: 860 }}
        pagination={{
          total: data?.total || 0,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
        }}
      />

      {/* 编辑/新建用户弹窗 */}
      <Modal
        title={editingUser ? '编辑员工' : '新建员工'}
        open={isModalOpen}
        onOk={handleSubmit}
        onCancel={() => {
          setIsModalOpen(false);
          setEditingUser(null);
          form.resetFields();
        }}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        width={500}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 24 }}>
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: !editingUser, message: '请输入用户名' }]}
          >
            <Input placeholder="请输入用户名" disabled={!!editingUser} />
          </Form.Item>

          <Form.Item
            name="password"
            label={editingUser ? '新密码（不修改请留空）' : '密码'}
            rules={editingUser ? [] : [
              { required: true, message: '请输入密码' },
              { min: 6, message: '密码至少6位' },
            ]}
          >
            <Input.Password placeholder={editingUser ? '不修改请留空' : '请输入密码'} />
          </Form.Item>

          <Form.Item name="real_name" label="姓名">
            <Input placeholder="请输入姓名" />
          </Form.Item>

          <Form.Item name="phone" label="手机号">
            <Input placeholder="请输入手机号" />
          </Form.Item>

          <Form.Item name="email" label="邮箱">
            <Input placeholder="请输入邮箱" />
          </Form.Item>

          <Form.Item name="manager_id" label="直属上级">
            <Select allowClear placeholder="请选择直属上级">
              {getManagerOptions(editingUser?.id).map((user: User) => (
                <Select.Option key={user.id} value={user.id}>
                  {user.real_name || user.username}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          {editingUser && (
            <Form.Item name="status" label="状态" initialValue="active">
              <Select>
                <Select.Option value="active">正常</Select.Option>
                <Select.Option value="inactive">禁用</Select.Option>
              </Select>
            </Form.Item>
          )}
        </Form>
      </Modal>

      {/* 角色分配弹窗 */}
      <Modal
        title={`分配角色 - ${roleAssignUser?.real_name || roleAssignUser?.username}`}
        open={isRoleModalOpen}
        onOk={handleAssignRoles}
        onCancel={() => {
          setIsRoleModalOpen(false);
          setRoleAssignUser(null);
          setSelectedRoleIds([]);
        }}
        confirmLoading={assignRolesMutation.isPending}
      >
        <div style={{ marginTop: 16 }}>
          <p style={{ marginBottom: 16, color: '#666' }}>
            选择要分配给该员工的角色，角色决定了员工的功能权限和数据范围。
          </p>
          <Checkbox.Group
            value={selectedRoleIds}
            onChange={(values) => setSelectedRoleIds(values as number[])}
            style={{ width: '100%' }}
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              {roles?.map((role: Role) => (
                <Checkbox key={role.id} value={role.id} style={{ marginLeft: 0 }}>
                  <Space>
                    <span style={{ fontWeight: 500 }}>{role.name}</span>
                    {role.is_system && <Tag color="blue">系统</Tag>}
                    <Tag color={
                      role.data_scope === 'all' ? 'green' :
                      role.data_scope === 'team' ? 'blue' : 'default'
                    }>
                      {role.data_scope === 'all' ? '全部数据' :
                       role.data_scope === 'team' ? '团队数据' : '仅自己'}
                    </Tag>
                  </Space>
                </Checkbox>
              ))}
            </Space>
          </Checkbox.Group>
        </div>
      </Modal>

      {/* 区域分配弹窗 */}
      <Modal
        title={`分配区域 - ${regionAssignUser?.real_name || regionAssignUser?.username}`}
        open={isRegionModalOpen}
        onOk={handleAssignRegions}
        onCancel={() => {
          setIsRegionModalOpen(false);
          setRegionAssignUser(null);
          setSelectedRegionIds([]);
        }}
        confirmLoading={assignRegionsMutation.isPending}
      >
        <div style={{ marginTop: 16 }}>
          <p style={{ marginBottom: 16, color: '#666' }}>
            选择该员工负责的区域。启用区域权限后，员工只能操作负责区域内的客户。
          </p>
          <Checkbox.Group
            value={selectedRegionIds}
            onChange={(values) => setSelectedRegionIds(values as number[])}
            style={{ width: '100%' }}
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              {regions?.map((region: Region) => (
                <Checkbox key={region.id} value={region.id} style={{ marginLeft: 0 }}>
                  <Space>
                    <span style={{ fontWeight: 500 }}>{region.name}</span>
                    <Tag>{region.code}</Tag>
                  </Space>
                </Checkbox>
              ))}
            </Space>
          </Checkbox.Group>
          {(!regions || regions.length === 0) && (
            <p style={{ color: '#999', textAlign: 'center' }}>
              暂无区域数据，请先在"区域管理"中创建区域
            </p>
          )}
        </div>
      </Modal>
    </Card>
  );
};

export default UserList;
