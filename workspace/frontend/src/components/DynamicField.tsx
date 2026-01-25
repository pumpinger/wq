import React from 'react';
import { Form, Input, InputNumber, DatePicker, Select } from 'antd';
import type { TemplateField } from '../types';

interface DynamicFieldProps {
  templateField: TemplateField;
}

const DynamicField: React.FC<DynamicFieldProps> = ({ templateField }) => {
  const { field, is_required, options: templateOptions } = templateField;
  const { name, field_key, field_type, options: fieldOptions } = field;
  // 优先使用模板配置的选项，如果没有则使用字段定义的默认选项
  const options = templateOptions && templateOptions.length > 0 ? templateOptions : fieldOptions;

  const rules = is_required ? [{ required: true, message: `请输入${name}` }] : [];

  switch (field_type) {
    case 'text':
      return (
        <Form.Item label={name} name={['field_values', field_key]} rules={rules}>
          <Input placeholder={`请输入${name}`} />
        </Form.Item>
      );

    case 'number':
      return (
        <Form.Item label={name} name={['field_values', field_key]} rules={rules}>
          <InputNumber style={{ width: '100%' }} placeholder={`请输入${name}`} />
        </Form.Item>
      );

    case 'date':
      return (
        <Form.Item label={name} name={['field_values', field_key]} rules={rules}>
          <DatePicker style={{ width: '100%' }} placeholder={`请选择${name}`} />
        </Form.Item>
      );

    case 'select':
      return (
        <Form.Item label={name} name={['field_values', field_key]} rules={rules}>
          <Select placeholder={`请选择${name}`}>
            {options?.map((opt) => (
              <Select.Option key={opt} value={opt}>
                {opt}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>
      );

    case 'multi_select':
      return (
        <Form.Item label={name} name={['field_values', field_key]} rules={rules}>
          <Select mode="multiple" placeholder={`请选择${name}`}>
            {options?.map((opt) => (
              <Select.Option key={opt} value={opt}>
                {opt}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>
      );

    default:
      return null;
  }
};

export default DynamicField;
