import React, { useState, useMemo } from 'react';
import {
  Card,
  Table,
  Button,
  Tag,
  Space,
  DatePicker,
  Select,
  Popover,
  message,
  Modal,
  Form,
} from 'antd';
import { ScheduleOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { attendanceApi, userApi } from '../../api';
import { queryKeys } from '../../api/queryKeys';
import type { AttendanceShift, AttendanceScheduleItem } from '../../types';
import dayjs, { Dayjs } from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(isoWeek);

interface UserItem {
  id: number;
  username: string;
  full_name?: string;
}

const AttendanceSchedulePage: React.FC = () => {
  const queryClient = useQueryClient();
  const [weekStart, setWeekStart] = useState<Dayjs>(dayjs().startOf('isoWeek'));
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkForm] = Form.useForm();

  const weekEnd = weekStart.add(6, 'day');

  // 一周的日期数组
  const weekDates = useMemo(() => {
    const dates: Dayjs[] = [];
    for (let i = 0; i < 7; i++) {
      dates.push(weekStart.add(i, 'day'));
    }
    return dates;
  }, [weekStart]);

  const filters = useMemo(
    () => ({ start_date: weekStart.format('YYYY-MM-DD'), end_date: weekEnd.format('YYYY-MM-DD') }),
    [weekStart, weekEnd],
  );

  // 获取员工列表
  const { data: usersData } = useQuery({
    queryKey: queryKeys.users.list(),
    queryFn: async () => {
      const res = await userApi.list({ page_size: 500 });
      return res.data;
    },
  });

  const users: UserItem[] = useMemo(() => {
    if (!usersData) return [];
    return Array.isArray(usersData) ? usersData : usersData.items || [];
  }, [usersData]);

  // 获取班次列表
  const { data: shifts } = useQuery({
    queryKey: queryKeys.attendance.shifts(),
    queryFn: async () => {
      const res = await attendanceApi.listShifts();
      return res.data as AttendanceShift[];
    },
  });

  // 获取排班数据
  const { data: schedules, isLoading } = useQuery({
    queryKey: queryKeys.attendance.schedules(filters),
    queryFn: async () => {
      const res = await attendanceApi.listSchedules(filters);
      return res.data as AttendanceScheduleItem[];
    },
  });

  // 排班数据索引: `${user_id}_${date}` -> schedule
  const scheduleMap = useMemo(() => {
    const map: Record<string, AttendanceScheduleItem> = {};
    schedules?.forEach((s) => {
      map[`${s.user_id}_${s.work_date}`] = s;
    });
    return map;
  }, [schedules]);

  // 批量排班
  const batchMutation = useMutation({
    mutationFn: (data: { items: any[] }) => attendanceApi.batchSchedule(data),
    onSuccess: () => {
      message.success('排班保存成功');
      queryClient.invalidateQueries({ queryKey: queryKeys.attendance.schedules(filters) });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || '排班失败');
    },
  });

  // 单个单元格指定班次
  const handleAssignShift = (userId: number, date: string, shiftId: number) => {
    batchMutation.mutate({
      items: [{ user_id: userId, work_date: date, shift_id: shiftId }],
    });
  };

  // 批量排班提交
  const handleBulkSubmit = async () => {
    try {
      const values = await bulkForm.validateFields();
      const { user_ids, date_range, shift_id } = values;
      const [start, end] = date_range;
      const items: any[] = [];
      let current = start.startOf('day');
      while (current.isBefore(end.add(1, 'day').startOf('day'))) {
        user_ids.forEach((uid: number) => {
          items.push({ user_id: uid, work_date: current.format('YYYY-MM-DD'), shift_id });
        });
        current = current.add(1, 'day');
      }
      batchMutation.mutate({ items });
      setBulkModalOpen(false);
      bulkForm.resetFields();
    } catch {
      // validation error
    }
  };

  // 单元格渲染
  const renderCell = (userId: number, date: Dayjs) => {
    const dateStr = date.format('YYYY-MM-DD');
    const schedule = scheduleMap[`${userId}_${dateStr}`];

    const content = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {shifts?.map((s) => (
          <Button
            key={s.id}
            size="small"
            type={schedule?.shift_id === s.id ? 'primary' : 'default'}
            onClick={() => handleAssignShift(userId, dateStr, s.id)}
            style={{ textAlign: 'left' }}
          >
            {s.name}
          </Button>
        ))}
      </div>
    );

    return (
      <Popover content={content} title="选择班次" trigger="click" placement="bottom">
        <div style={{ cursor: 'pointer', minHeight: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {schedule ? (
            <Tag color="blue" style={{ margin: 0 }}>
              {schedule.shift_name || `班次${schedule.shift_id}`}
            </Tag>
          ) : (
            <span style={{ color: '#ccc' }}>-</span>
          )}
        </div>
      </Popover>
    );
  };

  // 表格列
  const columns = [
    {
      title: '员工',
      dataIndex: 'full_name',
      key: 'full_name',
      width: 100,
      fixed: 'left' as const,
      render: (name: string, record: UserItem) => name || record.username,
    },
    ...weekDates.map((date) => ({
      title: (
        <div style={{ textAlign: 'center' as const, lineHeight: '1.3' }}>
          <div>{['周一', '周二', '周三', '周四', '周五', '周六', '周日'][date.isoWeekday() - 1]}</div>
          <div style={{ fontSize: 12, color: '#999' }}>{date.format('MM-DD')}</div>
        </div>
      ),
      key: date.format('YYYY-MM-DD'),
      width: 90,
      render: (_: any, record: UserItem) => renderCell(record.id, date),
    })),
  ];

  return (
    <Card
      title="排班管理"
      extra={
        <Space>
          <DatePicker
            picker="week"
            value={weekStart}
            onChange={(val) => val && setWeekStart(val.startOf('isoWeek'))}
            allowClear={false}
          />
          <Button
            type="primary"
            size="small"
            icon={<ScheduleOutlined />}
            onClick={() => setBulkModalOpen(true)}
          >
            批量排班
          </Button>
        </Space>
      }
    >
      <Table
        columns={columns}
        dataSource={users}
        rowKey="id"
        loading={isLoading}
        pagination={false}
        scroll={{ x: 800 }}
        size="small"
        bordered
      />

      {/* 批量排班弹窗 */}
      <Modal
        title="批量排班"
        open={bulkModalOpen}
        onOk={handleBulkSubmit}
        onCancel={() => {
          setBulkModalOpen(false);
          bulkForm.resetFields();
        }}
        confirmLoading={batchMutation.isPending}
      >
        <Form form={bulkForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="user_ids" label="选择员工" rules={[{ required: true, message: '请选择员工' }]}>
            <Select
              mode="multiple"
              placeholder="请选择员工"
              options={users.map((u) => ({ value: u.id, label: u.full_name || u.username }))}
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item name="date_range" label="日期范围" rules={[{ required: true, message: '请选择日期范围' }]}>
            <DatePicker.RangePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="shift_id" label="班次" rules={[{ required: true, message: '请选择班次' }]}>
            <Select
              placeholder="请选择班次"
              options={shifts?.map((s) => ({ value: s.id, label: s.name })) || []}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default AttendanceSchedulePage;
