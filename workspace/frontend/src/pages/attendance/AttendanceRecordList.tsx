import React, { useState, useMemo } from 'react';
import {
  Card,
  Table,
  Tag,
  Space,
  DatePicker,
  Select,
} from 'antd';
import { useQuery } from '@tanstack/react-query';
import { attendanceApi, userApi } from '../../api';
import { queryKeys } from '../../api/queryKeys';
import type { AttendanceRecord } from '../../types';
import dayjs from 'dayjs';

interface UserItem {
  id: number;
  username: string;
  full_name?: string;
}

const statusTagMap: Record<string, { color: string; label: string }> = {
  normal: { color: 'green', label: '正常' },
  late: { color: 'orange', label: '迟到' },
  early_leave: { color: 'gold', label: '早退' },
  late_and_early: { color: 'red', label: '迟到+早退' },
  absent: { color: 'red', label: '缺勤' },
  incomplete: { color: 'default', label: '未完成' },
};

const punchStatusTagMap: Record<string, { color: string; label: string }> = {
  normal: { color: 'green', label: '正常' },
  late: { color: 'orange', label: '迟到' },
  early: { color: 'gold', label: '早退' },
  missing: { color: 'default', label: '缺卡' },
};

const AttendanceRecordListPage: React.FC = () => {
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().startOf('month'),
    dayjs().endOf('month'),
  ]);
  const [selectedUserId, setSelectedUserId] = useState<number | undefined>();
  const [selectedStatus, setSelectedStatus] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const filters = useMemo(
    () => ({
      start_date: dateRange[0].format('YYYY-MM-DD'),
      end_date: dateRange[1].format('YYYY-MM-DD'),
      user_id: selectedUserId,
      status: selectedStatus,
      page,
      page_size: pageSize,
    }),
    [dateRange, selectedUserId, selectedStatus, page],
  );

  // 员工列表
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

  // 考勤记录
  const { data: recordsData, isLoading } = useQuery({
    queryKey: queryKeys.attendance.records(filters),
    queryFn: async () => {
      const res = await attendanceApi.listRecords(filters);
      return res.data;
    },
  });

  const records: AttendanceRecord[] = useMemo(() => {
    if (!recordsData) return [];
    return Array.isArray(recordsData) ? recordsData : recordsData.items || [];
  }, [recordsData]);

  const total: number = recordsData?.total ?? records.length;

  const renderPunchStatus = (status?: string) => {
    if (!status) return '-';
    const cfg = punchStatusTagMap[status];
    return cfg ? <Tag color={cfg.color}>{cfg.label}</Tag> : <Tag>{status}</Tag>;
  };

  const renderStatus = (status: string) => {
    const cfg = statusTagMap[status];
    return cfg ? <Tag color={cfg.color}>{cfg.label}</Tag> : <Tag>{status}</Tag>;
  };

  const columns = [
    { title: '日期', dataIndex: 'work_date', key: 'work_date', width: 100 },
    { title: '员工', dataIndex: 'user_name', key: 'user_name', width: 90 },
    { title: '班次', dataIndex: 'shift_name', key: 'shift_name', width: 80, render: (v: string) => v || '-' },
    {
      title: '签到时间',
      dataIndex: 'punch_in_time',
      key: 'punch_in_time',
      width: 90,
      render: (v: string) => (v ? dayjs(v).format('HH:mm:ss') : '-'),
    },
    {
      title: '签到状态',
      dataIndex: 'punch_in_status',
      key: 'punch_in_status',
      width: 80,
      render: renderPunchStatus,
    },
    {
      title: '签退时间',
      dataIndex: 'punch_out_time',
      key: 'punch_out_time',
      width: 90,
      render: (v: string) => (v ? dayjs(v).format('HH:mm:ss') : '-'),
    },
    {
      title: '签退状态',
      dataIndex: 'punch_out_status',
      key: 'punch_out_status',
      width: 80,
      render: renderPunchStatus,
    },
    {
      title: '工时(h)',
      dataIndex: 'work_hours',
      key: 'work_hours',
      width: 70,
      render: (v: number) => (v != null ? v.toFixed(1) : '-'),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: renderStatus,
    },
  ];

  return (
    <Card title="考勤记录">
      <Space style={{ marginBottom: 16 }} wrap>
        <DatePicker.RangePicker
          value={dateRange}
          onChange={(vals) => {
            if (vals && vals[0] && vals[1]) {
              setDateRange([vals[0], vals[1]]);
              setPage(1);
            }
          }}
          allowClear={false}
        />
        <Select
          placeholder="选择员工"
          allowClear
          style={{ width: 150 }}
          value={selectedUserId}
          onChange={(v) => {
            setSelectedUserId(v);
            setPage(1);
          }}
          options={users.map((u) => ({ value: u.id, label: u.full_name || u.username }))}
        />
        <Select
          placeholder="考勤状态"
          allowClear
          style={{ width: 130 }}
          value={selectedStatus}
          onChange={(v) => {
            setSelectedStatus(v);
            setPage(1);
          }}
          options={Object.entries(statusTagMap).map(([k, v]) => ({ value: k, label: v.label }))}
        />
      </Space>

      <Table
        columns={columns}
        dataSource={records}
        rowKey="id"
        loading={isLoading}
        size="small"
        scroll={{ x: 900 }}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: false,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (p) => setPage(p),
        }}
      />
    </Card>
  );
};

export default AttendanceRecordListPage;
