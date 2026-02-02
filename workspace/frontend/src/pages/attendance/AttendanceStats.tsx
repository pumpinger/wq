import React, { useState, useMemo } from 'react';
import {
  Card,
  Table,
  DatePicker,
  Space,
} from 'antd';
import { useQuery } from '@tanstack/react-query';
import { attendanceApi } from '../../api';
import { queryKeys } from '../../api/queryKeys';
import type { MonthlyStatsItem } from '../../types';
import dayjs from 'dayjs';

const AttendanceStatsPage: React.FC = () => {
  const [year, setYear] = useState(dayjs().year());
  const [month, setMonth] = useState(dayjs().month() + 1);

  const filters = useMemo(() => ({ year, month }), [year, month]);

  const { data: statsData, isLoading } = useQuery({
    queryKey: queryKeys.attendance.monthlyStats(filters),
    queryFn: async () => {
      const res = await attendanceApi.monthlyStats(filters);
      return res.data;
    },
  });

  const stats: MonthlyStatsItem[] = useMemo(() => {
    if (!statsData) return [];
    return Array.isArray(statsData) ? statsData : statsData.items || [];
  }, [statsData]);

  const columns = [
    { title: '员工', dataIndex: 'user_name', key: 'user_name', width: 100 },
    { title: '出勤天数', dataIndex: 'total_days', key: 'total_days', width: 80 },
    { title: '正常天数', dataIndex: 'normal_days', key: 'normal_days', width: 80 },
    { title: '迟到天数', dataIndex: 'late_days', key: 'late_days', width: 80 },
    { title: '早退天数', dataIndex: 'early_leave_days', key: 'early_leave_days', width: 80 },
    { title: '缺勤天数', dataIndex: 'absent_days', key: 'absent_days', width: 80 },
    {
      title: '总工时(h)',
      dataIndex: 'total_work_hours',
      key: 'total_work_hours',
      width: 90,
      render: (v: number) => (v != null ? v.toFixed(1) : '-'),
    },
  ];

  return (
    <Card
      title="月度考勤统计"
      extra={
        <Space>
          <DatePicker
            picker="month"
            value={dayjs(`${year}-${String(month).padStart(2, '0')}-01`)}
            onChange={(val) => {
              if (val) {
                setYear(val.year());
                setMonth(val.month() + 1);
              }
            }}
            allowClear={false}
          />
        </Space>
      }
    >
      <Table
        columns={columns}
        dataSource={stats}
        rowKey="user_id"
        loading={isLoading}
        pagination={false}
        size="small"
        scroll={{ x: 600 }}
      />
    </Card>
  );
};

export default AttendanceStatsPage;
