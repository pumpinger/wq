import React, { useState } from 'react';
import { NavBar, Card, List, Tag, Button, Dialog, Toast, Space, Empty, Picker } from 'antd-mobile';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customerApi, templateApi, poolApi, visitApi } from '../../api';
import { queryKeys } from '../../api/queryKeys';
import { visitKeys } from '../../api/queryKeys';
import type { Customer, CustomerTemplate, VisitTaskType } from '../../types';
import dayjs from 'dayjs';

const CustomerDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showTaskTypePicker, setShowTaskTypePicker] = useState(false);

  const { data: customer, isLoading } = useQuery({
    queryKey: queryKeys.customers.detail(Number(id)),
    queryFn: () => customerApi.get(Number(id)).then(r => r.data as Customer),
    enabled: !!id,
  });

  const { data: templateDetail } = useQuery({
    queryKey: queryKeys.templates.detail(customer?.template_id!),
    queryFn: () => templateApi.get(customer!.template_id!).then(r => r.data as CustomerTemplate),
    enabled: !!customer?.template_id,
  });

  const deleteMutation = useMutation({
    mutationFn: () => customerApi.delete(Number(id)),
    onSuccess: () => {
      Toast.show({ icon: 'success', content: '已删除' });
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
      navigate(-1);
    },
  });

  const { data: taskTypes = [] } = useQuery({
    queryKey: visitKeys.taskTypes,
    queryFn: () => visitApi.getTaskTypes().then((r) => (r.data?.items || r.data || []) as VisitTaskType[]),
  });

  const createTaskMutation = useMutation({
    mutationFn: (data: any) => visitApi.createTask(data),
    onSuccess: (res) => {
      const taskId = res.data?.id;
      if (taskId) {
        navigate(`/visit/execute/${taskId}`);
      } else {
        Toast.show({ icon: 'success', content: '任务已创建' });
        navigate('/visits');
      }
    },
    onError: (err: any) => {
      Toast.show({ icon: 'fail', content: err.response?.data?.detail || '创建任务失败' });
    },
  });

  const handleCreateVisit = (taskTypeId: number) => {
    createTaskMutation.mutate({
      customer_id: Number(id),
      task_type_id: taskTypeId,
      planned_date: dayjs().format('YYYY-MM-DD'),
    });
  };

  const releaseMutation = useMutation({
    mutationFn: (reason?: string) => poolApi.release(Number(id), reason),
    onSuccess: () => {
      Toast.show({ icon: 'success', content: '已释放到公海' });
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.pool.all });
      navigate(-1);
    },
    onError: (err: any) => {
      Toast.show({ icon: 'fail', content: err.response?.data?.detail || '操作失败' });
    },
  });

  const handleDelete = () => {
    Dialog.confirm({
      content: '确定删除此客户？',
      onConfirm: () => deleteMutation.mutate(),
    });
  };

  const handleRelease = async () => {
    const result = await Dialog.confirm({
      content: '确定将此客户释放到公海？',
    });
    if (result) {
      releaseMutation.mutate();
    }
  };

  // 获取字段显示值
  const getFieldDisplay = (fieldId: number) => {
    const fv = customer?.field_values?.find(v => v.field_id === fieldId);
    if (!fv) return '-';
    const val = fv.value;
    if (Array.isArray(val)) return val.join('、');
    return String(val);
  };

  if (isLoading) return <div style={{ padding: 48, textAlign: 'center' }}>加载中...</div>;
  if (!customer) return <Empty description="客户不存在" />;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#f5f5f5' }}>
      <NavBar onBack={() => navigate(-1)}>客户详情</NavBar>

      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        {/* 基本信息 */}
        <Card title="基本信息" style={{ marginBottom: 12 }}>
          <List style={{ '--border-top': 'none' } as any}>
            <List.Item extra={customer.name}>客户名称</List.Item>
            <List.Item extra={customer.address || '-'}>地址</List.Item>
            <List.Item extra={
              customer.latitude
                ? <Tag color="success">{customer.latitude.toFixed(4)}, {customer.longitude?.toFixed(4)}</Tag>
                : <Tag color="default">无</Tag>
            }>坐标</List.Item>
            <List.Item extra={dayjs(customer.created_at).format('YYYY-MM-DD HH:mm')}>创建时间</List.Item>
          </List>
        </Card>

        {/* 自定义字段 */}
        {templateDetail?.template_fields && templateDetail.template_fields.length > 0 && (
          <Card title={templateDetail.name || '模板字段'} style={{ marginBottom: 12 }}>
            <List style={{ '--border-top': 'none' } as any}>
              {templateDetail.template_fields
                .sort((a, b) => a.sort_order - b.sort_order)
                .map(tf => (
                  <List.Item key={tf.id} extra={getFieldDisplay(tf.field_id)}>
                    {tf.field.name}
                  </List.Item>
                ))}
            </List>
          </Card>
        )}
      </div>

      {/* 底部操作栏 */}
      <div style={{ padding: '12px 16px', background: '#fff', borderTop: '1px solid #eee' }}
        className="safe-area-bottom"
      >
        <Space style={{ width: '100%' }} justify="evenly">
          <Button color="success" onClick={() => {
            if (taskTypes.length === 0) {
              Toast.show({ content: '暂无可用的拜访类型' });
              return;
            }
            if (taskTypes.length === 1) {
              handleCreateVisit(taskTypes[0].id);
              return;
            }
            setShowTaskTypePicker(true);
          }} loading={createTaskMutation.isPending}>发起拜访</Button>
          <Button color="primary" onClick={() => navigate(`/customer/${id}/edit`)}>编辑</Button>
          <Button color="warning" fill="outline" onClick={handleRelease}>释放公海</Button>
          <Button color="danger" fill="outline" onClick={handleDelete}>删除</Button>
        </Space>
        <Picker
          columns={[taskTypes.filter(t => t.is_active).map((t) => ({ label: t.name, value: t.id }))]}
          visible={showTaskTypePicker}
          onClose={() => setShowTaskTypePicker(false)}
          onConfirm={(val) => {
            if (val[0] !== undefined && val[0] !== null) {
              handleCreateVisit(Number(val[0]));
            }
            setShowTaskTypePicker(false);
          }}
        />
      </div>
    </div>
  );
};

export default CustomerDetail;
