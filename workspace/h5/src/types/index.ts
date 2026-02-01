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
  options?: string[];
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
  region_id?: number;
  created_at: string;
  updated_at: string;
  field_values?: CustomerFieldValue[];
}

export interface Region {
  id: number;
  name: string;
  code: string;
  tenant_id: number;
  parent_id?: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface PoolRecord {
  id: number;
  customer_id: number;
  action: string;
  from_user_id?: number;
  to_user_id?: number;
  reason?: string;
  created_at: string;
  from_user_name?: string;
  to_user_name?: string;
}

export interface UserInfo {
  id: number;
  username: string;
  real_name?: string;
  email?: string;
  phone?: string;
  role: string;
  is_super_admin: boolean;
  tenant_id?: number;
  tenant_name?: string;
}
