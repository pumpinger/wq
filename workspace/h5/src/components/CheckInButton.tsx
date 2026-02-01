import React, { useState, useEffect, useCallback } from 'react';
import { Toast, SpinLoading } from 'antd-mobile';
import { LocationOutline } from 'antd-mobile-icons';
import { useMutation } from '@tanstack/react-query';
import { visitApi } from '../api';
import type { VisitTask } from '../types';

interface CheckInButtonProps {
  task: VisitTask;
  onSuccess: (recordId: number) => void;
}

type GpsStatus = 'loading' | 'ready' | 'error';

function getDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const CheckInButton: React.FC<CheckInButtonProps> = ({ task, onSuccess }) => {
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>('loading');
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);

  const getPosition = useCallback(() => {
    setGpsStatus('loading');
    if (!navigator.geolocation) {
      setGpsStatus('error');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPosition(coords);
        setGpsStatus('ready');
        if (task.customer_lat && task.customer_lng) {
          const dist = getDistanceMeters(coords.lat, coords.lng, task.customer_lat, task.customer_lng);
          setDistance(Math.round(dist));
        }
      },
      (err) => {
        console.error('GPS error:', err);
        setGpsStatus('error');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, [task.customer_lat, task.customer_lng]);

  useEffect(() => {
    getPosition();
  }, [getPosition]);

  const checkInMutation = useMutation({
    mutationFn: (data: { lat: number; lng: number; address?: string }) =>
      visitApi.checkIn(task.id, data),
    onSuccess: (res) => {
      Toast.show({ icon: 'success', content: '签到成功' });
      const recordId = res.data?.id || res.data?.record_id || 0;
      onSuccess(recordId);
    },
    onError: (err: any) => {
      Toast.show({ icon: 'fail', content: err.response?.data?.detail || '签到失败' });
    },
  });

  const handleCheckIn = () => {
    if (gpsStatus === 'error' || !position) {
      Toast.show({ content: '无法获取位置，正在重试...' });
      getPosition();
      return;
    }
    checkInMutation.mutate({ lat: position.lat, lng: position.lng });
  };

  const formatDistance = (meters: number) => {
    if (meters < 1000) return `${meters}m`;
    return `${(meters / 1000).toFixed(1)}km`;
  };

  const gpsStatusText = () => {
    switch (gpsStatus) {
      case 'loading':
        return '定位中...';
      case 'ready':
        return '定位成功';
      case 'error':
        return '定位失败，点击重试';
    }
  };

  const gpsStatusColor = () => {
    switch (gpsStatus) {
      case 'loading':
        return '#999';
      case 'ready':
        return '#00b578';
      case 'error':
        return '#ff3141';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 0' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          marginBottom: 8,
          color: gpsStatusColor(),
          fontSize: 13,
          cursor: gpsStatus === 'error' ? 'pointer' : 'default',
        }}
        onClick={() => {
          if (gpsStatus === 'error') getPosition();
        }}
      >
        <LocationOutline fontSize={14} />
        <span>{gpsStatusText()}</span>
      </div>

      {distance !== null && gpsStatus === 'ready' && (
        <div style={{ marginBottom: 16, fontSize: 13, color: '#666' }}>
          距客户 <span style={{ fontWeight: 600, color: distance > 1000 ? '#ff8f1f' : '#00b578' }}>
            {formatDistance(distance)}
          </span>
        </div>
      )}

      <div
        onClick={handleCheckIn}
        style={{
          width: 120,
          height: 120,
          borderRadius: '50%',
          background: gpsStatus === 'ready'
            ? 'linear-gradient(135deg, #1677ff 0%, #4096ff 100%)'
            : '#ccc',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: gpsStatus === 'loading' ? 'not-allowed' : 'pointer',
          boxShadow: gpsStatus === 'ready' ? '0 4px 16px rgba(22,119,255,0.3)' : 'none',
          transition: 'all 0.3s',
          color: '#fff',
        }}
      >
        {checkInMutation.isPending || gpsStatus === 'loading' ? (
          <SpinLoading color="white" style={{ '--size': '32px' }} />
        ) : (
          <>
            <LocationOutline fontSize={28} />
            <span style={{ fontSize: 18, fontWeight: 600, marginTop: 4 }}>签到</span>
          </>
        )}
      </div>

      {gpsStatus === 'ready' && position && (
        <div style={{ marginTop: 12, fontSize: 11, color: '#999' }}>
          {position.lat.toFixed(6)}, {position.lng.toFixed(6)}
        </div>
      )}
    </div>
  );
};

export default CheckInButton;
