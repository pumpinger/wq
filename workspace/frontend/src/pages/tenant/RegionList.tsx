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
  Tag,
  message,
  Popconfirm,
  Card,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { regionApi } from '../../api';
import { queryKeys } from '../../api/queryKeys';
import dayjs from 'dayjs';
import type { Region } from '../../types';

const RegionList: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRegion, setEditingRegion] = useState<Region | null>(null);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  // 获取区域列表
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.regions.management(),
    queryFn: async () => {
      const response = await regionApi.list();
      return response.data;
    },
  });

  // 创建区域
  const createMutation = useMutation({
    mutationFn: (data: any) => regionApi.create(data),
    onSuccess: () => {
      message.success('区域创建成功');
      queryClient.invalidateQueries({ queryKey: queryKeys.regions.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.regions.all });
      setIsModalOpen(false);
      form.resetFields();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || '创建失败');
    },
  });

  // 更新区域
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => regionApi.update(id, data),
    onSuccess: () => {
      message.success('区域更新成功');
      queryClient.invalidateQueries({ queryKey: queryKeys.regions.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.regions.all });
      setIsModalOpen(false);
      setEditingRegion(null);
      form.resetFields();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || '更新失败');
    },
  });

  // 删除区域
  const deleteMutation = useMutation({
    mutationFn: (id: number) => regionApi.delete(id),
    onSuccess: () => {
      message.success('区域删除成功');
      queryClient.invalidateQueries({ queryKey: queryKeys.regions.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.regions.all });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || '删除失败');
    },
  });

  const handleOpenModal = (region?: Region) => {
    if (region) {
      setEditingRegion(region);
      form.setFieldsValue(region);
    } else {
      setEditingRegion(null);
      form.resetFields();
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingRegion) {
        updateMutation.mutate({ id: editingRegion.id, data: values });
      } else {
        createMutation.mutate(values);
      }
    } catch (error) {
      // 表单验证失败
    }
  };

  // 获取父区域名称
  const getParentName = (parentId?: number) => {
    if (!parentId) return '-';
    const parent = data?.items?.find((r: Region) => r.id === parentId);
    return parent?.name || '-';
  };

  const columns = [
    {
      title: '区域名称',
      dataIndex: 'name',
      key: 'name',
      width: 150,
    },
    {
      title: '区域编码',
      dataIndex: 'code',
      key: 'code',
      width: 120,
      render: (code: string) => <Tag>{code}</Tag>,
    },
    {
      title: '父区域',
      dataIndex: 'parent_id',
      key: 'parent_id',
      width: 120,
      render: (parentId: number) => getParentName(parentId),
    },
    {
      title: '排序',
      dataIndex: 'sort_order',
      key: 'sort_order',
      width: 80,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_: any, record: Region) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleOpenModal(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除该区域吗？"
            description="删除后该区域下的客户将变为未分配区域"
            onConfirm={() => deleteMutation.mutate(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card title="区域管理" extra={
      <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>
        新建区域
      </Button>
    }>
      <Table
        columns={columns}
        dataSource={data?.items || []}
        rowKey="id"
        loading={isLoading}
        scroll={{ x: 800 }}
        pagination={{
          total: data?.total || 0,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
        }}
      />

      <Modal
        title={editingRegion ? '编辑区域' : '新建区域'}
        open={isModalOpen}
        onOk={handleSubmit}
        onCancel={() => {
          setIsModalOpen(false);
          setEditingRegion(null);
          form.resetFields();
        }}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        width={500}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 24 }}>
          <Form.Item
            name="name"
            label="区域名称"
            rules={[{ required: true, message: '请输入区域名称' }]}
          >
            <Input placeholder="请输入区域名称" />
          </Form.Item>

          <Form.Item
            name="code"
            label="区域编码"
            rules={[
              { required: true, message: '请输入区域编码' },
              { pattern: /^[a-zA-Z0-9_-]+$/, message: '只能包含字母、数字、下划线和横线' },
            ]}
          >
            <Input placeholder="请输入区域编码（唯一标识）" />
          </Form.Item>

          <Form.Item name="parent_id" label="父区域">
            <Select allowClear placeholder="请选择父区域（可选）">
              {(data?.items || [])
                .filter((r: Region) => r.id !== editingRegion?.id)
                .map((r: Region) => (
                  <Select.Option key={r.id} value={r.id}>
                    {r.name}
                  </Select.Option>
                ))}
            </Select>
          </Form.Item>

          <Form.Item name="sort_order" label="排序" initialValue={0}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default RegionList;
