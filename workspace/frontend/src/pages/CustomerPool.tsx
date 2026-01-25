import React, { useState } from 'react';
import { Table, Button, Space, Modal, message, Tag, Descriptions, Input, Select, Popconfirm } from 'antd';
import { UserAddOutlined, EyeOutlined, HistoryOutlined, SearchOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { customerPoolApi, templateApi } from '../api';
import type { CustomerTemplate } from '../types';

interface PoolCustomer {
  id: number;
  name: string;
  address?: string;
  template_id?: number;
  template_name?: string;
  pool_time?: string;
  pool_reason?: string;
  created_at: string;
}

interface PoolRecord {
  id: number;
  customer_id: number;
  action: string;
  from_user_id?: number;
  to_user_id?: number;
  from_user_name?: string;
  to_user_name?: string;
  reason?: string;
  created_at: string;
}

const CustomerPool: React.FC = () => {
  const queryClient = useQueryClient();
  const [detailVisible, setDetailVisible] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [viewingCustomer, setViewingCustomer] = useState<PoolCustomer | undefined>();
  const [historyRecords, setHistoryRecords] = useState<PoolRecord[]>([]);
  const [keyword, setKeyword] = useState('');
  const [templateFilter, setTemplateFilter] = useState<number | undefined>();

  // 获取公海客户列表
  const { data: poolCustomers, isLoading } = useQuery({
    queryKey: ['pool-customers', keyword, templateFilter],
    queryFn: () => customerPoolApi.list({
      keyword: keyword || undefined,
      template_id: templateFilter,
    }).then((res) => res.data as PoolCustomer[]),
  });

  // 获取模板列表
  const { data: templates } = useQuery({
    queryKey: ['templates'],
    queryFn: () => templateApi.list().then((res) => res.data as CustomerTemplate[]),
  });

  // 认领客户
  const handleClaim = async (customer: PoolCustomer) => {
    try {
      await customerPoolApi.claim(customer.id);
      message.success(`成功认领客户: ${customer.name}`);
      queryClient.invalidateQueries({ queryKey: ['pool-customers'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    } catch (error: any) {
      message.error(error.response?.data?.detail || '认领失败');
    }
  };

  // 查看详情
  const handleView = async (record: PoolCustomer) => {
    setViewingCustomer(record);
    setDetailVisible(true);
  };

  // 查看公海历史
  const handleViewHistory = async (customer: PoolCustomer) => {
    try {
      const res = await customerPoolApi.history(customer.id);
      setHistoryRecords(res.data);
      setViewingCustomer(customer);
      setHistoryVisible(true);
    } catch (error) {
      message.error('获取历史记录失败');
    }
  };

  const getActionText = (action: string) => {
    switch (action) {
      case 'release':
        return <Tag color="orange">释放</Tag>;
      case 'claim':
        return <Tag color="green">认领</Tag>;
      case 'auto_reclaim':
        return <Tag color="red">自动回收</Tag>;
      default:
        return action;
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
      title: '模板',
      dataIndex: 'template_name',
      key: 'template_name',
      render: (name: string) => name ? <Tag color="blue">{name}</Tag> : '-',
    },
    {
      title: '进入公海时间',
      dataIndex: 'pool_time',
      key: 'pool_time',
      render: (text: string) => text ? new Date(text).toLocaleString() : '-',
    },
    {
      title: '原因',
      dataIndex: 'pool_reason',
      key: 'pool_reason',
      ellipsis: true,
      render: (text: string) => text || '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 240,
      render: (_: any, record: PoolCustomer) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleView(record)}
          >
            详情
          </Button>
          <Button
            type="link"
            icon={<HistoryOutlined />}
            onClick={() => handleViewHistory(record)}
          >
            历史
          </Button>
          <Popconfirm
            title={`确认认领客户 "${record.name}"？`}
            onConfirm={() => handleClaim(record)}
            okText="确认"
            cancelText="取消"
          >
            <Button type="primary" icon={<UserAddOutlined />} size="small">
              认领
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const historyColumns = [
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text: string) => new Date(text).toLocaleString(),
    },
    {
      title: '操作',
      dataIndex: 'action',
      key: 'action',
      render: (action: string) => getActionText(action),
    },
    {
      title: '原负责人',
      dataIndex: 'from_user_name',
      key: 'from_user_name',
      render: (text: string) => text || '-',
    },
    {
      title: '新负责人',
      dataIndex: 'to_user_name',
      key: 'to_user_name',
      render: (text: string) => text || '-',
    },
    {
      title: '原因',
      dataIndex: 'reason',
      key: 'reason',
      render: (text: string) => text || '-',
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16, display: 'flex', gap: 16 }}>
        <Input
          placeholder="搜索客户名称"
          prefix={<SearchOutlined />}
          style={{ width: 200 }}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          allowClear
        />
        <Select
          placeholder="选择模板"
          style={{ width: 150 }}
          allowClear
          value={templateFilter}
          onChange={setTemplateFilter}
        >
          {templates?.map((t) => (
            <Select.Option key={t.id} value={t.id}>{t.name}</Select.Option>
          ))}
        </Select>
        <div style={{ flex: 1 }} />
        <Tag color="blue" style={{ lineHeight: '32px' }}>
          公海客户: {poolCustomers?.length || 0} 个
        </Tag>
      </div>

      <Table
        columns={columns}
        dataSource={poolCustomers}
        rowKey="id"
        loading={isLoading}
        pagination={{ pageSize: 10 }}
      />

      {/* 客户详情 Modal */}
      <Modal
        title="客户详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>
            关闭
          </Button>,
          <Popconfirm
            key="claim"
            title={`确认认领客户 "${viewingCustomer?.name}"？`}
            onConfirm={() => {
              if (viewingCustomer) {
                handleClaim(viewingCustomer);
                setDetailVisible(false);
              }
            }}
          >
            <Button type="primary" icon={<UserAddOutlined />}>
              认领
            </Button>
          </Popconfirm>,
        ]}
        width={600}
      >
        {viewingCustomer && (
          <Descriptions bordered column={2}>
            <Descriptions.Item label="客户名称">{viewingCustomer.name}</Descriptions.Item>
            <Descriptions.Item label="模板">{viewingCustomer.template_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="地址" span={2}>
              {viewingCustomer.address || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="进入公海时间">
              {viewingCustomer.pool_time ? new Date(viewingCustomer.pool_time).toLocaleString() : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {new Date(viewingCustomer.created_at).toLocaleString()}
            </Descriptions.Item>
            <Descriptions.Item label="释放原因" span={2}>
              {viewingCustomer.pool_reason || '-'}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      {/* 公海历史 Modal */}
      <Modal
        title={`公海历史 - ${viewingCustomer?.name}`}
        open={historyVisible}
        onCancel={() => setHistoryVisible(false)}
        footer={[
          <Button key="close" onClick={() => setHistoryVisible(false)}>
            关闭
          </Button>,
        ]}
        width={800}
      >
        <Table
          columns={historyColumns}
          dataSource={historyRecords}
          rowKey="id"
          pagination={false}
          size="small"
        />
      </Modal>
    </div>
  );
};

export default CustomerPool;
