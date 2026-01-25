import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, message, Popconfirm, Tag, Descriptions, Divider, Input, Select, DatePicker, Row, Col, Card, Collapse } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, InboxOutlined, DownloadOutlined, SearchOutlined, ReloadOutlined, FilterOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { customerApi, templateApi, fieldApi, customerPoolApi, userApi } from '../api';
import type { Customer, CustomerTemplate, FieldDefinition, CustomFieldFilter } from '../types';
import CustomerForm from '../components/CustomerForm';
import DynamicFieldFilter from '../components/DynamicFieldFilter';

const { RangePicker } = DatePicker;

interface FilterState {
  keyword?: string;
  template_id?: number;
  managed_by?: number;
  has_coords?: boolean;
  start_date?: string;
  end_date?: string;
  customFilters?: CustomFieldFilter[];
}

const CustomerList: React.FC = () => {
  const queryClient = useQueryClient();
  const [modalVisible, setModalVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [releaseModalVisible, setReleaseModalVisible] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | undefined>();
  const [viewingCustomer, setViewingCustomer] = useState<Customer | undefined>();
  const [releasingCustomer, setReleasingCustomer] = useState<Customer | undefined>();
  const [releaseReason, setReleaseReason] = useState('');

  // 筛选状态
  const [filters, setFilters] = useState<FilterState>({});

  // 构建 API 参数（将 customFilters 转为 JSON 字符串）
  const buildApiParams = () => {
    const { customFilters, ...rest } = filters;
    const params: any = { ...rest, limit: 100 };
    if (customFilters && customFilters.length > 0) {
      params.custom_filters = JSON.stringify(customFilters);
    }
    return params;
  };

  // 获取客户列表
  const { data: customers, isLoading } = useQuery({
    queryKey: ['customers', filters],
    queryFn: () => customerApi.list(buildApiParams()).then((res) => res.data as Customer[]),
  });

  // 获取模板列表
  const { data: templates } = useQuery({
    queryKey: ['templates'],
    queryFn: () => templateApi.list().then((res) => res.data as CustomerTemplate[]),
  });

  // 获取选中模板的详情（包含字段列表）
  const { data: selectedTemplate } = useQuery({
    queryKey: ['template', filters.template_id],
    queryFn: () => templateApi.get(filters.template_id!).then((res) => res.data as CustomerTemplate),
    enabled: !!filters.template_id,
  });

  // 当模板变更时，清除自定义字段筛选
  useEffect(() => {
    if (filters.customFilters && filters.customFilters.length > 0) {
      // 检查筛选条件中的字段是否属于当前模板
      const templateFieldIds = selectedTemplate?.template_fields?.map((tf) => tf.field_id) || [];
      const validFilters = filters.customFilters.filter((f) => templateFieldIds.includes(f.field_id));
      if (validFilters.length !== filters.customFilters.length) {
        setFilters((prev) => ({ ...prev, customFilters: validFilters.length > 0 ? validFilters : undefined }));
      }
    }
  }, [filters.template_id, selectedTemplate]);

  // 获取字段定义列表
  const { data: fields } = useQuery({
    queryKey: ['fields'],
    queryFn: () => fieldApi.list().then((res) => res.data as FieldDefinition[]),
  });

  // 获取用户列表（用于负责人筛选）
  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => userApi.list({ page_size: 100 }).then((res) => res.data.items || []),
  });

  const getFieldById = (id: number) => fields?.find((f) => f.id === id);
  const getTemplateById = (id: number) => templates?.find((t) => t.id === id);

  const handleAdd = () => {
    setEditingCustomer(undefined);
    setModalVisible(true);
  };

  const handleEdit = async (record: Customer) => {
    const res = await customerApi.get(record.id);
    setEditingCustomer(res.data);
    setModalVisible(true);
  };

  const handleView = async (record: Customer) => {
    const res = await customerApi.get(record.id);
    setViewingCustomer(res.data);
    setDetailVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await customerApi.delete(id);
      message.success('删除成功');
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleSuccess = () => {
    setModalVisible(false);
    queryClient.invalidateQueries({ queryKey: ['customers'] });
  };

  // 释放到公海
  const handleRelease = (record: Customer) => {
    setReleasingCustomer(record);
    setReleaseReason('');
    setReleaseModalVisible(true);
  };

  const confirmRelease = async () => {
    if (!releasingCustomer) return;
    try {
      await customerPoolApi.release(releasingCustomer.id, releaseReason || undefined);
      message.success('已释放到公海');
      setReleaseModalVisible(false);
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['pool-customers'] });
    } catch (error: any) {
      message.error(error.response?.data?.detail || '释放失败');
    }
  };

  // 导出 Excel（带当前筛选条件）
  const handleExport = async () => {
    try {
      message.loading({ content: '正在导出...', key: 'export' });
      const { customFilters, ...rest } = filters;
      const exportParams: any = { ...rest };
      if (customFilters && customFilters.length > 0) {
        exportParams.custom_filters = JSON.stringify(customFilters);
      }
      const response = await customerApi.exportExcel(exportParams);
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `客户列表_${new Date().toLocaleDateString()}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      message.success({ content: '导出成功', key: 'export' });
    } catch (error) {
      message.error({ content: '导出失败', key: 'export' });
    }
  };

  // 重置筛选
  const handleResetFilters = () => {
    setFilters({});
  };

  const formatFieldValue = (value: any) => {
    if (value === null || value === undefined) return '-';
    if (Array.isArray(value)) return value.join(', ');
    return String(value);
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 60,
    },
    {
      title: '客户名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '地址',
      dataIndex: 'address',
      key: 'address',
      ellipsis: true,
    },
    {
      title: '坐标',
      key: 'coords',
      width: 80,
      render: (_: any, record: Customer) =>
        record.latitude && record.longitude
          ? <Tag color="green">有</Tag>
          : <Tag>无</Tag>,
    },
    {
      title: '使用模板',
      dataIndex: 'template_id',
      key: 'template_id',
      render: (templateId: number) => {
        const template = getTemplateById(templateId);
        return template ? <Tag color="blue">{template.name}</Tag> : '-';
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text: string) => new Date(text).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      width: 280,
      render: (_: any, record: Customer) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleView(record)}
          >
            查看
          </Button>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            icon={<InboxOutlined />}
            onClick={() => handleRelease(record)}
          >
            释放
          </Button>
          <Popconfirm
            title="确认删除此客户?"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const hasFilters = Object.entries(filters).some(([k, v]) => {
    if (k === 'customFilters') {
      return Array.isArray(v) && v.length > 0;
    }
    return v !== undefined && v !== '';
  });

  return (
    <div style={{ padding: 24 }}>
      {/* 筛选面板 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[16, 12]} align="middle">
          <Col>
            <Input
              placeholder="搜索名称/地址"
              prefix={<SearchOutlined />}
              style={{ width: 180 }}
              value={filters.keyword || ''}
              onChange={(e) => setFilters({ ...filters, keyword: e.target.value || undefined })}
              allowClear
            />
          </Col>
          <Col>
            <Select
              placeholder="模板"
              style={{ width: 120 }}
              allowClear
              value={filters.template_id}
              onChange={(v) => setFilters({ ...filters, template_id: v })}
            >
              {templates?.map((t) => (
                <Select.Option key={t.id} value={t.id}>{t.name}</Select.Option>
              ))}
            </Select>
          </Col>
          <Col>
            <Select
              placeholder="负责人"
              style={{ width: 120 }}
              allowClear
              value={filters.managed_by}
              onChange={(v) => setFilters({ ...filters, managed_by: v })}
            >
              <Select.Option value={0}>公海客户</Select.Option>
              {users?.map((u: any) => (
                <Select.Option key={u.id} value={u.id}>{u.real_name || u.username}</Select.Option>
              ))}
            </Select>
          </Col>
          <Col>
            <Select
              placeholder="坐标"
              style={{ width: 100 }}
              allowClear
              value={filters.has_coords}
              onChange={(v) => setFilters({ ...filters, has_coords: v })}
            >
              <Select.Option value={true}>有坐标</Select.Option>
              <Select.Option value={false}>无坐标</Select.Option>
            </Select>
          </Col>
          <Col>
            <RangePicker
              placeholder={['开始日期', '结束日期']}
              style={{ width: 240 }}
              value={[
                filters.start_date ? dayjs(filters.start_date) : null,
                filters.end_date ? dayjs(filters.end_date) : null,
              ]}
              onChange={(dates) => {
                setFilters({
                  ...filters,
                  start_date: dates?.[0]?.format('YYYY-MM-DD'),
                  end_date: dates?.[1]?.format('YYYY-MM-DD'),
                });
              }}
            />
          </Col>
          {hasFilters && (
            <Col>
              <Button icon={<ReloadOutlined />} onClick={handleResetFilters}>
                重置
              </Button>
            </Col>
          )}
          <Col flex="auto" style={{ textAlign: 'right' }}>
            <Tag color="blue">{customers?.length || 0} 条记录</Tag>
          </Col>
        </Row>

        {/* 自定义字段筛选 - 仅在选择模板后显示 */}
        {selectedTemplate?.template_fields && selectedTemplate.template_fields.length > 0 && (
          <Row gutter={[16, 12]} align="middle" style={{ marginTop: 12, borderTop: '1px dashed #e8e8e8', paddingTop: 12 }}>
            <Col>
              <FilterOutlined style={{ color: '#1890ff', marginRight: 4 }} />
              <span style={{ color: '#666', fontSize: 13 }}>自定义字段：</span>
            </Col>
            {selectedTemplate.template_fields.map((tf) => (
              <Col key={tf.id}>
                <DynamicFieldFilter
                  templateField={tf}
                  value={filters.customFilters || []}
                  onChange={(newFilters) => setFilters({ ...filters, customFilters: newFilters.length > 0 ? newFilters : undefined })}
                />
              </Col>
            ))}
          </Row>
        )}
      </Card>

      {/* 操作栏 */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          添加客户
        </Button>
        <Button icon={<DownloadOutlined />} onClick={handleExport}>
          导出 Excel
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={customers}
        rowKey="id"
        loading={isLoading}
        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
      />

      <Modal
        title={editingCustomer ? '编辑客户' : '添加客户'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={600}
        destroyOnClose
      >
        <CustomerForm
          customer={editingCustomer}
          onSuccess={handleSuccess}
          onCancel={() => setModalVisible(false)}
        />
      </Modal>

      <Modal
        title="客户详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>
            关闭
          </Button>,
          <Button
            key="edit"
            type="primary"
            onClick={() => {
              setDetailVisible(false);
              if (viewingCustomer) {
                setEditingCustomer(viewingCustomer);
                setModalVisible(true);
              }
            }}
          >
            编辑
          </Button>,
        ]}
        width={700}
      >
        {viewingCustomer && (
          <>
            <Descriptions title="基本信息" bordered column={2}>
              <Descriptions.Item label="客户名称">{viewingCustomer.name}</Descriptions.Item>
              <Descriptions.Item label="使用模板">
                {getTemplateById(viewingCustomer.template_id!)?.name || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="地址" span={2}>
                {viewingCustomer.address || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="坐标">
                {viewingCustomer.latitude && viewingCustomer.longitude
                  ? `${viewingCustomer.latitude}, ${viewingCustomer.longitude}`
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {new Date(viewingCustomer.created_at).toLocaleString()}
              </Descriptions.Item>
            </Descriptions>

            {viewingCustomer.field_values && viewingCustomer.field_values.length > 0 && (
              <>
                <Divider />
                <Descriptions title="自定义字段" bordered column={2}>
                  {viewingCustomer.field_values.map((fv) => {
                    const field = getFieldById(fv.field_id);
                    return (
                      <Descriptions.Item key={fv.id} label={field?.name || `字段${fv.field_id}`}>
                        {formatFieldValue(fv.value)}
                      </Descriptions.Item>
                    );
                  })}
                </Descriptions>
              </>
            )}
          </>
        )}
      </Modal>

      {/* 释放到公海 Modal */}
      <Modal
        title="释放客户到公海"
        open={releaseModalVisible}
        onCancel={() => setReleaseModalVisible(false)}
        onOk={confirmRelease}
        okText="确认释放"
        cancelText="取消"
      >
        <p>确定要将客户 <strong>{releasingCustomer?.name}</strong> 释放到公海吗？</p>
        <Input.TextArea
          placeholder="请输入释放原因（可选）"
          value={releaseReason}
          onChange={(e) => setReleaseReason(e.target.value)}
          rows={3}
        />
      </Modal>
    </div>
  );
};

export default CustomerList;
