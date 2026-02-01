import React, { useState } from 'react';
import {
  Table, Button, Space, Modal, message, Popconfirm, Tag, Switch, Form, Input,
  InputNumber, Select, Card, Row, Col, ColorPicker,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, MinusCircleOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { visitTaskTypeApi } from '../api';
import type { VisitTaskType, VisitTaskTypeField } from '../types';
import { queryKeys } from '../api/queryKeys';

const FIELD_TYPE_OPTIONS = [
  { label: '文本', value: 'text' },
  { label: '数字', value: 'number' },
  { label: '单选', value: 'select' },
  { label: '多选', value: 'multi_select' },
  { label: '拍照', value: 'photo' },
  { label: '评分', value: 'rating' },
  { label: '是否', value: 'boolean' },
];

const VisitTaskTypeList: React.FC = () => {
  const queryClient = useQueryClient();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingType, setEditingType] = useState<VisitTaskType | undefined>();
  const [form] = Form.useForm();

  // 获取任务类型列表
  const { data: taskTypes, isLoading } = useQuery({
    queryKey: queryKeys.visitTaskTypes.list(),
    queryFn: () => visitTaskTypeApi.list().then((res) => {
      const d = res.data;
      return (Array.isArray(d) ? d : d.items || d.data || []) as VisitTaskType[];
    }),
  });

  // 创建
  const createMutation = useMutation({
    mutationFn: (data: any) => visitTaskTypeApi.create(data),
    onSuccess: () => {
      message.success('创建成功');
      setModalVisible(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.visitTaskTypes.all });
    },
    onError: (err: any) => {
      message.error(err.response?.data?.detail || '创建失败');
    },
  });

  // 更新
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => visitTaskTypeApi.update(id, data),
    onSuccess: () => {
      message.success('更新成功');
      setModalVisible(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.visitTaskTypes.all });
    },
    onError: (err: any) => {
      message.error(err.response?.data?.detail || '更新失败');
    },
  });

  // 删除
  const deleteMutation = useMutation({
    mutationFn: (id: number) => visitTaskTypeApi.delete(id),
    onSuccess: () => {
      message.success('删除成功');
      queryClient.invalidateQueries({ queryKey: queryKeys.visitTaskTypes.all });
    },
    onError: (err: any) => {
      message.error(err.response?.data?.detail || '删除失败');
    },
  });

  // 切换激活状态
  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      visitTaskTypeApi.update(id, { is_active }),
    onSuccess: () => {
      message.success('状态已更新');
      queryClient.invalidateQueries({ queryKey: queryKeys.visitTaskTypes.all });
    },
    onError: (err: any) => {
      message.error(err.response?.data?.detail || '更新失败');
    },
  });

  const handleAdd = () => {
    setEditingType(undefined);
    form.resetFields();
    form.setFieldsValue({ sort_order: 0, color: '#1890ff', fields: [] });
    setModalVisible(true);
  };

  const handleEdit = async (record: VisitTaskType) => {
    try {
      const res = await visitTaskTypeApi.get(record.id);
      const detail = res.data as VisitTaskType;
      setEditingType(detail);
      form.setFieldsValue({
        name: detail.name,
        code: detail.code,
        description: detail.description || '',
        icon: detail.icon || '',
        color: detail.color || '#1890ff',
        sort_order: detail.sort_order,
        fields: (detail.fields || []).map((f) => ({
          name: f.name,
          field_key: f.field_key,
          field_type: f.field_type,
          options: f.options ? (Array.isArray(f.options) ? f.options.join(',') : String(f.options)) : '',
          is_required: f.is_required,
          sort_order: f.sort_order,
        })),
      });
      setModalVisible(true);
    } catch {
      message.error('获取详情失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const colorValue = typeof values.color === 'string'
        ? values.color
        : values.color?.toHexString?.() || '#1890ff';
      const payload = {
        name: values.name,
        code: values.code,
        description: values.description || undefined,
        icon: values.icon || undefined,
        color: colorValue,
        sort_order: values.sort_order ?? 0,
        fields: (values.fields || []).map((f: any, idx: number) => ({
          name: f.name,
          field_key: f.field_key,
          field_type: f.field_type,
          options: f.field_type === 'select' || f.field_type === 'multi_select'
            ? (f.options ? f.options.split(',').map((s: string) => s.trim()).filter(Boolean) : [])
            : undefined,
          is_required: f.is_required ?? false,
          sort_order: f.sort_order ?? idx,
        })),
      };
      if (editingType) {
        updateMutation.mutate({ id: editingType.id, data: payload });
      } else {
        createMutation.mutate(payload);
      }
    } catch {
      // validation error
    }
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 60,
    },
    {
      title: '颜色',
      dataIndex: 'color',
      key: 'color',
      width: 60,
      render: (color: string) => (
        <div style={{
          width: 20, height: 20, borderRadius: '50%',
          backgroundColor: color || '#ccc', border: '1px solid #e8e8e8',
        }} />
      ),
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 150,
    },
    {
      title: '编码',
      dataIndex: 'code',
      key: 'code',
      width: 120,
    },
    {
      title: '类型',
      key: 'is_system',
      width: 100,
      render: (_: any, record: VisitTaskType) =>
        record.is_system
          ? <Tag color="purple">系统预设</Tag>
          : <Tag>自定义</Tag>,
    },
    {
      title: '表单字段数',
      key: 'field_count',
      width: 100,
      render: (_: any, record: VisitTaskType) => (
        <Tag color="blue">{record.fields?.length ?? 0}</Tag>
      ),
    },
    {
      title: '启用',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 80,
      render: (val: boolean, record: VisitTaskType) => (
        <Switch
          checked={val}
          size="small"
          onChange={(checked) => toggleActiveMutation.mutate({ id: record.id, is_active: checked })}
        />
      ),
    },
    {
      title: '排序',
      dataIndex: 'sort_order',
      key: 'sort_order',
      width: 60,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 120,
      render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      render: (_: any, record: VisitTaskType) => (
        <Space size={0}>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          {!record.is_system && (
            <Popconfirm
              title="确认删除此任务类型?"
              onConfirm={() => deleteMutation.mutate(record.id)}
            >
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>拜访任务类型</h3>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新增类型
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={taskTypes}
        rowKey="id"
        loading={isLoading}
        pagination={{ pageSize: 20, showTotal: (total) => `共 ${total} 条` }}
      />

      <Modal
        title={editingType ? '编辑任务类型' : '新增任务类型'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmit}
        width={720}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
                <Input placeholder="如：常规拜访" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="code" label="编码" rules={[{ required: true, message: '请输入编码' }]}>
                <Input placeholder="如：regular_visit" disabled={!!editingType} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="description" label="描述">
                <Input.TextArea rows={2} placeholder="类型描述" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="color" label="颜色">
                <ColorPicker format="hex" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="sort_order" label="排序">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="icon" label="图标名称">
            <Input placeholder="可选，如 CheckCircleOutlined" />
          </Form.Item>

          <Card size="small" title="表单字段配置" style={{ marginBottom: 16 }}>
            <Form.List name="fields">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...restField }) => (
                    <Card
                      key={key}
                      size="small"
                      style={{ marginBottom: 8, background: '#fafafa' }}
                      extra={
                        <Button
                          type="text"
                          danger
                          icon={<MinusCircleOutlined />}
                          onClick={() => remove(name)}
                          size="small"
                        />
                      }
                    >
                      <Row gutter={12}>
                        <Col span={6}>
                          <Form.Item
                            {...restField}
                            name={[name, 'name']}
                            label="字段名"
                            rules={[{ required: true, message: '必填' }]}
                            style={{ marginBottom: 4 }}
                          >
                            <Input placeholder="字段名" size="small" />
                          </Form.Item>
                        </Col>
                        <Col span={6}>
                          <Form.Item
                            {...restField}
                            name={[name, 'field_key']}
                            label="字段标识"
                            rules={[{ required: true, message: '必填' }]}
                            style={{ marginBottom: 4 }}
                          >
                            <Input placeholder="field_key" size="small" />
                          </Form.Item>
                        </Col>
                        <Col span={5}>
                          <Form.Item
                            {...restField}
                            name={[name, 'field_type']}
                            label="类型"
                            rules={[{ required: true, message: '必填' }]}
                            style={{ marginBottom: 4 }}
                          >
                            <Select options={FIELD_TYPE_OPTIONS} placeholder="类型" size="small" />
                          </Form.Item>
                        </Col>
                        <Col span={3}>
                          <Form.Item
                            {...restField}
                            name={[name, 'sort_order']}
                            label="排序"
                            style={{ marginBottom: 4 }}
                          >
                            <InputNumber min={0} size="small" style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col span={4}>
                          <Form.Item
                            {...restField}
                            name={[name, 'is_required']}
                            label="必填"
                            valuePropName="checked"
                            style={{ marginBottom: 4 }}
                          >
                            <Switch size="small" />
                          </Form.Item>
                        </Col>
                      </Row>
                      <Form.Item
                        noStyle
                        shouldUpdate={(prev, cur) =>
                          prev.fields?.[name]?.field_type !== cur.fields?.[name]?.field_type
                        }
                      >
                        {({ getFieldValue }) => {
                          const fieldType = getFieldValue(['fields', name, 'field_type']);
                          if (fieldType === 'select' || fieldType === 'multi_select') {
                            return (
                              <Form.Item
                                {...restField}
                                name={[name, 'options']}
                                label="选项（逗号分隔）"
                                style={{ marginBottom: 4 }}
                              >
                                <Input placeholder="选项1,选项2,选项3" size="small" />
                              </Form.Item>
                            );
                          }
                          return null;
                        }}
                      </Form.Item>
                    </Card>
                  ))}
                  <Button
                    type="dashed"
                    onClick={() => add({ name: '', field_key: '', field_type: 'text', is_required: false, sort_order: fields.length })}
                    block
                    icon={<PlusOutlined />}
                  >
                    添加字段
                  </Button>
                </>
              )}
            </Form.List>
          </Card>
        </Form>
      </Modal>
    </div>
  );
};

export default VisitTaskTypeList;
