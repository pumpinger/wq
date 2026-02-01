import React, { useState } from 'react';
import {
  Table, Button, Tag, Select, DatePicker, Row, Col, Card, Modal,
  Descriptions, Divider, Statistic, Image, Space, message,
} from 'antd';
import {
  EyeOutlined, ReloadOutlined, CheckCircleOutlined, ClockCircleOutlined,
  PercentageOutlined, TeamOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { visitRecordApi, visitTaskTypeApi, userApi } from '../api';
import type { VisitRecord, VisitTaskType, VisitStatsSummary } from '../types';
import { queryKeys } from '../api/queryKeys';

const { RangePicker } = DatePicker;

const RECORD_STATUS_MAP: Record<string, { color: string; label: string }> = {
  checked_in: { color: 'processing', label: '已签到' },
  completed: { color: 'green', label: '已完成' },
  cancelled: { color: 'red', label: '已取消' },
};

interface FilterState {
  date_from?: string;
  date_to?: string;
  user_id?: number;
  task_type_id?: number;
}

const VisitRecordList: React.FC = () => {
  const [filters, setFilters] = useState<FilterState>({});
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<VisitRecord | undefined>();

  // 获取记录列表
  const { data: records, isLoading } = useQuery({
    queryKey: queryKeys.visitRecords.list(filters),
    queryFn: () => visitRecordApi.list({ ...filters, limit: 200 }).then((res) => {
      const d = res.data;
      return (Array.isArray(d) ? d : d.items || d.data || []) as VisitRecord[];
    }),
  });

  // 获取统计摘要
  const { data: stats } = useQuery({
    queryKey: queryKeys.visitRecords.statsSummary(filters),
    queryFn: () => visitRecordApi.statsSummary({
      date_from: filters.date_from,
      date_to: filters.date_to,
    }).then((res) => res.data as VisitStatsSummary),
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

  const handleView = async (record: VisitRecord) => {
    try {
      const res = await visitRecordApi.get(record.id);
      setSelectedRecord(res.data as VisitRecord);
      setDetailVisible(true);
    } catch {
      message.error('获取详情失败');
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
      title: '签到时间',
      dataIndex: 'check_in_time',
      key: 'check_in_time',
      width: 160,
      render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '客户名称',
      dataIndex: 'customer_name',
      key: 'customer_name',
      width: 160,
      ellipsis: true,
    },
    {
      title: '拜访人',
      dataIndex: 'user_name',
      key: 'user_name',
      width: 100,
    },
    {
      title: '任务类型',
      dataIndex: 'task_type_name',
      key: 'task_type_name',
      width: 120,
      render: (text: string) => <Tag color="blue">{text || '-'}</Tag>,
    },
    {
      title: '时长(分钟)',
      dataIndex: 'duration_minutes',
      key: 'duration_minutes',
      width: 100,
      render: (val: number | undefined) => val != null ? `${val} min` : '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const info = RECORD_STATUS_MAP[status] || { color: 'default', label: status };
        return <Tag color={info.color}>{info.label}</Tag>;
      },
    },
    {
      title: '签到距离',
      dataIndex: 'check_in_distance',
      key: 'check_in_distance',
      width: 100,
      render: (val: number | undefined) => val != null ? `${val} m` : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      fixed: 'right' as const,
      render: (_: any, record: VisitRecord) => (
        <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleView(record)}>
          详情
        </Button>
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
              placeholder="拜访人"
              style={{ width: 130 }}
              allowClear
              value={filters.user_id}
              onChange={(v) => setFilters({ ...filters, user_id: v })}
            >
              {users?.map((u: any) => (
                <Select.Option key={u.id} value={u.id}>{u.real_name || u.username}</Select.Option>
              ))}
            </Select>
          </Col>
          <Col>
            <Select
              placeholder="任务类型"
              style={{ width: 130 }}
              allowClear
              value={filters.task_type_id}
              onChange={(v) => setFilters({ ...filters, task_type_id: v })}
            >
              {taskTypes?.map((t) => (
                <Select.Option key={t.id} value={t.id}>{t.name}</Select.Option>
              ))}
            </Select>
          </Col>
          {hasFilters && (
            <Col>
              <Button icon={<ReloadOutlined />} onClick={handleResetFilters}>重置</Button>
            </Col>
          )}
          <Col flex="auto" style={{ textAlign: 'right' }}>
            <Tag color="blue">{records?.length || 0} 条记录</Tag>
          </Col>
        </Row>
      </Card>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="总拜访次数"
              value={stats?.total_visits ?? 0}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="已完成"
              value={stats?.completed_visits ?? 0}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="完成率"
              value={stats?.completion_rate != null ? (stats.completion_rate * 100).toFixed(1) : 0}
              suffix="%"
              prefix={<PercentageOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="平均时长(分钟)"
              value={stats?.avg_duration_minutes != null ? Math.round(stats.avg_duration_minutes) : 0}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Table
        columns={columns}
        dataSource={records}
        rowKey="id"
        loading={isLoading}
        scroll={{ x: 1080 }}
        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
        onRow={(record) => ({
          onClick: () => handleView(record),
          style: { cursor: 'pointer' },
        })}
      />

      {/* 记录详情 Modal */}
      <Modal
        title="拜访记录详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={<Button onClick={() => setDetailVisible(false)}>关闭</Button>}
        width={700}
      >
        {selectedRecord && (
          <div>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="记录ID">{selectedRecord.id}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={RECORD_STATUS_MAP[selectedRecord.status]?.color || 'default'}>
                  {RECORD_STATUS_MAP[selectedRecord.status]?.label || selectedRecord.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="客户名称" span={2}>
                {selectedRecord.customer_name || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="拜访人">{selectedRecord.user_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="任务类型">
                <Tag color="blue">{selectedRecord.task_type_name || '-'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="签到时间">
                {dayjs(selectedRecord.check_in_time).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              <Descriptions.Item label="签退时间">
                {selectedRecord.check_out_time
                  ? dayjs(selectedRecord.check_out_time).format('YYYY-MM-DD HH:mm:ss')
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="时长">
                {selectedRecord.duration_minutes != null ? `${selectedRecord.duration_minutes} 分钟` : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="签到距离">
                {selectedRecord.check_in_distance != null ? `${selectedRecord.check_in_distance} 米` : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="签到地址" span={2}>
                {selectedRecord.check_in_address || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="备注" span={2}>
                {selectedRecord.remark || '-'}
              </Descriptions.Item>
            </Descriptions>

            {/* 表单字段值 */}
            {selectedRecord.field_values && selectedRecord.field_values.length > 0 && (
              <>
                <Divider>表单数据</Divider>
                <Descriptions bordered column={2} size="small">
                  {selectedRecord.field_values.map((fv, idx) => (
                    <Descriptions.Item key={idx} label={fv.field_key}>
                      {fv.value != null
                        ? (Array.isArray(fv.value) ? fv.value.join(', ') : String(fv.value))
                        : '-'}
                    </Descriptions.Item>
                  ))}
                </Descriptions>
              </>
            )}

            {/* 照片 */}
            {selectedRecord.photos && selectedRecord.photos.length > 0 && (
              <>
                <Divider>拜访照片</Divider>
                <Image.PreviewGroup>
                  <Space wrap>
                    {selectedRecord.photos.map((photo) => (
                      <Image
                        key={photo.id}
                        width={120}
                        height={120}
                        src={photo.file_path}
                        style={{ objectFit: 'cover', borderRadius: 4 }}
                        fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMIAAADDCAYAAADQvc6UAAABRWlDQ1BJQ0MgUHJvZmlsZQAAKJFjYGASSSwoyGFhYGDIzSspCnJ3UoiIjFJgf8LAwSDCIMogwMCcmFxc4BgQ4ANUwgCjUcG3awyMIPqyLsis7PPOq3QdDFcvjV3jOD1boQVTPQrgSkktTgbSf4A4LbmgqISBgTEFyFYuLykAsTuAbJEioKOA7DkgdjqEvQHEToKwj4DVhAQ5A9k3gGyB5IxEoBmML4BsnSQk8XQkNtReEOBxcfXxUQg1Mjc0dyHgXNJBSWpFCYh2zi+oLMpMzyhRcASGUqqCZ16yno6CkYGRAQMDKMwhqj/fAIcloxgHQqxAjIHBEugw5sUIsSQpBobtQPdLciLEVJYzMPBHMDBsayhILEqEO4DxG0txmrERhM29nYGBddr//5/DGRjYNRkY/l7////39v///y4Dmn+LgesAKI8KJgAAAAlwSFlzAAAOwgAADsIBFShKgAAAABl0RVh0U29mdHdhcmUAcGFpbnQubmV0IDQuMC4xMkMEa+wAAABYSURBVHic7cEBDQAAAMKg909tDjegAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADgNwMNIAAB7ePtWQAAAABJRU5ErkJggg=="
                      />
                    ))}
                  </Space>
                </Image.PreviewGroup>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default VisitRecordList;
