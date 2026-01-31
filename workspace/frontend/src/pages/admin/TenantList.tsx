import React, { useState } from 'react';
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  DatePicker,
  Tag,
  message,
  Popconfirm,
  Card,
  Switch,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, LoginOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tenantApi } from '../../api';
import { queryKeys } from '../../api/queryKeys';
import { useAuth } from '../../contexts/AuthContext';
import type { TenantInfo } from '../../contexts/AuthContext';
import dayjs from 'dayjs';

interface Tenant {
  id: number;
  name: string;
  code: string;
  status: string;
  max_users: number;
  expires_at?: string;
  contact_name?: string;
  contact_phone?: string;
  enable_region_scope?: boolean;
  user_count: number;
  created_at: string;
}

const TenantList: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();
  const { enterTenant } = useAuth();

  // 进入租户管理模式
  const handleEnterTenant = (tenant: Tenant) => {
    const tenantInfo: TenantInfo = {
      id: tenant.id,
      name: tenant.name,
      code: tenant.code,
      status: tenant.status,
    };
    enterTenant(tenantInfo);
  };

  // 获取租户列表
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.tenants.list(),
    queryFn: async () => {
      const response = await tenantApi.list({ page: 1, page_size: 100 });
      return response.data;
    },
  });

  // 创建租户
  const createMutation = useMutation({
    mutationFn: (data: any) => tenantApi.create(data),
    onSuccess: () => {
      message.success('租户创建成功');
      queryClient.invalidateQueries({ queryKey: queryKeys.tenants.all });
      setIsModalOpen(false);
      form.resetFields();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || '创建失败');
    },
  });

  // 更新租户
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => tenantApi.update(id, data),
    onSuccess: () => {
      message.success('租户更新成功');
      queryClient.invalidateQueries({ queryKey: queryKeys.tenants.all });
      setIsModalOpen(false);
      setEditingTenant(null);
      form.resetFields();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || '更新失败');
    },
  });

  // 删除租户
  const deleteMutation = useMutation({
    mutationFn: (id: number) => tenantApi.delete(id),
    onSuccess: () => {
      message.success('租户删除成功');
      queryClient.invalidateQueries({ queryKey: queryKeys.tenants.all });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || '删除失败');
    },
  });

  const handleOpenModal = (tenant?: Tenant) => {
    if (tenant) {
      setEditingTenant(tenant);
      form.setFieldsValue({
        ...tenant,
        expires_at: tenant.expires_at ? dayjs(tenant.expires_at) : undefined,
        enable_region_scope: tenant.enable_region_scope || false,
      });
    } else {
      setEditingTenant(null);
      form.resetFields();
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const data = {
        ...values,
        expires_at: values.expires_at?.format('YYYY-MM-DD'),
      };

      if (editingTenant) {
        // 更新时移除创建租户时的字段
        const { admin_username, admin_password, admin_real_name, code, ...updateData } = data;
        updateMutation.mutate({ id: editingTenant.id, data: updateData });
      } else {
        createMutation.mutate(data);
      }
    } catch (error) {
      // 表单验证失败
    }
  };

  const columns = [
    {
      title: '租户名称',
      dataIndex: 'name',
      key: 'name',
      width: 120,
    },
    {
      title: '租户编码',
      dataIndex: 'code',
      key: 'code',
      width: 100,
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
          suspended: 'red',
        };
        const textMap: Record<string, string> = {
          active: '正常',
          inactive: '停用',
          suspended: '暂停',
        };
        return <Tag color={colorMap[status]}>{textMap[status]}</Tag>;
      },
    },
    {
      title: '区域权限',
      dataIndex: 'enable_region_scope',
      key: 'enable_region_scope',
      width: 100,
      render: (enabled: boolean) => enabled ? <Tag color="blue">已启用</Tag> : <Tag>未启用</Tag>,
    },
    {
      title: '用户数',
      key: 'user_count',
      width: 100,
      render: (_: any, record: Tenant) => `${record.user_count} / ${record.max_users}`,
    },
    {
      title: '到期时间',
      dataIndex: 'expires_at',
      key: 'expires_at',
      width: 120,
      render: (date: string) => date || '-',
    },
    {
      title: '联系人',
      dataIndex: 'contact_name',
      key: 'contact_name',
      width: 100,
      render: (name: string) => name || '-',
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
      render: (_: any, record: Tenant) => (
        <Space size={4}>
          <Button type="primary" size="small" icon={<LoginOutlined />} onClick={() => handleEnterTenant(record)} disabled={record.status !== 'active'}>进入</Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleOpenModal(record)}>编辑</Button>
          <Popconfirm title="确定删除该租户吗？" description="删除后将同时删除租户下的所有用户和数据" onConfirm={() => deleteMutation.mutate(record.id)} okText="确定" cancelText="取消">
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card title="租户管理" extra={
      <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>
        新建租户
      </Button>
    }>
      <Table
        columns={columns}
        dataSource={data?.items || []}
        rowKey="id"
        loading={isLoading}
        scroll={{ x: 900 }}
        pagination={{
          total: data?.total || 0,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
        }}
      />

      <Modal
        title={editingTenant ? '编辑租户' : '新建租户'}
        open={isModalOpen}
        onOk={handleSubmit}
        onCancel={() => {
          setIsModalOpen(false);
          setEditingTenant(null);
          form.resetFields();
        }}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        width={600}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 24 }}>
          <Form.Item
            name="name"
            label="租户名称"
            rules={[{ required: true, message: '请输入租户名称' }]}
          >
            <Input placeholder="请输入租户名称" />
          </Form.Item>

          {!editingTenant && (
            <Form.Item
              name="code"
              label="租户编码"
              rules={[
                { required: true, message: '请输入租户编码' },
                { pattern: /^[a-zA-Z0-9_-]+$/, message: '只能包含字母、数字、下划线和横线' },
              ]}
            >
              <Input placeholder="请输入租户编码（唯一标识）" />
            </Form.Item>
          )}

          <Form.Item name="max_users" label="最大用户数" initialValue={10}>
            <InputNumber min={1} max={1000} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="expires_at" label="到期时间">
            <DatePicker style={{ width: '100%' }} placeholder="不填则永不过期" />
          </Form.Item>

          <Form.Item name="contact_name" label="联系人">
            <Input placeholder="请输入联系人姓名" />
          </Form.Item>

          <Form.Item name="contact_phone" label="联系电话">
            <Input placeholder="请输入联系电话" />
          </Form.Item>

          {!editingTenant && (
            <>
              <Form.Item
                name="admin_username"
                label="管理员用户名"
                rules={[{ required: true, message: '请输入管理员用户名' }]}
              >
                <Input placeholder="请输入管理员用户名" />
              </Form.Item>

              <Form.Item
                name="admin_password"
                label="管理员密码"
                rules={[
                  { required: true, message: '请输入管理员密码' },
                  { min: 6, message: '密码至少6位' },
                ]}
              >
                <Input.Password placeholder="请输入管理员密码" />
              </Form.Item>

              <Form.Item name="admin_real_name" label="管理员姓名">
                <Input placeholder="请输入管理员姓名" />
              </Form.Item>
            </>
          )}

          {editingTenant && (
            <Form.Item
              name="enable_region_scope"
              label="启用区域权限"
              valuePropName="checked"
            >
              <Switch checkedChildren="启用" unCheckedChildren="关闭" />
            </Form.Item>
          )}

          {editingTenant && (
            <Form.Item name="status" label="状态">
              <Input.Group compact>
                <Button
                  type={form.getFieldValue('status') === 'active' ? 'primary' : 'default'}
                  onClick={() => form.setFieldsValue({ status: 'active' })}
                >
                  正常
                </Button>
                <Button
                  type={form.getFieldValue('status') === 'inactive' ? 'primary' : 'default'}
                  onClick={() => form.setFieldsValue({ status: 'inactive' })}
                >
                  停用
                </Button>
                <Button
                  type={form.getFieldValue('status') === 'suspended' ? 'primary' : 'default'}
                  danger
                  onClick={() => form.setFieldsValue({ status: 'suspended' })}
                >
                  暂停
                </Button>
              </Input.Group>
            </Form.Item>
          )}
        </Form>
      </Modal>
    </Card>
  );
};

export default TenantList;
