import React from 'react';
import { Input, InputNumber, DatePicker, Select, Space } from 'antd';
import dayjs from 'dayjs';
import type { TemplateField, CustomFieldFilter, CustomFieldFilterOperator } from '../types';

const { RangePicker } = DatePicker;

interface DynamicFieldFilterProps {
  templateField: TemplateField;
  value?: CustomFieldFilter[];
  onChange?: (filters: CustomFieldFilter[]) => void;
}

const DynamicFieldFilter: React.FC<DynamicFieldFilterProps> = ({
  templateField,
  value = [],
  onChange,
}) => {
  const { field, options: templateOptions } = templateField;
  const { name, field_type, options: fieldOptions } = field;
  const fieldId = field.id;

  // 优先使用模板配置的选项
  const options = templateOptions && templateOptions.length > 0 ? templateOptions : fieldOptions;

  // 获取当前字段的筛选值
  const getCurrentFilter = (operator: CustomFieldFilterOperator) => {
    return value.find((f) => f.field_id === fieldId && f.operator === operator);
  };

  // 更新筛选条件
  const updateFilter = (operator: CustomFieldFilterOperator, filterValue: any) => {
    const newFilters = value.filter(
      (f) => !(f.field_id === fieldId && f.operator === operator)
    );

    if (filterValue !== undefined && filterValue !== null && filterValue !== '') {
      newFilters.push({
        field_id: fieldId,
        operator,
        value: filterValue,
      });
    }

    onChange?.(newFilters);
  };

  switch (field_type) {
    case 'text':
      return (
        <Input
          placeholder={name}
          style={{ width: 140 }}
          value={getCurrentFilter('contains')?.value || ''}
          onChange={(e) => updateFilter('contains', e.target.value || undefined)}
          allowClear
        />
      );

    case 'number':
      return (
        <Space.Compact>
          <InputNumber
            placeholder={`${name}>=`}
            style={{ width: 90 }}
            value={getCurrentFilter('gte')?.value}
            onChange={(v) => updateFilter('gte', v)}
          />
          <InputNumber
            placeholder={`${name}<=`}
            style={{ width: 90 }}
            value={getCurrentFilter('lte')?.value}
            onChange={(v) => updateFilter('lte', v)}
          />
        </Space.Compact>
      );

    case 'date':
      const gteFilter = getCurrentFilter('gte');
      const lteFilter = getCurrentFilter('lte');
      return (
        <RangePicker
          placeholder={[`${name}开始`, `${name}结束`]}
          style={{ width: 220 }}
          value={[
            gteFilter?.value ? dayjs(gteFilter.value) : null,
            lteFilter?.value ? dayjs(lteFilter.value) : null,
          ]}
          onChange={(dates) => {
            // 先清除旧的
            let newFilters = value.filter(
              (f) => !(f.field_id === fieldId && (f.operator === 'gte' || f.operator === 'lte'))
            );

            if (dates?.[0]) {
              newFilters.push({
                field_id: fieldId,
                operator: 'gte',
                value: dates[0].format('YYYY-MM-DD'),
              });
            }
            if (dates?.[1]) {
              newFilters.push({
                field_id: fieldId,
                operator: 'lte',
                value: dates[1].format('YYYY-MM-DD'),
              });
            }

            onChange?.(newFilters);
          }}
        />
      );

    case 'select':
      return (
        <Select
          placeholder={name}
          style={{ width: 140 }}
          allowClear
          value={getCurrentFilter('eq')?.value}
          onChange={(v) => updateFilter('eq', v)}
        >
          {options?.map((opt) => (
            <Select.Option key={opt} value={opt}>
              {opt}
            </Select.Option>
          ))}
        </Select>
      );

    case 'multi_select':
      return (
        <Select
          mode="multiple"
          placeholder={name}
          style={{ width: 180 }}
          allowClear
          maxTagCount={1}
          value={getCurrentFilter('in')?.value || []}
          onChange={(v) => updateFilter('in', v && v.length > 0 ? v : undefined)}
        >
          {options?.map((opt) => (
            <Select.Option key={opt} value={opt}>
              {opt}
            </Select.Option>
          ))}
        </Select>
      );

    default:
      return null;
  }
};

export default DynamicFieldFilter;
