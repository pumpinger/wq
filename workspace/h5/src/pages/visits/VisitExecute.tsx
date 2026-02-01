import React, { useState, useEffect, useMemo } from 'react';
import { NavBar, Card, List, Button, TextArea, Toast, Steps, Tag, Result } from 'antd-mobile';
import { LocationOutline } from 'antd-mobile-icons';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { visitApi } from '../../api';
import { visitKeys } from '../../api/queryKeys';
import type { VisitTask, VisitTaskType, VisitTaskTypeField } from '../../types';
import CheckInButton from '../../components/CheckInButton';
import VisitFormRenderer from '../../components/VisitFormRenderer';

const { Step } = Steps;

const statusMap: Record<string, { text: string; color: string }> = {
  pending: { text: '待执行', color: '#999' },
  checked_in: { text: '执行中', color: '#1677ff' },
  completed: { text: '已完成', color: '#00b578' },
  cancelled: { text: '已取消', color: '#ff3141' },
};

const VisitExecute: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [currentStep, setCurrentStep] = useState(0);
  const [fieldValues, setFieldValues] = useState<Record<string, any>>({});
  const [remark, setRemark] = useState('');

  const { data: task, isLoading: taskLoading } = useQuery({
    queryKey: visitKeys.task(Number(taskId)),
    queryFn: () => visitApi.getTask(Number(taskId)).then((r) => r.data as VisitTask),
    enabled: !!taskId,
  });

  const { data: taskType } = useQuery({
    queryKey: [...visitKeys.taskTypes, task?.task_type_id],
    queryFn: () => visitApi.getTaskType(task!.task_type_id).then((r) => r.data as VisitTaskType),
    enabled: !!task?.task_type_id,
  });

  const fields: VisitTaskTypeField[] = useMemo(
    () => (taskType?.fields || []).sort((a, b) => a.sort_order - b.sort_order),
    [taskType]
  );

  useEffect(() => {
    if (task) {
      if (task.status === 'checked_in') {
        setCurrentStep(1);
      } else if (task.status === 'completed') {
        setCurrentStep(3);
      }
    }
  }, [task]);

  const completeMutation = useMutation({
    mutationFn: (data: { field_values?: any[]; photos?: string[]; remark?: string; check_out_lat?: number; check_out_lng?: number }) =>
      visitApi.complete(Number(taskId), data),
    onSuccess: () => {
      Toast.show({ icon: 'success', content: '拜访已完成' });
      queryClient.invalidateQueries({ queryKey: visitKeys.todayTasks });
      queryClient.invalidateQueries({ queryKey: visitKeys.task(Number(taskId)) });
      setTimeout(() => navigate(-1), 500);
    },
    onError: (err: any) => {
      Toast.show({ icon: 'fail', content: err.response?.data?.detail || '提交失败' });
    },
  });

  const handleCheckInSuccess = (_recordId: number) => {
    queryClient.invalidateQueries({ queryKey: visitKeys.task(Number(taskId)) });
    setCurrentStep(1);
  };

  const handleNextStep = () => {
    const requiredFields = fields.filter((f) => f.is_required);
    for (const f of requiredFields) {
      const val = fieldValues[f.field_key];
      if (val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0)) {
        Toast.show({ content: `请填写"${f.name}"` });
        return;
      }
    }
    setCurrentStep(2);
  };

  const handleSubmit = () => {
    const fieldValuesArray = Object.entries(fieldValues).map(([key, val]) => ({
      field_key: key,
      value: val,
    }));

    const photoFields = fields.filter((f) => f.field_type === 'photo');
    const allPhotos: string[] = [];
    for (const pf of photoFields) {
      const photos = fieldValues[pf.field_key];
      if (Array.isArray(photos)) {
        allPhotos.push(...photos);
      }
    }

    const submitData: any = {
      field_values: fieldValuesArray,
      remark: remark || undefined,
    };

    if (allPhotos.length > 0) {
      submitData.photos = allPhotos;
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          submitData.check_out_lat = pos.coords.latitude;
          submitData.check_out_lng = pos.coords.longitude;
          completeMutation.mutate(submitData);
        },
        () => {
          completeMutation.mutate(submitData);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      completeMutation.mutate(submitData);
    }
  };

  if (taskLoading) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <NavBar onBack={() => navigate(-1)}>执行拜访</NavBar>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          加载中...
        </div>
      </div>
    );
  }

  if (!task) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <NavBar onBack={() => navigate(-1)}>执行拜访</NavBar>
        <Result status="warning" title="任务不存在" />
      </div>
    );
  }

  if (task.status === 'completed' || currentStep === 3) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#f5f5f5' }}>
        <NavBar onBack={() => navigate(-1)}>拜访详情</NavBar>
        <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
          <Result status="success" title="拜访已完成" />
          <Card title="客户信息" style={{ marginBottom: 12 }}>
            <List style={{ '--border-top': 'none' } as any}>
              <List.Item extra={task.customer_name || '-'}>客户</List.Item>
              <List.Item extra={task.customer_address || '-'}>地址</List.Item>
              <List.Item extra={task.task_type_name || '-'}>拜访类型</List.Item>
            </List>
          </Card>
        </div>
      </div>
    );
  }

  if (task.status === 'cancelled') {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#f5f5f5' }}>
        <NavBar onBack={() => navigate(-1)}>执行拜访</NavBar>
        <Result status="error" title="任务已取消" />
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#f5f5f5' }}>
      <NavBar onBack={() => navigate(-1)}>执行拜访</NavBar>

      <div style={{ padding: '12px 16px', background: '#fff' }}>
        <Steps current={currentStep}>
          <Step title="签到" />
          <Step title="填写表单" />
          <Step title="提交签退" />
        </Steps>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        {/* Step 0: Check In */}
        {currentStep === 0 && (
          <>
            <Card title="客户信息" style={{ marginBottom: 12 }}>
              <List style={{ '--border-top': 'none' } as any}>
                <List.Item extra={task.customer_name || '-'}>客户名称</List.Item>
                <List.Item extra={task.customer_address || '-'}>地址</List.Item>
                {task.task_type_name && (
                  <List.Item
                    extra={
                      <Tag
                        style={{
                          '--background-color': task.task_type_color || '#1677ff',
                          '--text-color': '#fff',
                          '--border-color': 'transparent',
                        } as any}
                      >
                        {task.task_type_name}
                      </Tag>
                    }
                  >
                    拜访类型
                  </List.Item>
                )}
                {task.remark && <List.Item extra={task.remark}>备注</List.Item>}
              </List>
            </Card>

            <Card style={{ textAlign: 'center' }}>
              <CheckInButton task={task} onSuccess={handleCheckInSuccess} />
            </Card>
          </>
        )}

        {/* Step 1: Fill Form */}
        {currentStep === 1 && (
          <>
            <Card
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <LocationOutline color="#00b578" />
                  <span>已签到 - {task.customer_name}</span>
                </div>
              }
              style={{ marginBottom: 12 }}
            >
              {fields.length > 0 ? (
                <VisitFormRenderer fields={fields} value={fieldValues} onChange={setFieldValues} />
              ) : (
                <div style={{ padding: 16, color: '#999', textAlign: 'center' }}>
                  此拜访类型无需填写表单
                </div>
              )}
            </Card>
          </>
        )}

        {/* Step 2: Review & Submit */}
        {currentStep === 2 && (
          <>
            <Card title="表单填写内容" style={{ marginBottom: 12 }}>
              {fields.length > 0 ? (
                <VisitFormRenderer fields={fields} value={fieldValues} onChange={setFieldValues} readOnly />
              ) : (
                <div style={{ padding: 16, color: '#999', textAlign: 'center' }}>
                  无表单内容
                </div>
              )}
            </Card>

            <Card title="补充说明" style={{ marginBottom: 12 }}>
              <TextArea
                placeholder="可输入拜访备注..."
                value={remark}
                onChange={setRemark}
                rows={3}
                maxLength={500}
                showCount
              />
            </Card>
          </>
        )}
      </div>

      {/* Bottom Action */}
      {currentStep === 1 && (
        <div
          style={{ padding: '12px 16px', background: '#fff', borderTop: '1px solid #eee' }}
          className="safe-area-bottom"
        >
          <Button block color="primary" size="large" onClick={handleNextStep}>
            下一步
          </Button>
        </div>
      )}

      {currentStep === 2 && (
        <div
          style={{ padding: '12px 16px', background: '#fff', borderTop: '1px solid #eee', display: 'flex', gap: 12 }}
          className="safe-area-bottom"
        >
          <Button
            style={{ flex: 1 }}
            size="large"
            onClick={() => setCurrentStep(1)}
          >
            返回修改
          </Button>
          <Button
            style={{ flex: 2 }}
            color="primary"
            size="large"
            loading={completeMutation.isPending}
            onClick={handleSubmit}
          >
            提交并签退
          </Button>
        </div>
      )}
    </div>
  );
};

export default VisitExecute;
