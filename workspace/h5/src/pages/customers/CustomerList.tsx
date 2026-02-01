import React, { useState, useMemo } from 'react';
import { SearchBar, List, InfiniteScroll, PullToRefresh, Tag, Empty, Popup, Button, Selector, FloatingBubble } from 'antd-mobile';
import { AddOutline } from 'antd-mobile-icons';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { customerApi, templateApi } from '../../api';
import { queryKeys } from '../../api/queryKeys';
import type { Customer, CustomerTemplate } from '../../types';
import dayjs from 'dayjs';

const PAGE_SIZE = 20;

const CustomerList: React.FC = () => {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [templateId, setTemplateId] = useState<number | undefined>();
  const [showFilter, setShowFilter] = useState(false);

  const { data: templates } = useQuery({
    queryKey: queryKeys.templates.list(),
    queryFn: () => templateApi.list().then(r => r.data as CustomerTemplate[]),
  });

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isLoading,
    refetch,
  } = useInfiniteQuery({
    queryKey: queryKeys.customers.list({ keyword, templateId }),
    queryFn: async ({ pageParam = 0 }) => {
      const res = await customerApi.list({
        skip: pageParam,
        limit: PAGE_SIZE,
        keyword: keyword || undefined,
        template_id: templateId,
      });
      return res.data;
    },
    getNextPageParam: (lastPage: any, allPages) => {
      const loaded = allPages.reduce((sum: number, p: any) => sum + (p.items?.length || 0), 0);
      return loaded < lastPage.total ? loaded : undefined;
    },
    initialPageParam: 0,
  });

  const customers = useMemo(() => {
    return data?.pages.flatMap((p: any) => p.items || []) || [];
  }, [data]);

  const total = data?.pages[0]?.total || 0;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 搜索栏 */}
      <div style={{ padding: '8px 12px', background: '#fff', display: 'flex', gap: 8, alignItems: 'center' }}>
        <SearchBar
          placeholder="搜索客户名称/地址"
          value={keyword}
          onChange={setKeyword}
          onSearch={() => refetch()}
          onClear={() => { setKeyword(''); }}
          style={{ flex: 1 }}
        />
        <Button
          size="small"
          color={templateId ? 'primary' : 'default'}
          onClick={() => setShowFilter(true)}
        >
          筛选
        </Button>
      </div>

      <div style={{ padding: '0 12px', fontSize: 12, color: '#999', lineHeight: '28px' }}>
        共 {total} 位客户
      </div>

      {/* 客户列表 */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <PullToRefresh onRefresh={async () => { await refetch(); }}>
          {customers.length === 0 && !isLoading ? (
            <Empty description="暂无客户" style={{ padding: '64px 0' }} />
          ) : (
            <List>
              {customers.map((c: Customer) => (
                <List.Item
                  key={c.id}
                  onClick={() => navigate(`/customer/${c.id}`)}
                  description={
                    <div style={{ display: 'flex', gap: 4, marginTop: 4, alignItems: 'center' }}>
                      {c.address && <span style={{ fontSize: 12, color: '#999' }}>{c.address}</span>}
                    </div>
                  }
                  extra={
                    <span style={{ fontSize: 11, color: '#ccc' }}>
                      {dayjs(c.created_at).format('MM-DD')}
                    </span>
                  }
                  arrow
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontWeight: 500 }}>{c.name}</span>
                    {c.latitude && <Tag color="primary" fill="outline" style={{ '--font-size': '10px' } as any}>GPS</Tag>}
                  </div>
                </List.Item>
              ))}
            </List>
          )}
          <InfiniteScroll loadMore={async () => { await fetchNextPage(); }} hasMore={!!hasNextPage} />
        </PullToRefresh>
      </div>

      {/* 筛选弹窗 */}
      <Popup
        visible={showFilter}
        onMaskClick={() => setShowFilter(false)}
        bodyStyle={{ padding: 24, borderTopLeftRadius: 16, borderTopRightRadius: 16 }}
      >
        <h4 style={{ marginBottom: 12 }}>按模板筛选</h4>
        <Selector
          options={(templates || []).map(t => ({ label: t.name, value: t.id }))}
          value={templateId ? [templateId] : []}
          onChange={(val) => {
            setTemplateId(val[0] as number | undefined);
            setShowFilter(false);
          }}
        />
        <Button
          block
          style={{ marginTop: 16 }}
          onClick={() => { setTemplateId(undefined); setShowFilter(false); }}
        >
          清除筛选
        </Button>
      </Popup>

      {/* 添加客户按钮 */}
      <FloatingBubble
        style={{ '--initial-position-bottom': '76px', '--initial-position-right': '16px' } as any}
        onClick={() => navigate('/customer/add')}
      >
        <AddOutline fontSize={24} />
      </FloatingBubble>
    </div>
  );
};

export default CustomerList;
