import React, { useState } from 'react';
import dayjs from 'dayjs';
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Switch,
  message,
  Popconfirm,
  Tag,
  Transfer,
  Checkbox,
  Descriptions,
  List,
  Collapse,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, MinusCircleOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { templateApi, fieldApi } from '../api';
import { queryKeys } from '../api/queryKeys';
import type { CustomerTemplate, FieldDefinition, FieldType } from '../types';

const fieldTypeLabels: Record<FieldType, string> = {
  text: '文本',
  number: '数字',
  date: '日期',
  select: '单选',
  multi_select: '多选',
};

interface FieldConfig {
  field_id: number;
  is_required: boolean;
  sort_order: number;
  options?: string[];
}

const TemplateList: React.FC = () => {
  const queryClient = useQueryClient();
  const [form] = Form.useForm();
  const [modalVisible, setModalVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<CustomerTemplate | undefined>();
  const [viewingTemplate, setViewingTemplate] = useState<CustomerTemplate | undefined>();
  const [selectedFieldIds, setSelectedFieldIds] = useState<string[]>([]);
  const [fieldConfigs, setFieldConfigs] = useState<Record<string, FieldConfig>>({});
  const [loading, setLoading] = useState(false);

  const { data: templates, isLoading } = useQuery({
    queryKey: queryKeys.templates.list(),
    queryFn: () => templateApi.list().then((res) => res.data as CustomerTemplate[]),
  });

  const { data: fields } = useQuery({
    queryKey: queryKeys.fields.list(),
    queryFn: () => fieldApi.list().then((res) => res.data as FieldDefinition[]),
  });

  const getFieldById = (id: number) => fields?.find((f) => f.id === id);

  const handleAdd = () => {
    setEditingTemplate(undefined);
    setSelectedFieldIds([]);
    setFieldConfigs({});
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = async (record: CustomerTemplate) => {
    const res = await templateApi.get(record.id);
    const detail = res.data as CustomerTemplate;
    setEditingTemplate(detail);

    const ids = detail.template_fields?.map((tf) => String(tf.field_id)) || [];
    setSelectedFieldIds(ids);

    const configs: Record<string, FieldConfig> = {};
    detail.template_fields?.forEach((tf) => {
      configs[String(tf.field_id)] = {
        field_id: tf.field_id,
        is_required: tf.is_required,
        sort_order: tf.sort_order,
        options: tf.options || undefined,
      };
    });
    setFieldConfigs(configs);

    form.setFieldsValue({
      name: detail.name,
      description: detail.description,
      is_default: detail.is_default,
    });
    setModalVisible(true);
  };

  const handleView = async (record: CustomerTemplate) => {
    const res = await templateApi.get(record.id);
    setViewingTemplate(res.data);
    setDetailVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await templateApi.delete(id);
      message.success('删除成功');
      queryClient.invalidateQueries({ queryKey: queryKeys.templates.all });
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleTransferChange = (keys: string[]) => {
    setSelectedFieldIds(keys);
    const newConfigs = { ...fieldConfigs };
    keys.forEach((key, index) => {
      if (!newConfigs[key]) {
        const field = getFieldById(Number(key));
        newConfigs[key] = {
          field_id: Number(key),
          is_required: false,
          sort_order: index,
          // 对于 select/multi_select 类型，使用字段定义的默认选项
          options: field?.options ? [...field.options] : undefined,
        };
      }
    });
    Object.keys(newConfigs).forEach((key) => {
      if (!keys.includes(key)) {
        delete newConfigs[key];
      }
    });
    setFieldConfigs(newConfigs);
  };

  const handleRequiredChange = (fieldId: string, checked: boolean) => {
    setFieldConfigs((prev) => ({
      ...prev,
      [fieldId]: {
        ...prev[fieldId],
        is_required: checked,
      },
    }));
  };

  const handleOptionsChange = (fieldId: string, options: string[]) => {
    setFieldConfigs((prev) => ({
      ...prev,
      [fieldId]: {
        ...prev[fieldId],
        options: options,
      },
    }));
  };

  const handleAddOption = (fieldId: string) => {
    const currentOptions = fieldConfigs[fieldId]?.options || [];
    handleOptionsChange(fieldId, [...currentOptions, '']);
  };

  const handleRemoveOption = (fieldId: string, index: number) => {
    const currentOptions = fieldConfigs[fieldId]?.options || [];
    const newOptions = currentOptions.filter((_, i) => i !== index);
    handleOptionsChange(fieldId, newOptions);
  };

  const handleOptionValueChange = (fieldId: string, index: number, value: string) => {
    const currentOptions = fieldConfigs[fieldId]?.options || [];
    const newOptions = [...currentOptions];
    newOptions[index] = value;
    handleOptionsChange(fieldId, newOptions);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const data = {
        ...values,
        fields: selectedFieldIds.map((id, index) => ({
          field_id: Number(id),
          is_required: fieldConfigs[id]?.is_required || false,
          sort_order: index,
          options: fieldConfigs[id]?.options?.filter(o => o?.trim()) || null,
        })),
      };

      if (editingTemplate) {
        await templateApi.update(editingTemplate.id, data);
        message.success('更新成功');
      } else {
        await templateApi.create(data);
        message.success('创建成功');
      }

      setModalVisible(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.templates.all });
    } catch (error: any) {
      message.error(error.response?.data?.detail || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: '模板名称', dataIndex: 'name', key: 'name', width: 150 },
    { title: '描述', dataIndex: 'description', key: 'description', width: 200, ellipsis: true },
    {
      title: '默认模板',
      dataIndex: 'is_default',
      key: 'is_default',
      render: (isDefault: boolean) =>
        isDefault ? <Tag color="green">是</Tag> : <Tag>否</Tag>,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 100,
      render: (text: string) => dayjs(text).format('MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_: any, record: CustomerTemplate) => (
        <Space size={0}>
          <Button type="link" size="small" onClick={() => handleView(record)}>查看</Button>
          <Button type="link" size="small" onClick={() => handleEdit(record)}>编辑</Button>
          <Popconfirm title="确认删除此模板?" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          添加模板
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={templates}
        rowKey="id"
        loading={isLoading}
        scroll={{ x: 750 }}
        pagination={{ pageSize: 10 }}
      />

      {/* 模板详情 Modal */}
      <Modal
        title="模板详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>关闭</Button>,
          <Button
            key="edit"
            type="primary"
            onClick={() => {
              setDetailVisible(false);
              if (viewingTemplate) handleEdit(viewingTemplate);
            }}
          >
            编辑
          </Button>,
        ]}
        width={700}
      >
        {viewingTemplate && (
          <>
            <Descriptions bordered column={1} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="模板名称">{viewingTemplate.name}</Descriptions.Item>
              <Descriptions.Item label="描述">{viewingTemplate.description || '-'}</Descriptions.Item>
              <Descriptions.Item label="默认模板">
                {viewingTemplate.is_default ? '是' : '否'}
              </Descriptions.Item>
            </Descriptions>

            <h4>包含字段 ({viewingTemplate.template_fields?.length || 0}个)</h4>
            <List
              bordered
              dataSource={viewingTemplate.template_fields?.sort((a, b) => a.sort_order - b.sort_order)}
              renderItem={(tf) => (
                <List.Item>
                  <div style={{ width: '100%' }}>
                    <div>
                      <strong>{tf.field.name}</strong>
                      <Tag color="blue" style={{ marginLeft: 8 }}>
                        {fieldTypeLabels[tf.field.field_type as FieldType]}
                      </Tag>
                      {tf.is_required && <Tag color="red">必填</Tag>}
                    </div>
                    {tf.options && tf.options.length > 0 && (
                      <div style={{ marginTop: 4, color: '#666' }}>
                        选项: {tf.options.join(', ')}
                      </div>
                    )}
                  </div>
                </List.Item>
              )}
            />
          </>
        )}
      </Modal>

      {/* 编辑/添加 Modal */}
      <Modal
        title={editingTemplate ? '编辑模板' : '添加模板'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmit}
        confirmLoading={loading}
        width={900}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="模板名称"
            name="name"
            rules={[{ required: true, message: '请输入模板名称' }]}
          >
            <Input placeholder="请输入模板名称" />
          </Form.Item>

          <Form.Item label="描述" name="description">
            <Input.TextArea placeholder="请输入模板描述" rows={2} />
          </Form.Item>

          <Form.Item label="设为默认" name="is_default" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item label="选择字段">
            <Transfer
              dataSource={fields?.map((f) => ({
                key: String(f.id),
                title: f.name,
                description: fieldTypeLabels[f.field_type as FieldType],
              })) || []}
              titles={['可用字段', '已选字段']}
              targetKeys={selectedFieldIds}
              onChange={(keys) => handleTransferChange(keys as string[])}
              render={(item) => (
                <span>
                  {item.title}
                  <Tag style={{ marginLeft: 4 }} color="blue">{item.description}</Tag>
                </span>
              )}
              listStyle={{ width: 320, height: 250 }}
            />
          </Form.Item>

          {selectedFieldIds.length > 0 && (
            <Form.Item label="字段配置">
              <Collapse>
                {selectedFieldIds.map((id) => {
                  const field = getFieldById(Number(id));
                  if (!field) return null;
                  const needOptions = ['select', 'multi_select'].includes(field.field_type);
                  const config = fieldConfigs[id];

                  return (
                    <Collapse.Panel
                      key={id}
                      header={
                        <span>
                          {field.name}
                          <Tag color="blue" style={{ marginLeft: 8 }}>
                            {fieldTypeLabels[field.field_type as FieldType]}
                          </Tag>
                        </span>
                      }
                    >
                      <div style={{ marginBottom: 12 }}>
                        <Checkbox
                          checked={config?.is_required || false}
                          onChange={(e) => handleRequiredChange(id, e.target.checked)}
                        >
                          必填
                        </Checkbox>
                      </div>

                      {needOptions && (
                        <div>
                          <div style={{ marginBottom: 8, fontWeight: 500 }}>
                            选项值配置（此模板专用）:
                          </div>
                          {(config?.options || []).map((opt, index) => (
                            <Space key={index} style={{ display: 'flex', marginBottom: 8 }}>
                              <Input
                                value={opt}
                                placeholder={`选项 ${index + 1}`}
                                style={{ width: 200 }}
                                onChange={(e) => handleOptionValueChange(id, index, e.target.value)}
                              />
                              <Button
                                type="text"
                                danger
                                icon={<MinusCircleOutlined />}
                                onClick={() => handleRemoveOption(id, index)}
                              />
                            </Space>
                          ))}
                          <Button
                            type="dashed"
                            onClick={() => handleAddOption(id)}
                            icon={<PlusOutlined />}
                            style={{ width: 200 }}
                          >
                            添加选项
                          </Button>
                        </div>
                      )}
                    </Collapse.Panel>
                  );
                })}
              </Collapse>
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
};

export default TemplateList;
