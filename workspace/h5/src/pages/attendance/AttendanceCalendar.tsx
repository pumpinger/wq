import React, { useState, useMemo } from 'react';
import { Popup, Card } from 'antd-mobile';
import { LeftOutline, RightOutline } from 'antd-mobile-icons';
import { useQuery } from '@tanstack/react-query';
import api from '../../api';
import dayjs from 'dayjs';

interface AttendanceRecord {
  id: number;
  work_date: string;
  punch_in_time: string | null;
  punch_out_time: string | null;
  work_hours: number | null;
  status: string;
}

interface MonthlyStats {
  total_days: number;
  normal_days: number;
  late_days: number;
  early_leave_days: number;
  absent_days: number;
  total_work_hours: number;
}

const attendanceCalendarKeys = {
  myRecords: (year: number, month: number) => ['attendance', 'myRecords', year, month] as const,
  myMonthlyStats: (year: number, month: number) => ['attendance', 'myMonthlyStats', year, month] as const,
};

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

const statusColorMap: Record<string, string> = {
  normal: '#00b578',
  late: '#ff8f1f',
  early_leave: '#ff8f1f',
  late_and_early: '#ff3141',
  absent: '#ff3141',
  incomplete: '#999',
};

const statusTextMap: Record<string, string> = {
  normal: '正常',
  late: '迟到',
  early_leave: '早退',
  late_and_early: '迟到+早退',
  absent: '缺勤',
  incomplete: '未完成',
};

const AttendanceCalendar: React.FC = () => {
  const [currentMonth, setCurrentMonth] = useState(dayjs().startOf('month'));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [popupVisible, setPopupVisible] = useState(false);

  const year = currentMonth.year();
  const month = currentMonth.month() + 1;

  // Fetch records
  const { data: records = [] } = useQuery({
    queryKey: attendanceCalendarKeys.myRecords(year, month),
    queryFn: () =>
      api
        .get<AttendanceRecord[] | { items: AttendanceRecord[] }>('/attendance/records/my', {
          params: { year, month },
        })
        .then((r) => {
          const d = r.data;
          return Array.isArray(d) ? d : (d as any).items || [];
        }),
  });

  // Fetch monthly stats
  const { data: stats } = useQuery({
    queryKey: attendanceCalendarKeys.myMonthlyStats(year, month),
    queryFn: () =>
      api
        .get<MonthlyStats>('/attendance/stats/my-monthly', { params: { year, month } })
        .then((r) => r.data),
  });

  // Build date->record map
  const recordMap = useMemo(() => {
    const map: Record<string, AttendanceRecord> = {};
    records.forEach((r: AttendanceRecord) => {
      const key = dayjs(r.work_date).format('YYYY-MM-DD');
      map[key] = r;
    });
    return map;
  }, [records]);

  // Generate calendar grid
  const calendarDays = useMemo(() => {
    const startOfMonth = currentMonth.startOf('month');
    const endOfMonth = currentMonth.endOf('month');
    const startDay = startOfMonth.day(); // 0=Sunday
    const daysInMonth = endOfMonth.date();

    const days: Array<{ date: dayjs.Dayjs | null; key: string }> = [];

    // Leading empty cells
    for (let i = 0; i < startDay; i++) {
      days.push({ date: null, key: `empty-start-${i}` });
    }

    // Actual days
    for (let d = 1; d <= daysInMonth; d++) {
      const date = currentMonth.date(d);
      days.push({ date, key: date.format('YYYY-MM-DD') });
    }

    // Trailing empty cells to fill last row
    const remainder = days.length % 7;
    if (remainder > 0) {
      for (let i = 0; i < 7 - remainder; i++) {
        days.push({ date: null, key: `empty-end-${i}` });
      }
    }

    return days;
  }, [currentMonth]);

  const handlePrevMonth = () => setCurrentMonth((m) => m.subtract(1, 'month'));
  const handleNextMonth = () => setCurrentMonth((m) => m.add(1, 'month'));

  const handleDayClick = (dateStr: string) => {
    setSelectedDate(dateStr);
    setPopupVisible(true);
  };

  const selectedRecord = selectedDate ? recordMap[selectedDate] : null;

  const today = dayjs().format('YYYY-MM-DD');

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      {/* Month Picker Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          background: '#fff',
        }}
      >
        <span onClick={handlePrevMonth} style={{ padding: 8, cursor: 'pointer' }}>
          <LeftOutline fontSize={18} />
        </span>
        <span style={{ fontSize: 17, fontWeight: 600 }}>{currentMonth.format('YYYY年MM月')}</span>
        <span onClick={handleNextMonth} style={{ padding: 8, cursor: 'pointer' }}>
          <RightOutline fontSize={18} />
        </span>
      </div>

      {/* Calendar Grid */}
      <div style={{ background: '#fff', padding: '0 8px 12px' }}>
        {/* Weekday headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center' }}>
          {WEEKDAYS.map((w) => (
            <div
              key={w}
              style={{
                padding: '8px 0',
                fontSize: 12,
                color: '#999',
                fontWeight: 500,
              }}
            >
              {w}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center' }}>
          {calendarDays.map(({ date, key }) => {
            if (!date) {
              return <div key={key} style={{ padding: '10px 0' }} />;
            }

            const dateStr = date.format('YYYY-MM-DD');
            const record = recordMap[dateStr];
            const isToday = dateStr === today;
            const dotColor = record ? statusColorMap[record.status] || '#999' : undefined;

            return (
              <div
                key={key}
                onClick={() => handleDayClick(dateStr)}
                style={{
                  padding: '6px 0',
                  cursor: 'pointer',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    lineHeight: '32px',
                    borderRadius: '50%',
                    margin: '0 auto',
                    fontSize: 14,
                    fontWeight: isToday ? 700 : 400,
                    color: isToday ? '#fff' : '#333',
                    background: isToday ? '#1677ff' : 'transparent',
                  }}
                >
                  {date.date()}
                </div>
                {dotColor && (
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: dotColor,
                      margin: '2px auto 0',
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Monthly Stats */}
      <div style={{ padding: '12px 16px' }}>
        <Card style={{ borderRadius: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#00b578' }}>
                {stats?.total_days ?? '--'}
              </div>
              <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>出勤(天)</div>
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#ff8f1f' }}>
                {stats?.late_days ?? '--'}
              </div>
              <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>迟到(次)</div>
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#ff8f1f' }}>
                {stats?.early_leave_days ?? '--'}
              </div>
              <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>早退(次)</div>
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#ff3141' }}>
                {stats?.absent_days ?? '--'}
              </div>
              <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>缺勤(天)</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Legend */}
      <div style={{ padding: '0 16px 16px' }}>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          {[
            { color: '#00b578', label: '正常' },
            { color: '#ff8f1f', label: '迟到/早退' },
            { color: '#ff3141', label: '缺勤' },
            { color: '#999', label: '未完成' },
          ].map((item) => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: item.color,
                }}
              />
              <span style={{ fontSize: 12, color: '#666' }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Day Detail Popup */}
      <Popup
        visible={popupVisible}
        onMaskClick={() => setPopupVisible(false)}
        bodyStyle={{ borderTopLeftRadius: 12, borderTopRightRadius: 12, padding: 20 }}
      >
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
            {selectedDate ? dayjs(selectedDate).format('YYYY年MM月DD日') : ''}
          </div>

          {selectedRecord ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#999' }}>状态</span>
                <span
                  style={{
                    color: statusColorMap[selectedRecord.status] || '#999',
                    fontWeight: 500,
                  }}
                >
                  {statusTextMap[selectedRecord.status] || selectedRecord.status}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#999' }}>签到时间</span>
                <span>
                  {selectedRecord.punch_in_time
                    ? dayjs(selectedRecord.punch_in_time).format('HH:mm:ss')
                    : '--'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#999' }}>签退时间</span>
                <span>
                  {selectedRecord.punch_out_time
                    ? dayjs(selectedRecord.punch_out_time).format('HH:mm:ss')
                    : '--'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#999' }}>工时</span>
                <span>
                  {selectedRecord.work_hours != null
                    ? `${selectedRecord.work_hours.toFixed(1)} 小时`
                    : '--'}
                </span>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: '#999', padding: '20px 0' }}>
              暂无考勤记录
            </div>
          )}
        </div>
      </Popup>
    </div>
  );
};

export default AttendanceCalendar;
