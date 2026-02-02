import React, { useState, useEffect, useCallback } from 'react';
import { Button, Toast, Card, DotLoading } from 'antd-mobile';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../api';
import dayjs from 'dayjs';

interface AttendanceRecord {
  id: number;
  punch_in_time: string | null;
  punch_out_time: string | null;
  punch_in_lat: number | null;
  punch_in_lng: number | null;
  punch_out_lat: number | null;
  punch_out_lng: number | null;
  work_hours: number | null;
  status: string;
  shift_name?: string;
  shift_start?: string;
  shift_end?: string;
}

const attendanceKeys = {
  today: ['attendance', 'today'] as const,
};

const AttendancePunch: React.FC = () => {
  const queryClient = useQueryClient();
  const [currentTime, setCurrentTime] = useState(dayjs());
  const [punching, setPunching] = useState(false);

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(dayjs());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch today's record
  const { data: todayRecord, isLoading } = useQuery({
    queryKey: attendanceKeys.today,
    queryFn: () => api.get<AttendanceRecord>('/attendance/records/today').then((r) => r.data),
    retry: false,
  });

  const hasPunchedIn = !!todayRecord?.punch_in_time;
  const hasPunchedOut = !!todayRecord?.punch_out_time;
  const allDone = hasPunchedIn && hasPunchedOut;

  const getButtonText = () => {
    if (allDone) return '已完成';
    if (hasPunchedIn) return '签退';
    return '签到';
  };

  const getPosition = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('浏览器不支持定位'));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      });
    });
  };

  const handlePunch = useCallback(async () => {
    if (allDone || punching) return;

    setPunching(true);
    try {
      const position = await getPosition();
      const { latitude: lat, longitude: lng } = position.coords;

      await api.post('/attendance/punch', { lat, lng });

      Toast.show({
        icon: 'success',
        content: hasPunchedIn ? '签退成功' : '签到成功',
      });

      queryClient.invalidateQueries({ queryKey: attendanceKeys.today });
    } catch (err: any) {
      if (err?.code === 1) {
        Toast.show({ icon: 'fail', content: '请允许获取位置权限' });
      } else if (err?.code === 2) {
        Toast.show({ icon: 'fail', content: '无法获取位置信息' });
      } else if (err?.code === 3) {
        Toast.show({ icon: 'fail', content: '定位超时，请重试' });
      } else {
        const msg = err?.response?.data?.detail || err?.message || '打卡失败';
        Toast.show({ icon: 'fail', content: msg });
      }
    } finally {
      setPunching(false);
    }
  }, [allDone, punching, hasPunchedIn, queryClient]);

  const formatTime = (t: string | null | undefined) => {
    if (!t) return '--:--';
    return dayjs(t).format('HH:mm:ss');
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f5f5f5',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {/* Header */}
      <div
        style={{
          width: '100%',
          padding: '24px 16px 16px',
          background: 'linear-gradient(135deg, #1677ff 0%, #4096ff 100%)',
          color: '#fff',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 14, opacity: 0.85 }}>
          {currentTime.format('YYYY年MM月DD日 dddd')}
        </div>
        <div style={{ fontSize: 40, fontWeight: 700, fontVariantNumeric: 'tabular-nums', marginTop: 4 }}>
          {currentTime.format('HH:mm:ss')}
        </div>
        {todayRecord?.shift_name && (
          <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>
            {todayRecord.shift_name}
            {todayRecord.shift_start && todayRecord.shift_end
              ? ` (${todayRecord.shift_start} - ${todayRecord.shift_end})`
              : ''}
          </div>
        )}
      </div>

      {/* Punch Button */}
      <div style={{ marginTop: 40, marginBottom: 32 }}>
        {isLoading ? (
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #1677ff 0%, #69b1ff 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
            }}
          >
            <DotLoading color="white" />
          </div>
        ) : (
          <Button
            disabled={allDone || punching}
            onClick={handlePunch}
            style={{
              width: 120,
              height: 120,
              borderRadius: '50%',
              background: allDone
                ? 'linear-gradient(135deg, #999 0%, #bbb 100%)'
                : 'linear-gradient(135deg, #1677ff 0%, #69b1ff 100%)',
              color: '#fff',
              fontSize: 20,
              fontWeight: 600,
              border: 'none',
              boxShadow: allDone
                ? '0 4px 16px rgba(0,0,0,0.1)'
                : '0 4px 20px rgba(22,119,255,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
            }}
          >
            {punching ? <DotLoading color="white" /> : getButtonText()}
          </Button>
        )}
      </div>

      {/* Today Record Summary */}
      <div style={{ width: '100%', padding: '0 16px' }}>
        <Card
          title="今日考勤"
          style={{ borderRadius: 12 }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
            <div>
              <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>签到时间</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: hasPunchedIn ? '#00b578' : '#ccc' }}>
                {formatTime(todayRecord?.punch_in_time)}
              </div>
            </div>
            <div
              style={{
                width: 1,
                background: '#eee',
                alignSelf: 'stretch',
              }}
            />
            <div>
              <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>签退时间</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: hasPunchedOut ? '#00b578' : '#ccc' }}>
                {formatTime(todayRecord?.punch_out_time)}
              </div>
            </div>
            <div
              style={{
                width: 1,
                background: '#eee',
                alignSelf: 'stretch',
              }}
            />
            <div>
              <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>工时</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: todayRecord?.work_hours ? '#1677ff' : '#ccc' }}>
                {todayRecord?.work_hours != null
                  ? `${todayRecord.work_hours.toFixed(1)}h`
                  : '--'}
              </div>
            </div>
          </div>

          {todayRecord?.status && (
            <div style={{ marginTop: 12, textAlign: 'center' }}>
              <span
                style={{
                  display: 'inline-block',
                  padding: '2px 12px',
                  borderRadius: 10,
                  fontSize: 12,
                  background:
                    todayRecord.status === 'normal'
                      ? '#e6f7ee'
                      : todayRecord.status === 'late' || todayRecord.status === 'early_leave'
                        ? '#fff7e6'
                        : todayRecord.status === 'absent' || todayRecord.status === 'late_and_early'
                          ? '#fff1f0'
                          : '#f5f5f5',
                  color:
                    todayRecord.status === 'normal'
                      ? '#00b578'
                      : todayRecord.status === 'late' || todayRecord.status === 'early_leave'
                        ? '#ff8f1f'
                        : todayRecord.status === 'absent' || todayRecord.status === 'late_and_early'
                          ? '#ff3141'
                          : '#999',
                }}
              >
                {todayRecord.status === 'normal' && '正常'}
                {todayRecord.status === 'late' && '迟到'}
                {todayRecord.status === 'early_leave' && '早退'}
                {todayRecord.status === 'late_and_early' && '迟到+早退'}
                {todayRecord.status === 'absent' && '缺勤'}
                {todayRecord.status === 'incomplete' && '未完成'}
              </span>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default AttendancePunch;
