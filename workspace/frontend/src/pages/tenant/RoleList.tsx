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
  Divider,
  Row,
  Col,
  Tooltip,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, LockOutlined, EyeOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { roleApi } from '../../api';
import { queryKeys } from '../../api/queryKeys';

interface Permission {
  id: number;
  module: string;
  action: string;
  name: string;
  description?: string;
}

interface PermissionWithScope extends Permission {
  data_scope: string;
}

interface Role {
  id: number;
  name: string;
  code: string;
  description?: string;
  is_system: boolean;
  data_scope: string;
  tenant_id?: number;
  permissions: PermissionWithScope[];
}

// 权限配置：权限ID -> 数据范围
interface PermissionConfig {
  [permissionId: number]: string;
}

const scopeOptions = [
  { value: 'self', label: '仅自己', color: 'default' },
  { value: 'team', label: '团队', color: 'blue' },
  { value: 'all', label: '全部', color: 'green' },
];

const RoleList: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [viewingRole, setViewingRole] = useState<Role | null>(null);
  // 存储 权限ID -> 数据范围 的映射
  const [permissionConfig, setPermissionConfig] = useState<PermissionConfig>({});
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  // 获取角色列表
  const { data: roles, isLoading } = useQuery({
    queryKey: queryKeys.roles.list(),
    queryFn: async () => {
      const response = await roleApi.list();
      return response.data as Role[];
    },
  });

  // 获取权限列表
  const { data: permissions } = useQuery({
    queryKey: queryKeys.roles.permissions(),
    queryFn: async () => {
      const response = await roleApi.getPermissions();
      return response.data as Permission[];
    },
  });

  // 创建角色
  const createMutation = useMutation({
    mutationFn: (data: any) => roleApi.create(data),
    onSuccess: () => {
      message.success('角色创建成功');
      queryClient.invalidateQueries({ queryKey: queryKeys.roles.all });
      handleCloseModal();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || '创建失败');
    },
  });

  // 更新角色
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => roleApi.update(id, data),
    onSuccess: () => {
      message.success('角色更新成功');
      queryClient.invalidateQueries({ queryKey: queryKeys.roles.all });
      handleCloseModal();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || '更新失败');
    },
  });

  // 删除角色
  const deleteMutation = useMutation({
    mutationFn: (id: number) => roleApi.delete(id),
    onSuccess: () => {
      message.success('角色删除成功');
      queryClient.invalidateQueries({ queryKey: queryKeys.roles.all });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || '删除失败');
    },
  });

  const handleOpenModal = (role?: Role) => {
    if (role) {
      setEditingRole(role);
      form.setFieldsValue({
        name: role.name,
        code: role.code,
        description: role.description,
        data_scope: role.data_scope,
      });
      // 从角色的权限中构建配置
      const config: PermissionConfig = {};
      role.permissions.forEach(p => {
        config[p.id] = p.data_scope || 'self';
      });
      setPermissionConfig(config);
    } else {
      setEditingRole(null);
      form.resetFields();
      setPermissionConfig({});
    }
    setIsModalOpen(true);
  };

  const handleViewRole = (role: Role) => {
    setViewingRole(role);
    setIsViewModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingRole(null);
    form.resetFields();
    setPermissionConfig({});
  };

  // 切换权限选中状态
  const togglePermission = (permId: number, checked: boolean, defaultScope: string) => {
    if (checked) {
      setPermissionConfig(prev => ({ ...prev, [permId]: defaultScope }));
    } else {
      setPermissionConfig(prev => {
        const next = { ...prev };
        delete next[permId];
        return next;
      });
    }
  };

  // 更改权限的数据范围
  const changePermissionScope = (permId: number, scope: string) => {
    setPermissionConfig(prev => ({ ...prev, [permId]: scope }));
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      // 构建权限数组（带数据范围）
      const permissionsData = Object.entries(permissionConfig).map(([id, scope]) => ({
        permission_id: parseInt(id),
        data_scope: scope,
      }));

      const data = {
        ...values,
        permissions: permissionsData,
      };

      if (editingRole) {
        updateMutation.mutate({ id: editingRole.id, data });
      } else {
        createMutation.mutate(data);
      }
    } catch (error) {
      // 表单验证失败
    }
  };

  // 按模块分组权限
  const groupedPermissions = React.useMemo(() => {
    if (!permissions) return {};
    const groups: Record<string, Permission[]> = {};
    permissions.forEach(p => {
      if (!groups[p.module]) {
        groups[p.module] = [];
      }
      groups[p.module].push(p);
    });
    return groups;
  }, [permissions]);

  const moduleLabels: Record<string, string> = {
    customer: '客户管理',
    template: '模板管理',
    field: '字段管理',
    user: '员工管理',
    role: '角色管理',
  };

  const columns = [
    {
      title: '角色名称',
      dataIndex: 'name',
      key: 'name',
      width: 160,
      render: (name: string, record: Role) => (
        <Space>
          {name}
          {record.is_system && <Tag color="blue">系统</Tag>}
        </Space>
      ),
    },
    {
      title: '角色编码',
      dataIndex: 'code',
      key: 'code',
      width: 130,
    },
    {
      title: '权限数量',
      dataIndex: 'permissions',
      key: 'permissions',
      width: 100,
      render: (perms: PermissionWithScope[]) => perms?.length || 0,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      render: (desc: string) => desc || '-',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Role) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleViewRole(record)}
          >
            查看
          </Button>
          {record.is_system ? (
            <Button type="link" disabled icon={<LockOutlined />}>
              系统角色
            </Button>
          ) : (
            <>
              <Button
                type="link"
                icon={<EditOutlined />}
                onClick={() => handleOpenModal(record)}
              >
                编辑
              </Button>
              <Popconfirm
                title="确定删除该角色吗？"
                onConfirm={() => deleteMutation.mutate(record.id)}
                okText="确定"
                cancelText="取消"
              >
                <Button type="link" danger icon={<DeleteOutlined />}>
                  删除
                </Button>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Card
      title="角色管理"
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>
          新建角色
        </Button>
      }
    >
      <Table
        columns={columns}
        dataSource={roles || []}
        rowKey="id"
        loading={isLoading}
        scroll={{ x: 800 }}
        pagination={false}
      />

      {/* 查看角色权限弹窗 */}
      <Modal
        title={`角色权限 - ${viewingRole?.name}`}
        open={isViewModalOpen}
        onCancel={() => setIsViewModalOpen(false)}
        footer={null}
        width={600}
      >
        {viewingRole && (
          <div>
            <p style={{ color: '#666', marginBottom: 16 }}>
              {viewingRole.description || '暂无描述'}
            </p>
            {Object.entries(
              viewingRole.permissions.reduce((acc, p) => {
                if (!acc[p.module]) acc[p.module] = [];
                acc[p.module].push(p);
                return acc;
              }, {} as Record<string, PermissionWithScope[]>)
            ).map(([module, perms]) => (
              <div key={module} style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 500, marginBottom: 8 }}>
                  {moduleLabels[module] || module}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {perms.map(p => (
                    <Tag key={p.id}>
                      {p.name}
                      <span style={{ marginLeft: 4, color: '#999' }}>
                        ({scopeOptions.find(s => s.value === p.data_scope)?.label || '仅自己'})
                      </span>
                    </Tag>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* 编辑/新建角色弹窗 */}
      <Modal
        title={editingRole ? '编辑角色' : '新建角色'}
        open={isModalOpen}
        onOk={handleSubmit}
        onCancel={handleCloseModal}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        width={800}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 24 }}>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="name"
                label="角色名称"
                rules={[{ required: true, message: '请输入角色名称' }]}
              >
                <Input placeholder="请输入角色名称" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="code"
                label="角色编码"
                rules={[
                  { required: true, message: '请输入角色编码' },
                  { pattern: /^[a-z_]+$/, message: '只能包含小写字母和下划线' },
                ]}
              >
                <Input placeholder="如: sales_manager" disabled={!!editingRole} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="description" label="描述">
                <Input placeholder="请输入角色描述" />
              </Form.Item>
            </Col>
          </Row>

          <Divider>功能权限配置</Divider>
          <p style={{ color: '#666', marginBottom: 16 }}>
            勾选权限并为每个权限设置独立的数据范围
          </p>

          {Object.entries(groupedPermissions).map(([module, perms]) => (
            <div key={module} style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 500, marginBottom: 12, fontSize: 14 }}>
                {moduleLabels[module] || module}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {perms.map(p => {
                  const isSelected = permissionConfig[p.id] !== undefined;
                  const currentScope = permissionConfig[p.id] || 'self';
                  return (
                    <div
                      key={p.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '8px 12px',
                        background: isSelected ? '#f0f5ff' : '#fafafa',
                        borderRadius: 6,
                        border: isSelected ? '1px solid #1890ff' : '1px solid #f0f0f0',
                      }}
                    >
                      <Checkbox
                        checked={isSelected}
                        onChange={e => togglePermission(p.id, e.target.checked, 'self')}
                        style={{ flex: 1 }}
                      >
                        <Tooltip title={p.description}>
                          <span style={{ fontWeight: isSelected ? 500 : 400 }}>
                            {p.name}
                          </span>
                        </Tooltip>
                      </Checkbox>
                      {isSelected && (
                        <Select
                          size="small"
                          value={currentScope}
                          onChange={v => changePermissionScope(p.id, v)}
                          style={{ width: 100 }}
                          options={scopeOptions.map(s => ({ value: s.value, label: s.label }))}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </Form>
      </Modal>
    </Card>
  );
};

export default RoleList;
