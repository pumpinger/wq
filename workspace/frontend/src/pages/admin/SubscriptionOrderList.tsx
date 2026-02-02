import React, { useState } from 'react';
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  DatePicker,
  Tag,
  Checkbox,
  message,
  Card,
  Row,
  Col,
} from 'antd';
import { PlusOutlined, EditOutlined, CheckCircleOutlined, StopOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { subscriptionApi, tenantApi } from '../../api';
import { queryKeys } from '../../api/queryKeys';
import type { SubscriptionOrder } from '../../types';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

const MODULE_OPTIONS = [
  { label: '客户管理', value: 'customer' },
  { label: '考勤管理', value: 'attendance' },
  { label: '拜访管理', value: 'visit' },
];

const MODULE_LABEL_MAP: Record<string, string> = {
  customer: '客户管理',
  attendance: '考勤管理',
  visit: '拜访管理',
};

const STATUS_MAP: Record<string, { color: string; text: string }> = {
  pending: { color: 'orange', text: '待激活' },
  active: { color: 'green', text: '生效中' },
  expired: { color: 'red', text: '已过期' },
  cancelled: { color: 'default', text: '已取消' },
};

const SubscriptionOrderList: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<SubscriptionOrder | null>(null);
  const [filters, setFilters] = useState<{ status?: string; keyword?: string }>({});
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  // 获取订阅订单列表
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.subscriptions.list(filters),
    queryFn: async () => {
      const params: any = { page: 1, page_size: 100 };
      if (filters.status) params.status = filters.status;
      const response = await subscriptionApi.list(params);
      return response.data;
    },
  });

  // 获取租户列表（用于下拉选择）
  const { data: tenantData } = useQuery({
    queryKey: queryKeys.tenants.list(),
    queryFn: async () => {
      const response = await tenantApi.list({ page: 1, page_size: 500 });
      return response.data;
    },
  });

  // 创建订单
  const createMutation = useMutation({
    mutationFn: (data: any) => subscriptionApi.create(data),
    onSuccess: () => {
      message.success('订阅订单创建成功');
      queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions.all });
      setIsModalOpen(false);
      form.resetFields();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || '创建失败');
    },
  });

  // 更新订单
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => subscriptionApi.update(id, data),
    onSuccess: () => {
      message.success('订阅订单更新成功');
      queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions.all });
      setIsModalOpen(false);
      setEditingOrder(null);
      form.resetFields();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || '更新失败');
    },
  });

  // 激活订单
  const activateMutation = useMutation({
    mutationFn: (id: number) => subscriptionApi.activate(id),
    onSuccess: () => {
      message.success('订单已激活');
      queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions.all });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || '激活失败');
    },
  });

  // 取消订单
  const cancelMutation = useMutation({
    mutationFn: (id: number) => subscriptionApi.cancel(id),
    onSuccess: () => {
      message.success('订单已取消');
      queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions.all });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || '取消失败');
    },
  });

  const handleOpenModal = (order?: SubscriptionOrder) => {
    if (order) {
      setEditingOrder(order);
      const enabledModules = Object.entries(order.modules)
        .filter(([, enabled]) => enabled)
        .map(([key]) => key);
      form.setFieldsValue({
        tenant_id: order.tenant_id,
        tenant_name: order.tenant_name,
        modules: enabledModules,
        max_users: order.max_users,
        amount: order.amount,
        date_range: [dayjs(order.start_date), dayjs(order.end_date)],
        remark: order.remark,
      });
    } else {
      setEditingOrder(null);
      form.resetFields();
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const modulesObj: Record<string, boolean> = {};
      MODULE_OPTIONS.forEach((m) => {
        modulesObj[m.value] = (values.modules || []).includes(m.value);
      });

      const payload: any = {
        modules: modulesObj,
        max_users: values.max_users,
        amount: values.amount,
        start_date: values.date_range[0].format('YYYY-MM-DD'),
        end_date: values.date_range[1].format('YYYY-MM-DD'),
        remark: values.remark,
      };

      if (values.tenant_id) {
        payload.tenant_id = values.tenant_id;
      }
      if (values.tenant_name) {
        payload.tenant_name = values.tenant_name;
      }

      if (editingOrder) {
        updateMutation.mutate({ id: editingOrder.id, data: payload });
      } else {
        createMutation.mutate(payload);
      }
    } catch {
      // 表单验证失败
    }
  };

  const handleActivate = (id: number) => {
    Modal.confirm({
      title: '确认激活',
      content: '确定要激活该订阅订单吗？激活后将立即生效。',
      okText: '确定',
      cancelText: '取消',
      onOk: () => activateMutation.mutateAsync(id),
    });
  };

  const handleCancel = (id: number) => {
    Modal.confirm({
      title: '确认取消',
      content: '确定要取消该订阅订单吗？取消后将无法恢复。',
      okText: '确定',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: () => cancelMutation.mutateAsync(id),
    });
  };

  // 过滤数据（前端按租户名称搜索）
  const filteredItems = (() => {
    const items = data?.items || [];
    if (!filters.keyword) return items;
    return items.filter((item: SubscriptionOrder) =>
      item.tenant_name?.includes(filters.keyword!)
    );
  })();

  const columns = [
    {
      title: '订单号',
      dataIndex: 'order_no',
      key: 'order_no',
      width: 160,
    },
    {
      title: '租户名称',
      dataIndex: 'tenant_name',
      key: 'tenant_name',
      width: 120,
    },
    {
      title: '订阅模块',
      dataIndex: 'modules',
      key: 'modules',
      width: 200,
      render: (modules: Record<string, boolean>) => {
        const enabled = Object.entries(modules || {})
          .filter(([, v]) => v)
          .map(([k]) => k);
        return (
          <Space size={2} wrap>
            {enabled.map((key) => (
              <Tag key={key} color="blue">{MODULE_LABEL_MAP[key] || key}</Tag>
            ))}
          </Space>
        );
      },
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 90,
      render: (amount: number | string) => `¥${Number(amount || 0).toFixed(2)}`,
    },
    {
      title: '有效期',
      key: 'date_range',
      width: 180,
      render: (_: any, record: SubscriptionOrder) =>
        `${record.start_date} ~ ${record.end_date}`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (status: string) => {
        const info = STATUS_MAP[status] || { color: 'default', text: status };
        return <Tag color={info.color}>{info.text}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right' as const,
      render: (_: any, record: SubscriptionOrder) => (
        <Space size={4}>
          {record.status === 'pending' && (
            <>
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleOpenModal(record)}
              >
                编辑
              </Button>
              <Button
                type="link"
                size="small"
                icon={<CheckCircleOutlined />}
                style={{ color: '#52c41a' }}
                onClick={() => handleActivate(record.id)}
              >
                激活
              </Button>
            </>
          )}
          {(record.status === 'pending' || record.status === 'active') && (
            <Button
              type="link"
              size="small"
              danger
              icon={<StopOutlined />}
              onClick={() => handleCancel(record.id)}
            >
              取消
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Card
      title="订阅订单管理"
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>
          新建订单
        </Button>
      }
    >
      {/* 筛选栏 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col>
          <Select
            allowClear
            placeholder="订单状态"
            style={{ width: 140 }}
            value={filters.status}
            onChange={(value) => setFilters((prev) => ({ ...prev, status: value }))}
            options={[
              { label: '待激活', value: 'pending' },
              { label: '生效中', value: 'active' },
              { label: '已过期', value: 'expired' },
              { label: '已取消', value: 'cancelled' },
            ]}
          />
        </Col>
        <Col>
          <Input.Search
            placeholder="搜索租户名称"
            allowClear
            style={{ width: 200 }}
            onSearch={(value) => setFilters((prev) => ({ ...prev, keyword: value || undefined }))}
          />
        </Col>
      </Row>

      <Table
        columns={columns}
        dataSource={filteredItems}
        rowKey="id"
        loading={isLoading}
        scroll={{ x: 1020 }}
        pagination={{
          total: filteredItems.length,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
        }}
      />

      {/* 新建/编辑 Modal */}
      <Modal
        title={editingOrder ? '编辑订阅订单' : '新建订阅订单'}
        open={isModalOpen}
        onOk={handleSubmit}
        onCancel={() => {
          setIsModalOpen(false);
          setEditingOrder(null);
          form.resetFields();
        }}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        width={600}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 24 }}>
          <Form.Item
            label="关联租户"
            extra="选择已有租户或手动输入新租户名称"
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              <Form.Item name="tenant_id" noStyle>
                <Select
                  allowClear
                  showSearch
                  placeholder="选择已有租户"
                  optionFilterProp="label"
                  style={{ width: '100%' }}
                  options={(tenantData?.items || []).map((t: any) => ({
                    label: t.name,
                    value: t.id,
                  }))}
                  onChange={(value) => {
                    if (value) {
                      const tenant = (tenantData?.items || []).find((t: any) => t.id === value);
                      if (tenant) {
                        form.setFieldsValue({ tenant_name: tenant.name });
                      }
                    }
                  }}
                />
              </Form.Item>
              <Form.Item
                name="tenant_name"
                noStyle
                rules={[{ required: true, message: '请选择租户或输入新租户名称' }]}
              >
                <Input placeholder="或输入新租户名称" />
              </Form.Item>
            </Space>
          </Form.Item>

          <Form.Item
            name="modules"
            label="订阅模块"
            rules={[{ required: true, message: '请选择至少一个模块' }]}
          >
            <Checkbox.Group options={MODULE_OPTIONS} />
          </Form.Item>

          <Form.Item
            name="max_users"
            label="最大用户数"
            rules={[{ required: true, message: '请输入最大用户数' }]}
            initialValue={10}
          >
            <InputNumber min={1} max={9999} style={{ width: '100%' }} placeholder="请输入最大用户数" />
          </Form.Item>

          <Form.Item
            name="amount"
            label="金额"
            rules={[{ required: true, message: '请输入金额' }]}
            initialValue={0}
          >
            <InputNumber min={0} precision={2} style={{ width: '100%' }} prefix="¥" placeholder="请输入金额" />
          </Form.Item>

          <Form.Item
            name="date_range"
            label="有效期"
            rules={[{ required: true, message: '请选择有效期' }]}
          >
            <RangePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={3} placeholder="请输入备注信息" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default SubscriptionOrderList;
