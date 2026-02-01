import React, { useMemo } from 'react';
import { NavBar, Card, Tag, Empty, InfiniteScroll, PullToRefresh } from 'antd-mobile';
import { ClockCircleOutline, RightOutline } from 'antd-mobile-icons';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { visitApi } from '../../api';
import { visitKeys } from '../../api/queryKeys';
import type { VisitRecordItem } from '../../types';
import dayjs from 'dayjs';

const PAGE_SIZE = 20;

const statusMap: Record<string, { text: string; color: string }> = {
  completed: { text: '已完成', color: '#00b578' },
  checked_in: { text: '进行中', color: '#1677ff' },
  cancelled: { text: '已取消', color: '#ff3141' },
};

const VisitHistory: React.FC = () => {
  const navigate = useNavigate();

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isLoading,
    refetch,
  } = useInfiniteQuery({
    queryKey: visitKeys.myRecords({}),
    queryFn: async ({ pageParam = 0 }) => {
      const res = await visitApi.myRecords({ skip: pageParam, limit: PAGE_SIZE });
      return res.data;
    },
    getNextPageParam: (lastPage: any, allPages) => {
      const loaded = allPages.reduce((sum: number, p: any) => sum + ((p.items || p)?.length || 0), 0);
      const total = lastPage.total ?? Infinity;
      return loaded < total ? loaded : undefined;
    },
    initialPageParam: 0,
  });

  const records: VisitRecordItem[] = useMemo(() => {
    return data?.pages.flatMap((p: any) => p.items || p || []) || [];
  }, [data]);

  const groupedRecords = useMemo(() => {
    const groups: Record<string, VisitRecordItem[]> = {};
    for (const record of records) {
      const dateKey = dayjs(record.check_in_time).format('YYYY-MM-DD');
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(record);
    }
    return Object.entries(groups).sort(([a], [b]) => (a > b ? -1 : 1));
  }, [records]);

  const formatDuration = (minutes?: number) => {
    if (!minutes) return '-';
    if (minutes < 60) return `${minutes}分钟`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#f5f5f5' }}>
      <NavBar onBack={() => navigate(-1)}>拜访记录</NavBar>

      <div style={{ flex: 1, overflow: 'auto' }}>
        <PullToRefresh onRefresh={async () => { await refetch(); }}>
          {records.length === 0 && !isLoading ? (
            <Empty description="暂无拜访记录" style={{ padding: '64px 0' }} />
          ) : (
            <div style={{ padding: '0 12px 12px' }}>
              {groupedRecords.map(([date, dateRecords]) => {
                const dayObj = dayjs(date);
                const isToday = dayObj.isSame(dayjs(), 'day');
                const isYesterday = dayObj.isSame(dayjs().subtract(1, 'day'), 'day');
                let dateLabel = dayObj.format('MM月DD日');
                if (isToday) dateLabel = '今天';
                else if (isYesterday) dateLabel = '昨天';

                return (
                  <div key={date}>
                    <div
                      style={{
                        padding: '12px 4px 8px',
                        fontSize: 14,
                        fontWeight: 600,
                        color: '#333',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <ClockCircleOutline color="#999" fontSize={14} />
                      <span>{dateLabel}</span>
                      <span style={{ fontSize: 12, color: '#999', fontWeight: 400 }}>
                        ({dateRecords.length}条)
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {dateRecords.map((record) => {
                        const statusInfo = statusMap[record.status] || { text: record.status, color: '#999' };
                        return (
                          <Card
                            key={record.id}
                            onClick={() => navigate(`/visit/${record.id}`)}
                            style={{ borderRadius: 10, cursor: 'pointer' }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                  <span style={{ fontSize: 15, fontWeight: 600 }}>
                                    {record.customer_name || '未知客户'}
                                  </span>
                                  {record.task_type_name && (
                                    <Tag color="primary" fill="outline" style={{ '--font-size': '10px' } as any}>
                                      {record.task_type_name}
                                    </Tag>
                                  )}
                                </div>
                                <div style={{ fontSize: 12, color: '#999', display: 'flex', gap: 12 }}>
                                  <span>{dayjs(record.check_in_time).format('HH:mm')}</span>
                                  <span>时长: {formatDuration(record.duration_minutes)}</span>
                                </div>
                                {record.check_in_distance !== undefined && record.check_in_distance !== null && (
                                  <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
                                    签到距离: {record.check_in_distance}m
                                  </div>
                                )}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
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
                                <RightOutline style={{ color: '#ccc' }} />
                              </div>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <InfiniteScroll loadMore={async () => { await fetchNextPage(); }} hasMore={!!hasNextPage} />
        </PullToRefresh>
      </div>
    </div>
  );
};

export default VisitHistory;
