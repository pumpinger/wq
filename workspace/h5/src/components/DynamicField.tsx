import React, { useState } from 'react';
import { Form, Input, Stepper, Picker, Popup, CheckList, Button } from 'antd-mobile';
import type { TemplateField } from '../types';
import dayjs from 'dayjs';

interface Props {
  templateField: TemplateField;
}

const DynamicField: React.FC<Props> = ({ templateField }) => {
  const { field, is_required, options: overrideOptions } = templateField;
  const fieldOptions = overrideOptions || field.options || [];
  const fieldName = ['field_values', field.field_key];
  const rules = is_required ? [{ required: true, message: `请填写${field.name}` }] : [];

  // select 用 Picker
  if (field.field_type === 'select') {
    return (
      <Form.Item name={fieldName} label={field.name} rules={rules} trigger="onConfirm"
        onClick={(_, pickerRef: any) => pickerRef?.current?.open()}
      >
        <Picker columns={[fieldOptions.map(o => ({ label: o, value: o }))]}>
          {(value) => value?.[0]?.label || <span style={{ color: '#ccc' }}>请选择</span>}
        </Picker>
      </Form.Item>
    );
  }

  // multi_select 用 CheckList in Popup
  if (field.field_type === 'multi_select') {
    return (
      <MultiSelectField
        fieldName={fieldName}
        label={field.name}
        options={fieldOptions}
        rules={rules}
      />
    );
  }

  // date
  if (field.field_type === 'date') {
    return (
      <Form.Item name={fieldName} label={field.name} rules={rules}>
        <Input type="date" placeholder="请选择日期" />
      </Form.Item>
    );
  }

  // number
  if (field.field_type === 'number') {
    return (
      <Form.Item name={fieldName} label={field.name} rules={rules}>
        <Input type="number" placeholder={`请输入${field.name}`} />
      </Form.Item>
    );
  }

  // text (default)
  return (
    <Form.Item name={fieldName} label={field.name} rules={rules}>
      <Input placeholder={`请输入${field.name}`} />
    </Form.Item>
  );
};

// 多选字段组件
const MultiSelectField: React.FC<{
  fieldName: string[];
  label: string;
  options: string[];
  rules: any[];
}> = ({ fieldName, label, options, rules }) => {
  const [visible, setVisible] = useState(false);

  return (
    <Form.Item name={fieldName} label={label} rules={rules}
      onClick={() => setVisible(true)}
      trigger="onConfirm"
    >
      <MultiSelectInner options={options} visible={visible} onClose={() => setVisible(false)} />
    </Form.Item>
  );
};

const MultiSelectInner: React.FC<{
  value?: string[];
  onChange?: (val: string[]) => void;
  options: string[];
  visible: boolean;
  onClose: () => void;
}> = ({ value = [], onChange, options, visible, onClose }) => {
  const [selected, setSelected] = useState<string[]>(value);

  React.useEffect(() => {
    if (visible) setSelected(value);
  }, [visible]);

  return (
    <>
      <span>{value.length > 0 ? value.join('、') : <span style={{ color: '#ccc' }}>请选择</span>}</span>
      <Popup visible={visible} onMaskClick={onClose}
        bodyStyle={{ borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '60vh', overflow: 'auto' }}
      >
        <div style={{ padding: '16px 16px 0' }}>
          <h4>{`选择`}</h4>
        </div>
        <CheckList multiple value={selected} onChange={(val) => setSelected(val as string[])}>
          {options.map(o => (
            <CheckList.Item key={o} value={o}>{o}</CheckList.Item>
          ))}
        </CheckList>
        <div style={{ padding: 16 }}>
          <Button block color="primary" onClick={() => { onChange?.(selected); onClose(); }}>
            确定
          </Button>
        </div>
      </Popup>
    </>
  );
};

export default DynamicField;
