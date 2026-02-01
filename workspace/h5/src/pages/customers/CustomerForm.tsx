import React, { useEffect, useState } from 'react';
import { NavBar, Form, Input, Button, Toast, Picker, SpinLoading } from 'antd-mobile';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { customerApi, templateApi, regionApi } from '../../api';
import { queryKeys } from '../../api/queryKeys';
import type { Customer, CustomerTemplate, Region } from '../../types';
import DynamicField from '../../components/DynamicField';
import LocationPicker from '../../components/LocationPicker';

const CustomerForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | undefined>();

  // 获取客户详情（编辑模式）
  const { data: customer } = useQuery({
    queryKey: queryKeys.customers.detail(Number(id)),
    queryFn: () => customerApi.get(Number(id)).then(r => r.data as Customer),
    enabled: isEdit,
  });

  // 模板列表
  const { data: templates } = useQuery({
    queryKey: queryKeys.templates.list(),
    queryFn: () => templateApi.list().then(r => r.data as CustomerTemplate[]),
  });

  // 模板详情
  const { data: templateDetail, isLoading: templateLoading } = useQuery({
    queryKey: queryKeys.templates.detail(selectedTemplateId!),
    queryFn: () => templateApi.get(selectedTemplateId!).then(r => r.data as CustomerTemplate),
    enabled: !!selectedTemplateId,
  });

  // 区域列表
  const { data: regions } = useQuery({
    queryKey: queryKeys.regions.list(),
    queryFn: () => regionApi.list().then(r => (r.data?.items || []) as Region[]),
  });

  // 编辑模式回填
  useEffect(() => {
    if (customer && templateDetail) {
      setSelectedTemplateId(customer.template_id);
      const fieldValues: Record<string, any> = {};
      customer.field_values?.forEach(fv => {
        const tf = templateDetail.template_fields?.find(t => t.field_id === fv.field_id);
        if (tf) fieldValues[tf.field.field_key] = fv.value;
      });
      form.setFieldsValue({
        name: customer.name,
        address: customer.address,
        location: customer.latitude ? { lat: customer.latitude, lng: customer.longitude } : undefined,
        template_id: [customer.template_id],
        region_id: customer.region_id ? [customer.region_id] : undefined,
        field_values: fieldValues,
      });
    }
  }, [customer, templateDetail, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      // 转换字段值
      const fieldValues = Object.entries(values.field_values || {})
        .filter(([_, v]) => v !== undefined && v !== null)
        .map(([key, value]) => {
          const tf = templateDetail?.template_fields?.find(t => t.field.field_key === key);
          // Picker 返回数组，取第一个值
          const cleanValue = Array.isArray(value) && tf?.field.field_type === 'select'
            ? value[0] : value;
          return { field_id: tf?.field_id, value: cleanValue };
        })
        .filter(fv => fv.field_id);

      const data = {
        name: values.name,
        address: values.address,
        latitude: values.location?.lat || null,
        longitude: values.location?.lng || null,
        template_id: Array.isArray(values.template_id) ? values.template_id[0] : values.template_id,
        region_id: values.region_id ? (Array.isArray(values.region_id) ? values.region_id[0] : values.region_id) : null,
        field_values: fieldValues,
      };

      if (isEdit) {
        await customerApi.update(Number(id), data);
        Toast.show({ icon: 'success', content: '更新成功' });
      } else {
        await customerApi.create(data);
        Toast.show({ icon: 'success', content: '创建成功' });
      }

      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
      navigate(-1);
    } catch (error: any) {
      if (error.response) {
        Toast.show({ icon: 'fail', content: error.response.data?.detail || '操作失败' });
      }
    } finally {
      setLoading(false);
    }
  };

  const templateColumns = [
    (templates || []).map(t => ({ label: t.name + (t.is_default ? ' (默认)' : ''), value: t.id }))
  ];

  const regionColumns = [
    (regions || []).map(r => ({ label: r.name, value: r.id }))
  ];

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#f5f5f5' }}>
      <NavBar onBack={() => navigate(-1)}>{isEdit ? '编辑客户' : '新增客户'}</NavBar>

      <div style={{ flex: 1, overflow: 'auto' }}>
        <Form form={form} layout="horizontal" style={{ '--border-top': 'none' } as any}>
          <Form.Header>基本信息</Form.Header>

          <Form.Item name="name" label="客户名称" rules={[{ required: true, message: '请输入客户名称' }]}>
            <Input placeholder="请输入客户名称" />
          </Form.Item>

          <Form.Item name="address" label="地址">
            <Input placeholder="请输入地址" />
          </Form.Item>

          <Form.Item name="location" label="位置">
            <LocationPicker />
          </Form.Item>

          <Form.Item name="region_id" label="区域" trigger="onConfirm"
            onClick={(_, pickerRef: any) => pickerRef?.current?.open()}
          >
            <Picker columns={regionColumns}>
              {(value) => value?.[0]?.label || <span style={{ color: '#ccc' }}>请选择区域</span>}
            </Picker>
          </Form.Item>

          <Form.Item name="template_id" label="模板" rules={[{ required: true, message: '请选择模板' }]}
            trigger="onConfirm"
            onClick={(_, pickerRef: any) => !isEdit && pickerRef?.current?.open()}
          >
            <Picker
              columns={templateColumns}
              onConfirm={(val) => {
                const tid = val[0] as number;
                setSelectedTemplateId(tid);
                form.setFieldsValue({ field_values: {} });
              }}
            >
              {(value) => value?.[0]?.label || <span style={{ color: '#ccc' }}>请选择模板</span>}
            </Picker>
          </Form.Item>

          {/* 动态模板字段 */}
          {selectedTemplateId && (
            <>
              <Form.Header>模板字段</Form.Header>
              {templateLoading ? (
                <div style={{ padding: 24, textAlign: 'center' }}><SpinLoading /></div>
              ) : (
                templateDetail?.template_fields
                  ?.sort((a, b) => a.sort_order - b.sort_order)
                  .map(tf => <DynamicField key={tf.id} templateField={tf} />)
              )}
            </>
          )}
        </Form>
      </div>

      {/* 提交按钮 */}
      <div style={{ padding: '12px 16px', background: '#fff', borderTop: '1px solid #eee' }}
        className="safe-area-bottom"
      >
        <Button block color="primary" loading={loading} onClick={handleSubmit}>
          {isEdit ? '保存修改' : '创建客户'}
        </Button>
      </div>
    </div>
  );
};

export default CustomerForm;
