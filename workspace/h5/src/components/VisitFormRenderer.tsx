import React, { useState } from 'react';
import { Input, Switch, Popup, CheckList, List, Picker } from 'antd-mobile';
import type { VisitTaskTypeField } from '../types';
import PhotoUploader from './PhotoUploader';

interface VisitFormRendererProps {
  fields: VisitTaskTypeField[];
  value: Record<string, any>;
  onChange: (values: Record<string, any>) => void;
  readOnly?: boolean;
}

const StarRating: React.FC<{
  value?: number;
  onChange?: (val: number) => void;
  readOnly?: boolean;
}> = ({ value = 0, onChange, readOnly = false }) => {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          onClick={() => {
            if (!readOnly) onChange?.(star);
          }}
          style={{
            fontSize: 24,
            cursor: readOnly ? 'default' : 'pointer',
            color: star <= value ? '#ffd21e' : '#ddd',
          }}
        >
          ★
        </span>
      ))}
    </div>
  );
};

const MultiSelectField: React.FC<{
  field: VisitTaskTypeField;
  value?: any[];
  onChange: (val: any[]) => void;
  readOnly?: boolean;
}> = ({ field, value = [], onChange, readOnly = false }) => {
  const [visible, setVisible] = useState(false);
  const options: string[] = Array.isArray(field.options) ? field.options : (field.options?.choices || []);
  const displayText = value.length > 0 ? value.join('、') : '请选择';

  if (readOnly) {
    return <span style={{ color: '#333' }}>{value.length > 0 ? value.join('、') : '-'}</span>;
  }

  return (
    <>
      <div
        onClick={() => setVisible(true)}
        style={{ color: value.length > 0 ? '#333' : '#999', cursor: 'pointer' }}
      >
        {displayText}
      </div>
      <Popup
        visible={visible}
        onMaskClick={() => setVisible(false)}
        bodyStyle={{ borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '60vh', overflow: 'auto' }}
      >
        <div style={{ padding: '16px 16px 8px', fontWeight: 500, fontSize: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{field.name}</span>
          <span
            style={{ color: 'var(--adm-color-primary)', fontSize: 14, cursor: 'pointer' }}
            onClick={() => setVisible(false)}
          >
            确定
          </span>
        </div>
        <CheckList
          multiple
          value={value}
          onChange={(val) => onChange(val as any[])}
        >
          {options.map((opt) => (
            <CheckList.Item key={opt} value={opt}>
              {opt}
            </CheckList.Item>
          ))}
        </CheckList>
      </Popup>
    </>
  );
};

const SelectField: React.FC<{
  field: VisitTaskTypeField;
  value?: string;
  onChange: (val: string) => void;
  readOnly?: boolean;
}> = ({ field, value, onChange, readOnly = false }) => {
  const [visible, setVisible] = useState(false);
  const options: string[] = Array.isArray(field.options) ? field.options : (field.options?.choices || []);
  const columns = [options.map((opt) => ({ label: opt, value: opt }))];

  if (readOnly) {
    return <span style={{ color: '#333' }}>{value || '-'}</span>;
  }

  return (
    <>
      <div
        onClick={() => setVisible(true)}
        style={{ color: value ? '#333' : '#999', cursor: 'pointer' }}
      >
        {value || '请选择'}
      </div>
      <Picker
        columns={columns}
        visible={visible}
        onClose={() => setVisible(false)}
        value={value ? [value] : []}
        onConfirm={(val) => {
          if (val[0] !== undefined && val[0] !== null) {
            onChange(String(val[0]));
          }
        }}
      />
    </>
  );
};

const VisitFormRenderer: React.FC<VisitFormRendererProps> = ({ fields, value, onChange, readOnly = false }) => {
  const sortedFields = [...fields].sort((a, b) => a.sort_order - b.sort_order);

  const updateField = (key: string, val: any) => {
    onChange({ ...value, [key]: val });
  };

  const renderField = (field: VisitTaskTypeField) => {
    const fieldValue = value[field.field_key];

    switch (field.field_type) {
      case 'text':
        if (readOnly) {
          return <span style={{ color: '#333' }}>{fieldValue || '-'}</span>;
        }
        return (
          <Input
            placeholder={`请输入${field.name}`}
            value={fieldValue || ''}
            onChange={(val) => updateField(field.field_key, val)}
          />
        );

      case 'number':
        if (readOnly) {
          return <span style={{ color: '#333' }}>{fieldValue !== undefined ? fieldValue : '-'}</span>;
        }
        return (
          <Input
            type="number"
            placeholder={`请输入${field.name}`}
            value={fieldValue !== undefined ? String(fieldValue) : ''}
            onChange={(val) => updateField(field.field_key, val ? Number(val) : undefined)}
          />
        );

      case 'select':
        return (
          <SelectField
            field={field}
            value={fieldValue}
            onChange={(val) => updateField(field.field_key, val)}
            readOnly={readOnly}
          />
        );

      case 'multi_select':
        return (
          <MultiSelectField
            field={field}
            value={fieldValue || []}
            onChange={(val) => updateField(field.field_key, val)}
            readOnly={readOnly}
          />
        );

      case 'photo':
        if (readOnly) {
          const photos: string[] = fieldValue || [];
          if (photos.length === 0) return <span style={{ color: '#999' }}>无照片</span>;
          return <PhotoUploader value={photos} maxCount={0} />;
        }
        return (
          <PhotoUploader
            value={fieldValue || []}
            onChange={(paths) => updateField(field.field_key, paths)}
          />
        );

      case 'rating':
        return (
          <StarRating
            value={fieldValue || 0}
            onChange={(val) => updateField(field.field_key, val)}
            readOnly={readOnly}
          />
        );

      case 'boolean':
        if (readOnly) {
          return <span style={{ color: '#333' }}>{fieldValue ? '是' : '否'}</span>;
        }
        return (
          <Switch
            checked={!!fieldValue}
            onChange={(checked) => updateField(field.field_key, checked)}
          />
        );

      default:
        if (readOnly) {
          return <span style={{ color: '#333' }}>{fieldValue !== undefined ? String(fieldValue) : '-'}</span>;
        }
        return (
          <Input
            placeholder={`请输入${field.name}`}
            value={fieldValue || ''}
            onChange={(val) => updateField(field.field_key, val)}
          />
        );
    }
  };

  return (
    <List style={{ '--border-top': 'none' } as any}>
      {sortedFields.map((field) => (
        <List.Item
          key={field.id}
          extra={
            field.field_type === 'photo' || field.field_type === 'rating'
              ? undefined
              : renderField(field)
          }
          description={
            field.field_type === 'photo' || field.field_type === 'rating'
              ? renderField(field)
              : undefined
          }
        >
          <span>
            {field.name}
            {field.is_required && <span style={{ color: 'red', marginLeft: 2 }}>*</span>}
          </span>
        </List.Item>
      ))}
    </List>
  );
};

export default VisitFormRenderer;
