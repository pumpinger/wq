import React, { useState } from 'react';
import {
  Table, Button, Space, Modal, message, Popconfirm, Tag, Select, DatePicker,
  Row, Col, Card, Drawer, Form, Input, Progress,
} from 'antd';
import {
  PlusOutlined, EyeOutlined, DeleteOutlined, SendOutlined, CloseCircleOutlined,
  ReloadOutlined, MinusCircleOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { visitPlanApi, visitTaskTypeApi, userApi, customerApi } from '../api';
import type { VisitPlan, VisitTaskType, Customer } from '../types';
import { queryKeys } from '../api/queryKeys';

const { RangePicker } = DatePicker;

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  draft: { color: 'default', label: '草稿' },
  published: { color: 'blue', label: '已发布' },
  in_progress: { color: 'processing', label: '进行中' },
  completed: { color: 'green', label: '已完成' },
  cancelled: { color: 'red', label: '已取消' },
};

const PRIORITY_OPTIONS = [
  { label: '高', value: 'high' },
  { label: '中', value: 'medium' },
  { label: '低', value: 'low' },
];

interface FilterState {
  date_from?: string;
  date_to?: string;
  assigned_to?: number;
  status?: string;
}

const VisitPlanList: React.FC = () => {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<FilterState>({});
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [viewingPlan, setViewingPlan] = useState<VisitPlan | undefined>();
  const [form] = Form.useForm();

  // 获取计划列表
  const { data: plans, isLoading } = useQuery({
    queryKey: queryKeys.visitPlans.list(filters),
    queryFn: () => visitPlanApi.list({ ...filters, limit: 200 }).then((res) => {
      const d = res.data;
      return (Array.isArray(d) ? d : d.items || d.data || []) as VisitPlan[];
    }),
  });

  // 获取用户列表
  const { data: users } = useQuery({
    queryKey: queryKeys.users.options(),
    queryFn: () => userApi.list({ page_size: 100 }).then((res) => res.data.items || []),
  });

  // 获取任务类型
  const { data: taskTypes } = useQuery({
    queryKey: queryKeys.visitTaskTypes.list({ active_only: true }),
    queryFn: () => visitTaskTypeApi.list({ active_only: true }).then((res) => {
      const d = res.data;
      return (Array.isArray(d) ? d : d.items || d.data || []) as VisitTaskType[];
    }),
  });

  // 获取客户列表
  const { data: customers } = useQuery({
    queryKey: queryKeys.customers.list({ limit: 500 }),
    queryFn: () => customerApi.list({ limit: 500 }).then((res) => {
      const d = res.data;
      return (Array.isArray(d) ? d : d.items || d.data || []) as Customer[];
    }),
  });

  // 创建计划
  const createMutation = useMutation({
    mutationFn: (data: any) => visitPlanApi.create(data),
    onSuccess: () => {
      message.success('创建成功');
      setDrawerVisible(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: queryKeys.visitPlans.all });
    },
    onError: (err: any) => {
      message.error(err.response?.data?.detail || '创建失败');
    },
  });

  // 发布
  const publishMutation = useMutation({
    mutationFn: (id: number) => visitPlanApi.publish(id),
    onSuccess: () => {
      message.success('发布成功');
      queryClient.invalidateQueries({ queryKey: queryKeys.visitPlans.all });
    },
    onError: (err: any) => {
      message.error(err.response?.data?.detail || '发布失败');
    },
  });

  // 取消
  const cancelMutation = useMutation({
    mutationFn: (id: number) => visitPlanApi.cancel(id),
    onSuccess: () => {
      message.success('已取消');
      queryClient.invalidateQueries({ queryKey: queryKeys.visitPlans.all });
    },
    onError: (err: any) => {
      message.error(err.response?.data?.detail || '取消失败');
    },
  });

  // 删除
  const deleteMutation = useMutation({
    mutationFn: (id: number) => visitPlanApi.delete(id),
    onSuccess: () => {
      message.success('删除成功');
      queryClient.invalidateQueries({ queryKey: queryKeys.visitPlans.all });
    },
    onError: (err: any) => {
      message.error(err.response?.data?.detail || '删除失败');
    },
  });

  const handleAdd = () => {
    form.resetFields();
    form.setFieldsValue({ tasks: [{}] });
    setDrawerVisible(true);
  };

  const handleView = async (record: VisitPlan) => {
    try {
      const res = await visitPlanApi.get(record.id);
      setViewingPlan(res.data as VisitPlan);
      setDetailVisible(true);
    } catch {
      message.error('获取详情失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        title: values.title,
        plan_date: values.plan_date.format('YYYY-MM-DD'),
        assigned_to: values.assigned_to,
        remark: values.remark || undefined,
        tasks: (values.tasks || []).filter((t: any) => t && t.customer_id).map((t: any, idx: number) => ({
          customer_id: t.customer_id,
          task_type_id: t.task_type_id,
          priority: t.priority || 'medium',
          sort_order: idx,
        })),
      };
      createMutation.mutate(payload);
    } catch {
      // validation error
    }
  };

  const handleResetFilters = () => {
    setFilters({});
  };

  const hasFilters = Object.values(filters).some((v) => v !== undefined && v !== '');

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 60,
    },
    {
      title: '计划标题',
      dataIndex: 'title',
      key: 'title',
      width: 200,
      ellipsis: true,
    },
    {
      title: '计划日期',
      dataIndex: 'plan_date',
      key: 'plan_date',
      width: 120,
      render: (text: string) => dayjs(text).format('YYYY-MM-DD'),
    },
    {
      title: '负责人',
      dataIndex: 'assignee_name',
      key: 'assignee_name',
      width: 100,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const info = STATUS_MAP[status] || { color: 'default', label: status };
        return <Tag color={info.color}>{info.label}</Tag>;
      },
    },
    {
      title: '任务数',
      dataIndex: 'task_count',
      key: 'task_count',
      width: 80,
      render: (val: number) => <Tag>{val}</Tag>,
    },
    {
      title: '进度',
      key: 'progress',
      width: 160,
      render: (_: any, record: VisitPlan) => {
        const pct = record.task_count > 0
          ? Math.round((record.completed_count / record.task_count) * 100)
          : 0;
        return (
          <Space>
            <Progress percent={pct} size="small" style={{ width: 80 }} />
            <span style={{ fontSize: 12, color: '#999' }}>
              {record.completed_count}/{record.task_count}
            </span>
          </Space>
        );
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 120,
      render: (text: string) => dayjs(text).format('MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      fixed: 'right' as const,
      render: (_: any, record: VisitPlan) => (
        <Space size={0}>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleView(record)}>
            查看
          </Button>
          {record.status === 'draft' && (
            <Popconfirm title="确认发布此计划?" onConfirm={() => publishMutation.mutate(record.id)}>
              <Button type="link" size="small" icon={<SendOutlined />}>发布</Button>
            </Popconfirm>
          )}
          {(record.status === 'draft' || record.status === 'published') && (
            <Popconfirm title="确认取消此计划?" onConfirm={() => cancelMutation.mutate(record.id)}>
              <Button type="link" size="small" icon={<CloseCircleOutlined />}>取消</Button>
            </Popconfirm>
          )}
          {record.status === 'draft' && (
            <Popconfirm title="确认删除此计划?" onConfirm={() => deleteMutation.mutate(record.id)}>
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* 筛选面板 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[16, 12]} align="middle">
          <Col>
            <RangePicker
              placeholder={['开始日期', '结束日期']}
              style={{ width: 240 }}
              value={[
                filters.date_from ? dayjs(filters.date_from) : null,
                filters.date_to ? dayjs(filters.date_to) : null,
              ]}
              onChange={(dates) => {
                setFilters({
                  ...filters,
                  date_from: dates?.[0]?.format('YYYY-MM-DD'),
                  date_to: dates?.[1]?.format('YYYY-MM-DD'),
                });
              }}
            />
          </Col>
          <Col>
            <Select
              placeholder="负责人"
              style={{ width: 130 }}
              allowClear
              value={filters.assigned_to}
              onChange={(v) => setFilters({ ...filters, assigned_to: v })}
            >
              {users?.map((u: any) => (
                <Select.Option key={u.id} value={u.id}>{u.real_name || u.username}</Select.Option>
              ))}
            </Select>
          </Col>
          <Col>
            <Select
              placeholder="状态"
              style={{ width: 120 }}
              allowClear
              value={filters.status}
              onChange={(v) => setFilters({ ...filters, status: v })}
            >
              {Object.entries(STATUS_MAP).map(([k, v]) => (
                <Select.Option key={k} value={k}>{v.label}</Select.Option>
              ))}
            </Select>
          </Col>
          {hasFilters && (
            <Col>
              <Button icon={<ReloadOutlined />} onClick={handleResetFilters}>重置</Button>
            </Col>
          )}
          <Col flex="auto" style={{ textAlign: 'right' }}>
            <Tag color="blue">{plans?.length || 0} 条记录</Tag>
          </Col>
        </Row>
      </Card>

      {/* 操作栏 */}
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新建计划
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={plans}
        rowKey="id"
        loading={isLoading}
        scroll={{ x: 1100 }}
        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
      />

      {/* 新建计划 Drawer */}
      <Drawer
        title="新建拜访计划"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={700}
        extra={
          <Space>
            <Button onClick={() => setDrawerVisible(false)}>取消</Button>
            <Button type="primary" onClick={handleSubmit} loading={createMutation.isPending}>
              保存
            </Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="title" label="计划标题" rules={[{ required: true, message: '请输入标题' }]}>
                <Input placeholder="如：2025-01-15 拜访计划" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="plan_date" label="计划日期" rules={[{ required: true, message: '请选择日期' }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="assigned_to" label="执行人" rules={[{ required: true, message: '请选择执行人' }]}>
            <Select placeholder="选择执行人" showSearch optionFilterProp="children">
              {users?.map((u: any) => (
                <Select.Option key={u.id} value={u.id}>{u.real_name || u.username}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} placeholder="计划备注" />
          </Form.Item>

          <Card size="small" title="拜访任务列表" style={{ marginBottom: 16 }}>
            <Form.List name="tasks">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...restField }) => (
                    <Row key={key} gutter={8} align="middle" style={{ marginBottom: 8 }}>
                      <Col span={9}>
                        <Form.Item
                          {...restField}
                          name={[name, 'customer_id']}
                          rules={[{ required: true, message: '选择客户' }]}
                          style={{ marginBottom: 0 }}
                        >
                          <Select placeholder="选择客户" showSearch optionFilterProp="children" size="small">
                            {customers?.map((c) => (
                              <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>
                            ))}
                          </Select>
                        </Form.Item>
                      </Col>
                      <Col span={7}>
                        <Form.Item
                          {...restField}
                          name={[name, 'task_type_id']}
                          rules={[{ required: true, message: '选择类型' }]}
                          style={{ marginBottom: 0 }}
                        >
                          <Select placeholder="任务类型" size="small">
                            {taskTypes?.map((t) => (
                              <Select.Option key={t.id} value={t.id}>{t.name}</Select.Option>
                            ))}
                          </Select>
                        </Form.Item>
                      </Col>
                      <Col span={5}>
                        <Form.Item
                          {...restField}
                          name={[name, 'priority']}
                          initialValue="medium"
                          style={{ marginBottom: 0 }}
                        >
                          <Select options={PRIORITY_OPTIONS} placeholder="优先级" size="small" />
                        </Form.Item>
                      </Col>
                      <Col span={3}>
                        <Button
                          type="text"
                          danger
                          icon={<MinusCircleOutlined />}
                          onClick={() => remove(name)}
                          size="small"
                        />
                      </Col>
                    </Row>
                  ))}
                  <Button
                    type="dashed"
                    onClick={() => add({ priority: 'medium' })}
                    block
                    icon={<PlusOutlined />}
                  >
                    添加任务
                  </Button>
                </>
              )}
            </Form.List>
          </Card>
        </Form>
      </Drawer>

      {/* 计划详情 Modal */}
      <Modal
        title="计划详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={<Button onClick={() => setDetailVisible(false)}>关闭</Button>}
        width={650}
      >
        {viewingPlan && (
          <div>
            <Row gutter={[16, 12]} style={{ marginBottom: 16 }}>
              <Col span={12}><strong>标题：</strong>{viewingPlan.title}</Col>
              <Col span={12}><strong>日期：</strong>{dayjs(viewingPlan.plan_date).format('YYYY-MM-DD')}</Col>
              <Col span={12}><strong>负责人：</strong>{viewingPlan.assignee_name || '-'}</Col>
              <Col span={12}>
                <strong>状态：</strong>
                <Tag color={STATUS_MAP[viewingPlan.status]?.color || 'default'}>
                  {STATUS_MAP[viewingPlan.status]?.label || viewingPlan.status}
                </Tag>
              </Col>
              <Col span={12}>
                <strong>进度：</strong>{viewingPlan.completed_count}/{viewingPlan.task_count}
              </Col>
              <Col span={12}><strong>备注：</strong>{viewingPlan.remark || '-'}</Col>
            </Row>

            {viewingPlan.tasks && viewingPlan.tasks.length > 0 && (
              <Table
                size="small"
                dataSource={viewingPlan.tasks}
                rowKey="id"
                pagination={false}
                columns={[
                  { title: '客户', dataIndex: 'customer_name', key: 'customer_name' },
                  { title: '任务类型', dataIndex: 'task_type_name', key: 'task_type_name' },
                  {
                    title: '状态', dataIndex: 'status', key: 'status',
                    render: (s: string) => {
                      const map: Record<string, { color: string; label: string }> = {
                        pending: { color: 'default', label: '待执行' },
                        checked_in: { color: 'processing', label: '已签到' },
                        completed: { color: 'green', label: '已完成' },
                        cancelled: { color: 'red', label: '已取消' },
                      };
                      const info = map[s] || { color: 'default', label: s };
                      return <Tag color={info.color}>{info.label}</Tag>;
                    },
                  },
                  {
                    title: '优先级', dataIndex: 'priority', key: 'priority',
                    render: (p: string) => {
                      const map: Record<string, { color: string; label: string }> = {
                        high: { color: 'red', label: '高' },
                        medium: { color: 'orange', label: '中' },
                        low: { color: 'blue', label: '低' },
                      };
                      const info = map[p] || { color: 'default', label: p };
                      return <Tag color={info.color}>{info.label}</Tag>;
                    },
                  },
                ]}
              />
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default VisitPlanList;
