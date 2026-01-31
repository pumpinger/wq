import React, { useEffect, useState } from 'react';
import { Form, Input, Select, Button, message, Spin, InputNumber, Row, Col } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { templateApi, customerApi, regionApi } from '../api';
import { queryKeys } from '../api/queryKeys';
import type { CustomerTemplate, Customer, Region } from '../types';
import DynamicField from './DynamicField';
import LocationPicker from './LocationPicker';

interface CustomerFormProps {
  customer?: Customer;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const CustomerForm: React.FC<CustomerFormProps> = ({ customer, onSuccess, onCancel }) => {
  const [form] = Form.useForm();
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | undefined>(
    customer?.template_id
  );
  const [loading, setLoading] = useState(false);

  // 获取模板列表
  const { data: templates } = useQuery({
    queryKey: queryKeys.templates.list(),
    queryFn: () => templateApi.list().then((res) => res.data as CustomerTemplate[]),
  });

  // 获取区域列表
  const { data: regions } = useQuery({
    queryKey: queryKeys.regions.list(),
    queryFn: () => regionApi.list().then((res) => (res.data?.items || []) as Region[]),
  });

  // 获取选中模板的详情
  const { data: templateDetail, isLoading: templateLoading } = useQuery({
    queryKey: queryKeys.templates.detail(selectedTemplateId!),
    queryFn: () =>
      selectedTemplateId
        ? templateApi.get(selectedTemplateId).then((res) => res.data as CustomerTemplate)
        : Promise.resolve(null),
    enabled: !!selectedTemplateId,
  });

  useEffect(() => {
    if (customer) {
      // 编辑模式：填充表单
      const fieldValues: Record<string, any> = {};
      customer.field_values?.forEach((fv) => {
        const field = templateDetail?.template_fields?.find((tf) => tf.field_id === fv.field_id);
        if (field) {
          fieldValues[field.field.field_key] = fv.value;
        }
      });

      form.setFieldsValue({
        name: customer.name,
        address: customer.address,
        latitude: customer.latitude,
        longitude: customer.longitude,
        template_id: customer.template_id,
        region_id: customer.region_id,
        field_values: fieldValues,
      });
    }
  }, [customer, templateDetail, form]);

  const handleTemplateChange = (value: number) => {
    setSelectedTemplateId(value);
    // 清空动态字段
    form.setFieldsValue({ field_values: {} });
  };

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      // 转换字段值格式
      const fieldValues = Object.entries(values.field_values || {})
        .filter(([_, v]) => v !== undefined && v !== null)
        .map(([key, value]) => {
          const templateField = templateDetail?.template_fields?.find(
            (tf) => tf.field.field_key === key
          );
          return {
            field_id: templateField?.field_id,
            value: value,
          };
        })
        .filter((fv) => fv.field_id);

      const data = {
        name: values.name,
        address: values.address,
        latitude: values.latitude,
        longitude: values.longitude,
        template_id: values.template_id,
        region_id: values.region_id || null,
        field_values: fieldValues,
      };

      if (customer) {
        await customerApi.update(customer.id, data);
        message.success('更新成功');
      } else {
        await customerApi.create(data);
        message.success('创建成功');
      }

      onSuccess?.();
    } catch (error: any) {
      message.error(error.response?.data?.detail || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form form={form} layout="vertical" onFinish={handleSubmit}>
      <Form.Item
        label="客户名称"
        name="name"
        rules={[{ required: true, message: '请输入客户名称' }]}
      >
        <Input placeholder="请输入客户名称" />
      </Form.Item>

      <Form.Item label="地址" name="address">
        <Input placeholder="请输入地址" />
      </Form.Item>

      <Form.Item label="位置坐标">
        <Row gutter={16} align="middle">
          <Col span={9}>
            <Form.Item
              name="latitude"
              noStyle
            >
              <InputNumber
                placeholder="纬度"
                style={{ width: '100%' }}
                min={-90}
                max={90}
                precision={7}
              />
            </Form.Item>
          </Col>
          <Col span={9}>
            <Form.Item
              name="longitude"
              noStyle
            >
              <InputNumber
                placeholder="经度"
                style={{ width: '100%' }}
                min={-180}
                max={180}
                precision={7}
              />
            </Form.Item>
          </Col>
          <Col span={6}>
            <LocationPicker
              latitude={form.getFieldValue('latitude')}
              longitude={form.getFieldValue('longitude')}
              onChange={(lat, lng) => {
                form.setFieldsValue({ latitude: lat, longitude: lng });
              }}
            />
          </Col>
        </Row>
      </Form.Item>

      <Form.Item label="所属区域" name="region_id">
        <Select allowClear placeholder="请选择所属区域（可选）">
          {(regions || []).map((r) => (
            <Select.Option key={r.id} value={r.id}>
              {r.name}
            </Select.Option>
          ))}
        </Select>
      </Form.Item>

      <Form.Item
        label="选择模板"
        name="template_id"
        rules={[{ required: true, message: '请选择模板' }]}
      >
        <Select
          placeholder="请选择客户模板"
          onChange={handleTemplateChange}
          disabled={!!customer}
        >
          {templates?.map((t) => (
            <Select.Option key={t.id} value={t.id}>
              {t.name} {t.is_default && '(默认)'}
            </Select.Option>
          ))}
        </Select>
      </Form.Item>

      {templateLoading ? (
        <Spin tip="加载字段..." />
      ) : (
        templateDetail?.template_fields
          ?.sort((a, b) => a.sort_order - b.sort_order)
          .map((tf) => <DynamicField key={tf.id} templateField={tf} />)
      )}

      <Form.Item>
        <Button type="primary" htmlType="submit" loading={loading} style={{ marginRight: 8 }}>
          {customer ? '更新' : '创建'}
        </Button>
        <Button onClick={onCancel}>取消</Button>
      </Form.Item>
    </Form>
  );
};

export default CustomerForm;
