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

// 拜访相关类型
export interface VisitTaskType {
  id: number;
  name: string;
  code: string;
  description?: string;
  icon?: string;
  color?: string;
  is_system: boolean;
  is_active: boolean;
  fields?: VisitTaskTypeField[];
}

export interface VisitTaskTypeField {
  id: number;
  name: string;
  field_key: string;
  field_type: string; // text/number/select/multi_select/photo/rating/boolean
  options?: any;
  is_required: boolean;
  sort_order: number;
}

export interface VisitTask {
  id: number;
  plan_id?: number;
  customer_id: number;
  customer_name?: string;
  customer_address?: string;
  customer_lat?: number;
  customer_lng?: number;
  task_type_id: number;
  task_type_name?: string;
  task_type_color?: string;
  task_type_icon?: string;
  assigned_to: number;
  assignee_name?: string;
  status: string; // pending/checked_in/completed/cancelled
  priority: string;
  planned_date: string;
  remark?: string;
  created_at: string;
}

export interface VisitRecordItem {
  id: number;
  customer_id: number;
  customer_name?: string;
  task_type_id: number;
  task_type_name?: string;
  check_in_time: string;
  check_in_address?: string;
  check_in_distance?: number;
  check_out_time?: string;
  duration_minutes?: number;
  status: string;
  remark?: string;
  field_values?: { field_key: string; value: any }[];
  photos?: { id: number; file_path: string; file_name?: string }[];
}
