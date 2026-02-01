import React, { useState } from 'react';
import { NavBar, Card, List, Tag, Empty, ImageViewer } from 'antd-mobile';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { visitApi } from '../../api';
import { visitKeys } from '../../api/queryKeys';
import type { VisitRecordItem } from '../../types';
import dayjs from 'dayjs';

const statusMap: Record<string, { text: string; color: string }> = {
  completed: { text: '已完成', color: '#00b578' },
  checked_in: { text: '进行中', color: '#1677ff' },
  cancelled: { text: '已取消', color: '#ff3141' },
};

const VisitDetail: React.FC = () => {
  const { recordId } = useParams<{ recordId: string }>();
  const navigate = useNavigate();
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);

  const { data: record, isLoading } = useQuery({
    queryKey: visitKeys.record(Number(recordId)),
    queryFn: () => visitApi.getRecord(Number(recordId)).then((r) => r.data as VisitRecordItem),
    enabled: !!recordId,
  });

  const getImageUrl = (path: string) => {
    if (path.startsWith('http')) return path;
    const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';
    const origin = baseURL.replace(/\/api\/?$/, '');
    return `${origin}${path.startsWith('/') ? '' : '/'}${path}`;
  };

  const formatDuration = (minutes?: number) => {
    if (!minutes) return '-';
    if (minutes < 60) return `${minutes}分钟`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
  };

  const formatFieldValue = (value: any): string => {
    if (value === null || value === undefined) return '-';
    if (Array.isArray(value)) return value.join('、');
    if (typeof value === 'boolean') return value ? '是' : '否';
    return String(value);
  };

  if (isLoading) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <NavBar onBack={() => navigate(-1)}>拜访详情</NavBar>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          加载中...
        </div>
      </div>
    );
  }

  if (!record) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <NavBar onBack={() => navigate(-1)}>拜访详情</NavBar>
        <Empty description="记录不存在" style={{ padding: '64px 0' }} />
      </div>
    );
  }

  const statusInfo = statusMap[record.status] || { text: record.status, color: '#999' };
  const photos = record.photos || [];
  const photoUrls = photos.map((p) => getImageUrl(p.file_path));
  const fieldValues = record.field_values || [];

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#f5f5f5' }}>
      <NavBar onBack={() => navigate(-1)}>拜访详情</NavBar>

      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        {/* 基本信息 */}
        <Card title="基本信息" style={{ marginBottom: 12 }}>
          <List style={{ '--border-top': 'none' } as any}>
            <List.Item extra={record.customer_name || '-'}>客户</List.Item>
            <List.Item extra={record.task_type_name || '-'}>拜访类型</List.Item>
            <List.Item
              extra={
                <Tag
                  style={{
                    '--background-color': statusInfo.color + '15',
                    '--text-color': statusInfo.color,
                    '--border-color': statusInfo.color,
                  } as any}
                  fill="outline"
                >
                  {statusInfo.text}
                </Tag>
              }
            >
              状态
            </List.Item>
            <List.Item extra={dayjs(record.check_in_time).format('YYYY-MM-DD HH:mm:ss')}>
              签到时间
            </List.Item>
            {record.check_out_time && (
              <List.Item extra={dayjs(record.check_out_time).format('YYYY-MM-DD HH:mm:ss')}>
                签退时间
              </List.Item>
            )}
            <List.Item extra={formatDuration(record.duration_minutes)}>拜访时长</List.Item>
            {record.check_in_address && (
              <List.Item extra={record.check_in_address}>签到地址</List.Item>
            )}
            {record.check_in_distance !== undefined && record.check_in_distance !== null && (
              <List.Item extra={`${record.check_in_distance}m`}>签到距离</List.Item>
            )}
            {record.remark && <List.Item extra={record.remark}>备注</List.Item>}
          </List>
        </Card>

        {/* 表单记录 */}
        {fieldValues.length > 0 && (
          <Card title="表单记录" style={{ marginBottom: 12 }}>
            <List style={{ '--border-top': 'none' } as any}>
              {fieldValues.map((fv, index) => (
                <List.Item key={index} extra={formatFieldValue(fv.value)}>
                  {fv.field_key}
                </List.Item>
              ))}
            </List>
          </Card>
        )}

        {/* 照片 */}
        {photos.length > 0 && (
          <Card title={`照片 (${photos.length})`} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '8px 0' }}>
              {photos.map((photo, index) => (
                <div
                  key={photo.id}
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 8,
                    overflow: 'hidden',
                    border: '1px solid #eee',
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    setPreviewIndex(index);
                    setPreviewVisible(true);
                  }}
                >
                  <img
                    src={getImageUrl(photo.file_path)}
                    alt={photo.file_name || `photo-${index}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      <ImageViewer.Multi
        images={photoUrls}
        visible={previewVisible}
        defaultIndex={previewIndex}
        onClose={() => setPreviewVisible(false)}
      />
    </div>
  );
};

export default VisitDetail;
