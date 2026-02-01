import React from 'react';
import { PullToRefresh, Tag, Empty, Card } from 'antd-mobile';
import { ClockCircleOutline, RightOutline } from 'antd-mobile-icons';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { visitApi } from '../../api';
import { visitKeys } from '../../api/queryKeys';
import type { VisitTask } from '../../types';
import dayjs from 'dayjs';

const statusMap: Record<string, { text: string; color: string }> = {
  pending: { text: '待执行', color: '#999' },
  checked_in: { text: '执行中', color: '#1677ff' },
  completed: { text: '已完成', color: '#00b578' },
  cancelled: { text: '已取消', color: '#ff3141' },
};

const TodayTasks: React.FC = () => {
  const navigate = useNavigate();

  const { data: tasks = [], isLoading, refetch } = useQuery({
    queryKey: visitKeys.todayTasks,
    queryFn: () => visitApi.todayTasks().then((r) => (r.data?.items || r.data || []) as VisitTask[]),
  });

  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const today = dayjs().format('YYYY年MM月DD日');
  const weekDay = ['日', '一', '二', '三', '四', '五', '六'][dayjs().day()];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#f5f5f5' }}>
      <div
        style={{
          padding: '16px',
          background: 'linear-gradient(135deg, #1677ff 0%, #4096ff 100%)',
          color: '#fff',
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 600 }}>
          {today} 星期{weekDay}
        </div>
        <div style={{ fontSize: 13, marginTop: 4, opacity: 0.85 }}>
          <ClockCircleOutline style={{ marginRight: 4 }} />
          今日任务: {completedCount}/{tasks.length} 已完成
        </div>
      </div>

      <div style={{ padding: '0 12px', fontSize: 12, color: '#999', lineHeight: '32px' }}>
        共 {tasks.length} 个任务
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 12px 12px' }}>
        <PullToRefresh onRefresh={async () => { await refetch(); }}>
          {tasks.length === 0 && !isLoading ? (
            <Empty description="今日暂无任务" style={{ padding: '64px 0' }} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {tasks.map((task) => {
                const statusInfo = statusMap[task.status] || statusMap.pending;
                return (
                  <Card
                    key={task.id}
                    onClick={() => navigate(`/visit/execute/${task.id}`)}
                    style={{ borderRadius: 12, cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <span style={{ fontSize: 16, fontWeight: 600 }}>{task.customer_name || '未知客户'}</span>
                          <Tag
                            style={{
                              '--background-color': task.task_type_color || '#1677ff',
                              '--text-color': '#fff',
                              '--border-color': 'transparent',
                              fontSize: 11,
                            } as any}
                          >
                            {task.task_type_name || '拜访'}
                          </Tag>
                        </div>
                        {task.customer_address && (
                          <div style={{ fontSize: 13, color: '#999', marginBottom: 4 }}>
                            {task.customer_address}
                          </div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
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
                          {task.priority === 'high' && (
                            <Tag color="danger" fill="outline" style={{ '--font-size': '10px' } as any}>
                              优先
                            </Tag>
                          )}
                        </div>
                      </div>
                      <RightOutline style={{ color: '#ccc', marginTop: 4 }} />
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </PullToRefresh>
      </div>

      <div
        style={{
          padding: '8px 16px',
          background: '#fff',
          borderTop: '1px solid #eee',
          textAlign: 'center',
        }}
        className="safe-area-bottom"
      >
        <span
          style={{ color: 'var(--adm-color-primary)', fontSize: 14, cursor: 'pointer' }}
          onClick={() => navigate('/visit/history')}
        >
          查看拜访记录
        </span>
      </div>
    </div>
  );
};

export default TodayTasks;
