import React, { useState } from 'react';
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  message,
  Popconfirm,
  Tag,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, MinusCircleOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fieldApi } from '../api';
import type { FieldDefinition, FieldType } from '../types';

const fieldTypeLabels: Record<FieldType, string> = {
  text: '文本',
  number: '数字',
  date: '日期',
  select: '单选',
  multi_select: '多选',
};

const fieldTypeColors: Record<FieldType, string> = {
  text: 'blue',
  number: 'green',
  date: 'orange',
  select: 'purple',
  multi_select: 'magenta',
};

const FieldList: React.FC = () => {
  const queryClient = useQueryClient();
  const [form] = Form.useForm();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingField, setEditingField] = useState<FieldDefinition | undefined>();
  const [loading, setLoading] = useState(false);
  const [fieldType, setFieldType] = useState<FieldType>('text');

  const { data: fields, isLoading } = useQuery({
    queryKey: ['fields'],
    queryFn: () => fieldApi.list().then((res) => res.data as FieldDefinition[]),
  });

  const handleAdd = () => {
    setEditingField(undefined);
    setFieldType('text');
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: FieldDefinition) => {
    setEditingField(record);
    setFieldType(record.field_type);
    form.setFieldsValue({
      name: record.name,
      field_key: record.field_key,
      field_type: record.field_type,
      options: record.options || [],
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await fieldApi.delete(id);
      message.success('删除成功');
      queryClient.invalidateQueries({ queryKey: ['fields'] });
    } catch (error: any) {
      message.error(error.response?.data?.detail || '删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const data = {
        ...values,
        options: ['select', 'multi_select'].includes(values.field_type)
          ? values.options?.filter((o: string) => o?.trim())
          : null,
      };

      if (editingField) {
        await fieldApi.update(editingField.id, {
          name: data.name,
          field_type: data.field_type,
          options: data.options,
        });
        message.success('更新成功');
      } else {
        await fieldApi.create(data);
        message.success('创建成功');
      }

      setModalVisible(false);
      queryClient.invalidateQueries({ queryKey: ['fields'] });
    } catch (error: any) {
      message.error(error.response?.data?.detail || '操作失败');
    } finally {
      setLoading(false);
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
      title: '字段名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '字段键名',
      dataIndex: 'field_key',
      key: 'field_key',
      render: (text: string) => <code>{text}</code>,
    },
    {
      title: '类型',
      dataIndex: 'field_type',
      key: 'field_type',
      render: (type: FieldType) => (
        <Tag color={fieldTypeColors[type]}>{fieldTypeLabels[type]}</Tag>
      ),
    },
    {
      title: '选项值',
      dataIndex: 'options',
      key: 'options',
      ellipsis: true,
      render: (options: string[] | null) =>
        options?.length ? options.join(', ') : '-',
    },
    {
      title: '系统字段',
      dataIndex: 'is_system',
      key: 'is_system',
      render: (isSystem: boolean) =>
        isSystem ? <Tag color="red">系统</Tag> : <Tag>自定义</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_: any, record: FieldDefinition) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          {!record.is_system && (
            <Popconfirm
              title="确认删除此字段?"
              description="删除后使用此字段的模板将受影响"
              onConfirm={() => handleDelete(record.id)}
            >
              <Button type="link" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const needOptions = ['select', 'multi_select'].includes(fieldType);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          添加字段
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={fields}
        rowKey="id"
        loading={isLoading}
        pagination={{ pageSize: 15 }}
      />

      <Modal
        title={editingField ? '编辑字段' : '添加字段'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmit}
        confirmLoading={loading}
        width={600}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="字段名称"
            name="name"
            rules={[{ required: true, message: '请输入字段名称' }]}
          >
            <Input placeholder="例如：客户行业" />
          </Form.Item>

          <Form.Item
            label="字段键名"
            name="field_key"
            rules={[
              { required: true, message: '请输入字段键名' },
              { pattern: /^[a-z][a-z0-9_]*$/, message: '只能使用小写字母、数字和下划线，且以字母开头' },
            ]}
            extra="唯一标识，创建后不可修改"
          >
            <Input placeholder="例如：customer_industry" disabled={!!editingField} />
          </Form.Item>

          <Form.Item
            label="字段类型"
            name="field_type"
            rules={[{ required: true, message: '请选择字段类型' }]}
          >
            <Select
              placeholder="请选择字段类型"
              onChange={(value) => setFieldType(value)}
            >
              <Select.Option value="text">文本输入</Select.Option>
              <Select.Option value="number">数字输入</Select.Option>
              <Select.Option value="date">日期选择</Select.Option>
              <Select.Option value="select">单选（下拉）</Select.Option>
              <Select.Option value="multi_select">多选（标签）</Select.Option>
            </Select>
          </Form.Item>

          {needOptions && (
            <Form.Item label="选项值" required>
              <Form.List name="options" initialValue={['']}>
                {(fields, { add, remove }) => (
                  <>
                    {fields.map(({ key, name, ...restField }) => (
                      <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                        <Form.Item
                          {...restField}
                          name={name}
                          rules={[{ required: true, message: '请输入选项值' }]}
                          style={{ marginBottom: 0 }}
                        >
                          <Input placeholder="选项值" style={{ width: 300 }} />
                        </Form.Item>
                        {fields.length > 1 && (
                          <MinusCircleOutlined onClick={() => remove(name)} />
                        )}
                      </Space>
                    ))}
                    <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                      添加选项
                    </Button>
                  </>
                )}
              </Form.List>
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
};

export default FieldList;
