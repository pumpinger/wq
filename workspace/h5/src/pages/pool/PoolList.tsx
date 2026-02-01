import React, { useState, useMemo } from 'react';
import { SearchBar, List, InfiniteScroll, PullToRefresh, Tag, Empty, Dialog, Toast, ActionSheet, Button } from 'antd-mobile';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { poolApi } from '../../api';
import { queryKeys } from '../../api/queryKeys';
import type { Customer } from '../../types';
import dayjs from 'dayjs';

const PAGE_SIZE = 20;

const PoolList: React.FC = () => {
  const queryClient = useQueryClient();
  const [keyword, setKeyword] = useState('');
  const [actionCustomer, setActionCustomer] = useState<Customer | null>(null);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isLoading,
    refetch,
  } = useInfiniteQuery({
    queryKey: queryKeys.pool.list({ keyword }),
    queryFn: async ({ pageParam = 0 }) => {
      const res = await poolApi.list({ skip: pageParam, limit: PAGE_SIZE, keyword: keyword || undefined });
      return res.data;
    },
    getNextPageParam: (lastPage: any, allPages) => {
      const loaded = allPages.reduce((sum: number, p: any) => sum + (p.items?.length || 0), 0);
      return loaded < lastPage.total ? loaded : undefined;
    },
    initialPageParam: 0,
  });

  const customers = useMemo(() => data?.pages.flatMap((p: any) => p.items || []) || [], [data]);
  const total = data?.pages[0]?.total || 0;

  const claimMutation = useMutation({
    mutationFn: (id: number) => poolApi.claim(id),
    onSuccess: () => {
      Toast.show({ icon: 'success', content: '认领成功' });
      queryClient.invalidateQueries({ queryKey: queryKeys.pool.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
      setActionCustomer(null);
    },
    onError: (err: any) => {
      Toast.show({ icon: 'fail', content: err.response?.data?.detail || '认领失败' });
    },
  });

  const handleClaim = (customer: Customer) => {
    Dialog.confirm({
      content: `确定认领"${customer.name}"？`,
      onConfirm: () => claimMutation.mutate(customer.id),
    });
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '8px 12px', background: '#fff' }}>
        <SearchBar
          placeholder="搜索公海客户"
          value={keyword}
          onChange={setKeyword}
          onSearch={() => refetch()}
          onClear={() => setKeyword('')}
        />
      </div>

      <div style={{ padding: '0 12px', fontSize: 12, color: '#999', lineHeight: '28px' }}>
        公海客户 {total} 位
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        <PullToRefresh onRefresh={async () => { await refetch(); }}>
          {customers.length === 0 && !isLoading ? (
            <Empty description="公海暂无客户" style={{ padding: '64px 0' }} />
          ) : (
            <List>
              {customers.map((c: Customer) => (
                <List.Item
                  key={c.id}
                  onClick={() => handleClaim(c)}
                  description={c.address || '无地址'}
                  extra={
                    <Tag color="primary" fill="outline" style={{ '--font-size': '11px' } as any}>
                      认领
                    </Tag>
                  }
                >
                  {c.name}
                </List.Item>
              ))}
            </List>
          )}
          <InfiniteScroll loadMore={async () => { await fetchNextPage(); }} hasMore={!!hasNextPage} />
        </PullToRefresh>
      </div>
    </div>
  );
};

export default PoolList;
