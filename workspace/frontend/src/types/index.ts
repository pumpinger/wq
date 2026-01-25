export type FieldType = 'text' | 'number' | 'date' | 'select' | 'multi_select';

export interface FieldDefinition {
  id: number;
  name: string;
  field_key: string;
  field_type: FieldType;
  options?: string[];
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface TemplateField {
  id: number;
  field_id: number;
  is_required: boolean;
  sort_order: number;
  options?: string[];  // 该模板中此字段的选项值（覆盖字段定义的默认值）
  field: FieldDefinition;
}

export interface CustomerTemplate {
  id: number;
  name: string;
  description?: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  template_fields?: TemplateField[];
}

export interface CustomerFieldValue {
  id: number;
  field_id: number;
  value: any;
}

export interface Customer {
  id: number;
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  managed_by?: number;
  template_id?: number;
  created_at: string;
  updated_at: string;
  field_values?: CustomerFieldValue[];
}

// 自定义字段筛选操作符
export type CustomFieldFilterOperator = 'eq' | 'contains' | 'gte' | 'lte' | 'in';

// 自定义字段筛选条件
export interface CustomFieldFilter {
  field_id: number;
  operator: CustomFieldFilterOperator;
  value: any;
}
