import React, { useState } from 'react';
import {
  Table, Button, Space, Tag, Select, DatePicker, Row, Col, Card, Drawer,
  Descriptions, Divider, message, Image,
} from 'antd';
import { EyeOutlined, ReloadOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { visitTaskApi, visitTaskTypeApi, visitRecordApi, userApi } from '../api';
import type { VisitTask, VisitTaskType, VisitRecord } from '../types';
import { queryKeys } from '../api/queryKeys';

const { RangePicker } = DatePicker;

const TASK_STATUS_MAP: Record<string, { color: string; label: string }> = {
  pending: { color: 'default', label: '待执行' },
  checked_in: { color: 'processing', label: '已签到' },
  completed: { color: 'green', label: '已完成' },
  cancelled: { color: 'red', label: '已取消' },
};

const PRIORITY_MAP: Record<string, { color: string; label: string }> = {
  high: { color: 'red', label: '高' },
  medium: { color: 'orange', label: '中' },
  low: { color: 'blue', label: '低' },
};

interface FilterState {
  date_from?: string;
  date_to?: string;
  assigned_to?: number;
  task_type_id?: number;
  status?: string;
}

const VisitTaskList: React.FC = () => {
  const [filters, setFilters] = useState<FilterState>({});
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedTask, setSelectedTask] = useState<VisitTask | undefined>();
  const [relatedRecord, setRelatedRecord] = useState<VisitRecord | undefined>();

  // 获取任务列表
  const { data: tasks, isLoading } = useQuery({
    queryKey: queryKeys.visitTasks.list(filters),
    queryFn: () => visitTaskApi.list({ ...filters, limit: 200 }).then((res) => {
      const d = res.data;
      return (Array.isArray(d) ? d : d.items || d.data || []) as VisitTask[];
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

  const handleView = async (record: VisitTask) => {
    try {
      const res = await visitTaskApi.get(record.id);
      const task = res.data as VisitTask;
      setSelectedTask(task);
      setRelatedRecord(undefined);

      // 如果任务已完成，尝试获取关联的拜访记录
      if (task.status === 'completed' || task.status === 'checked_in') {
        try {
          const recordRes = await visitRecordApi.list({
            customer_id: task.customer_id,
            date_from: task.planned_date,
            date_to: task.planned_date,
            limit: 1,
          });
          const records = recordRes.data;
          const arr = Array.isArray(records) ? records : records.items || records.data || [];
          if (arr.length > 0) {
            const detailRes = await visitRecordApi.get(arr[0].id);
            setRelatedRecord(detailRes.data as VisitRecord);
          }
        } catch {
          // ignore - record might not exist
        }
      }
      setDrawerVisible(true);
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
      title: '计划日期',
      dataIndex: 'planned_date',
      key: 'planned_date',
      width: 120,
      render: (text: string) => dayjs(text).format('YYYY-MM-DD'),
    },
    {
      title: '客户名称',
      dataIndex: 'customer_name',
      key: 'customer_name',
      width: 160,
      ellipsis: true,
    },
    {
      title: '任务类型',
      key: 'task_type',
      width: 120,
      render: (_: any, record: VisitTask) => (
        <Tag color={record.task_type_color || 'blue'}>
          {record.task_type_name || '-'}
        </Tag>
      ),
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
        const info = TASK_STATUS_MAP[status] || { color: 'default', label: status };
        return <Tag color={info.color}>{info.label}</Tag>;
      },
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 80,
      render: (p: string) => {
        const info = PRIORITY_MAP[p] || { color: 'default', label: p };
        return <Tag color={info.color}>{info.label}</Tag>;
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
      width: 80,
      fixed: 'right' as const,
      render: (_: any, record: VisitTask) => (
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
          <Col>
            <Select
              placeholder="状态"
              style={{ width: 120 }}
              allowClear
              value={filters.status}
              onChange={(v) => setFilters({ ...filters, status: v })}
            >
              {Object.entries(TASK_STATUS_MAP).map(([k, v]) => (
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
            <Tag color="blue">{tasks?.length || 0} 条记录</Tag>
          </Col>
        </Row>
      </Card>

      <Table
        columns={columns}
        dataSource={tasks}
        rowKey="id"
        loading={isLoading}
        scroll={{ x: 950 }}
        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
        onRow={(record) => ({
          onClick: () => handleView(record),
          style: { cursor: 'pointer' },
        })}
      />

      {/* 任务详情 Drawer */}
      <Drawer
        title="任务详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={580}
      >
        {selectedTask && (
          <div>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="任务ID">{selectedTask.id}</Descriptions.Item>
              <Descriptions.Item label="计划日期">
                {dayjs(selectedTask.planned_date).format('YYYY-MM-DD')}
              </Descriptions.Item>
              <Descriptions.Item label="客户名称" span={2}>
                {selectedTask.customer_name || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="客户地址" span={2}>
                {selectedTask.customer_address || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="任务类型">
                <Tag color={selectedTask.task_type_color || 'blue'}>
                  {selectedTask.task_type_name || '-'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="优先级">
                <Tag color={PRIORITY_MAP[selectedTask.priority]?.color || 'default'}>
                  {PRIORITY_MAP[selectedTask.priority]?.label || selectedTask.priority}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="负责人">{selectedTask.assignee_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={TASK_STATUS_MAP[selectedTask.status]?.color || 'default'}>
                  {TASK_STATUS_MAP[selectedTask.status]?.label || selectedTask.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="备注" span={2}>
                {selectedTask.remark || '-'}
              </Descriptions.Item>
            </Descriptions>

            {/* 拜访记录信息 */}
            {relatedRecord && (
              <>
                <Divider>拜访记录</Divider>
                <Descriptions bordered column={2} size="small">
                  <Descriptions.Item label="签到时间">
                    {dayjs(relatedRecord.check_in_time).format('YYYY-MM-DD HH:mm:ss')}
                  </Descriptions.Item>
                  <Descriptions.Item label="签退时间">
                    {relatedRecord.check_out_time
                      ? dayjs(relatedRecord.check_out_time).format('YYYY-MM-DD HH:mm:ss')
                      : '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="时长">
                    {relatedRecord.duration_minutes != null ? `${relatedRecord.duration_minutes} 分钟` : '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="签到地址">
                    {relatedRecord.check_in_address || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="签到距离" span={2}>
                    {relatedRecord.check_in_distance != null ? `${relatedRecord.check_in_distance} 米` : '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="备注" span={2}>
                    {relatedRecord.remark || '-'}
                  </Descriptions.Item>
                </Descriptions>

                {/* 表单字段值 */}
                {relatedRecord.field_values && relatedRecord.field_values.length > 0 && (
                  <>
                    <Divider>表单数据</Divider>
                    <Descriptions bordered column={2} size="small">
                      {relatedRecord.field_values.map((fv, idx) => (
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
                {relatedRecord.photos && relatedRecord.photos.length > 0 && (
                  <>
                    <Divider>拜访照片</Divider>
                    <Image.PreviewGroup>
                      <Space wrap>
                        {relatedRecord.photos.map((photo) => (
                          <Image
                            key={photo.id}
                            width={100}
                            height={100}
                            src={photo.file_path}
                            style={{ objectFit: 'cover', borderRadius: 4 }}
                            fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMIAAADDCAYAAADQvc6UAAABRWlDQ1BJQ0MgUHJvZmlsZQAAKJFjYGASSSwoyGFhYGDIzSspCnJ3UoiIjFJgf8LAwSDCIMogwMCcmFxc4BgQ4ANUwgCjUcG3awyMIPqyLsis7PPOq3QdDFcvjV3jOD1boQVTPQrgSkktTgbSf4A4LbmgqISBgTEFyFYuLykAsTuAbJEioKOA7DkgdjqEvQHEToKwj4DVhAQ5A9k3gGyB5IxEoBmML4BsnSQk8XQkNtReEOBxcfXxUQg1Mjc0dyHgXNJBSWpFCYh2zi+oLMpMzyhRcASGUqqCZ16yno6CkYGRAQMDKMwhqj/fAIcloxgHQqxAjIHBEugw5sUIsSQpBobtQPdLciLEVJYzMPBHMDBsayhILEqEO4DxG0txmrERhM29nYGBddr//5/DGRjYNRkY/l7////39v///y4Dmn+LgesAKI8KJgAAAAlwSFlzAAAOwgAADsIBFShKgAAAABl0RVh0U29mdHdhcmUAcGFpbnQubmV0IDQuMC4xMkMEa+wAAABYSURBVHic7cEBDQAAAMKg909tDjegAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADgNwMNIAAB7ePtWQAAAABJRU5ErkJggg=="
                          />
                        ))}
                      </Space>
                    </Image.PreviewGroup>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default VisitTaskList;
