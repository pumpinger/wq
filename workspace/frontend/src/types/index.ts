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

// 自定义字段筛选操作符
export type CustomFieldFilterOperator = 'eq' | 'contains' | 'gte' | 'lte' | 'in';

// 自定义字段筛选条件
export interface CustomFieldFilter {
  field_id: number;
  operator: CustomFieldFilterOperator;
  value: any;
}

// 拜访任务类型
export interface VisitTaskTypeField {
  id: number;
  name: string;
  field_key: string;
  field_type: string;
  options?: any;
  is_required: boolean;
  sort_order: number;
}

export interface VisitTaskType {
  id: number;
  tenant_id?: number;
  name: string;
  code: string;
  description?: string;
  icon?: string;
  color?: string;
  is_system: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  fields?: VisitTaskTypeField[];
}

export interface VisitPlan {
  id: number;
  tenant_id: number;
  title: string;
  plan_date: string;
  assigned_to: number;
  assignee_name?: string;
  created_by: number;
  status: string;
  remark?: string;
  task_count: number;
  completed_count: number;
  created_at: string;
  tasks?: VisitTaskBrief[];
}

export interface VisitTaskBrief {
  id: number;
  customer_id: number;
  customer_name?: string;
  task_type_id: number;
  task_type_name?: string;
  status: string;
  priority: string;
  sort_order: number;
}

export interface VisitTask {
  id: number;
  tenant_id: number;
  plan_id?: number;
  customer_id: number;
  customer_name?: string;
  customer_address?: string;
  task_type_id: number;
  task_type_name?: string;
  task_type_color?: string;
  assigned_to: number;
  assignee_name?: string;
  status: string;
  priority: string;
  planned_date: string;
  remark?: string;
  created_at: string;
}

export interface VisitRecord {
  id: number;
  tenant_id: number;
  task_id?: number;
  customer_id: number;
  customer_name?: string;
  user_id: number;
  user_name?: string;
  task_type_id: number;
  task_type_name?: string;
  check_in_time: string;
  check_in_address?: string;
  check_in_distance?: number;
  check_out_time?: string;
  duration_minutes?: number;
  status: string;
  remark?: string;
  created_at: string;
  field_values?: { field_key: string; value: any }[];
  photos?: { id: number; file_path: string; file_name?: string }[];
}

export interface VisitStatsSummary {
  total_visits: number;
  completed_visits: number;
  completion_rate: number;
  avg_duration_minutes: number;
  total_customers_visited: number;
}

// ── 订阅订单 ──
export interface SubscriptionOrder {
  id: number;
  order_no: string;
  tenant_id?: number;
  tenant_name: string;
  modules: Record<string, boolean>;
  max_users: number;
  amount: number;
  start_date: string;
  end_date: string;
  status: string;
  remark?: string;
  activated_at?: string;
  created_by: number;
  created_at: string;
  updated_at: string;
}

// ── 考勤 ──
export interface AttendanceConfig {
  id: number;
  tenant_id: number;
  schedule_mode: string;
  punch_radius: number;
  wifi_check_enabled: boolean;
  late_tolerance_minutes: number;
  early_leave_tolerance_minutes: number;
}

export interface AttendanceLocation {
  id: number;
  tenant_id: number;
  name: string;
  latitude: number;
  longitude: number;
  address?: string;
  radius: number;
  wifi_ssid?: string;
  wifi_bssid?: string;
  is_active: boolean;
}

export interface AttendanceShift {
  id: number;
  tenant_id: number;
  name: string;
  start_time: string;
  end_time: string;
  break_start?: string;
  break_end?: string;
  flex_start_from?: string;
  flex_start_to?: string;
  core_start?: string;
  core_end?: string;
  min_work_hours?: number;
  is_default: boolean;
}

export interface AttendanceScheduleItem {
  id: number;
  tenant_id: number;
  user_id: number;
  shift_id: number;
  work_date: string;
  user_name?: string;
  shift_name?: string;
}

export interface AttendanceRecord {
  id: number;
  tenant_id: number;
  user_id: number;
  user_name?: string;
  work_date: string;
  shift_id?: number;
  shift_name?: string;
  punch_in_time?: string;
  punch_in_address?: string;
  punch_in_status?: string;
  punch_out_time?: string;
  punch_out_address?: string;
  punch_out_status?: string;
  work_hours?: number;
  status: string;
}

export interface MonthlyStatsItem {
  user_id: number;
  user_name?: string;
  total_days: number;
  normal_days: number;
  late_days: number;
  early_leave_days: number;
  absent_days: number;
  total_work_hours: number;
}
