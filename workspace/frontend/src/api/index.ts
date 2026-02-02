import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api',
  timeout: 10000,
});

// 当前选中的租户ID（超管用）
let currentTenantId: number | null = null;

// 设置租户 Header
export const setTenantHeader = (tenantId: number | null) => {
  currentTenantId = tenantId;
};

// 请求拦截器 - 添加 Token 和租户 Header
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // 超管租户上下文
    if (currentTenantId) {
      config.headers['X-Tenant-Id'] = currentTenantId;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 响应拦截器 - 处理 401 错误
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user_info');
      // 如果不在登录页，跳转到登录页
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// 字段定义
export const fieldApi = {
  list: () => api.get('/field-definitions/'),
  get: (id: number) => api.get(`/field-definitions/${id}`),
  create: (data: any) => api.post('/field-definitions/', data),
  update: (id: number, data: any) => api.put(`/field-definitions/${id}`, data),
  delete: (id: number) => api.delete(`/field-definitions/${id}`),
};

// 客户模板
export const templateApi = {
  list: () => api.get('/customer-templates/'),
  get: (id: number) => api.get(`/customer-templates/${id}`),
  create: (data: any) => api.post('/customer-templates/', data),
  update: (id: number, data: any) => api.put(`/customer-templates/${id}`, data),
  delete: (id: number) => api.delete(`/customer-templates/${id}`),
};

// 客户
export const customerApi = {
  list: (params?: {
    skip?: number;
    limit?: number;
    template_id?: number;
    keyword?: string;
    managed_by?: number;
    has_coords?: boolean;
    start_date?: string;
    end_date?: string;
    custom_filters?: string;  // JSON 格式的自定义字段筛选条件
  }) => api.get('/customers/', { params }),
  get: (id: number) => api.get(`/customers/${id}`),
  create: (data: any) => api.post('/customers/', data),
  update: (id: number, data: any) => api.put(`/customers/${id}`, data),
  delete: (id: number) => api.delete(`/customers/${id}`),
  exportExcel: (params?: {
    template_id?: number;
    keyword?: string;
    managed_by?: number;
    has_coords?: boolean;
    start_date?: string;
    end_date?: string;
    custom_filters?: string;  // JSON 格式的自定义字段筛选条件
  }) => api.get('/customers/export/excel', { params, responseType: 'blob' }),
};

// 认证
export const authApi = {
  login: (username: string, password: string) => {
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);
    return api.post('/auth/login', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  },
  me: () => api.get('/auth/me'),
  changePassword: (oldPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { old_password: oldPassword, new_password: newPassword }),
  logout: () => api.post('/auth/logout'),
};

// 租户管理（超管）
export const tenantApi = {
  list: (params?: { page?: number; page_size?: number; keyword?: string; status?: string }) =>
    api.get('/tenants', { params }),
  get: (id: number) => api.get(`/tenants/${id}`),
  create: (data: any) => api.post('/tenants', data),
  update: (id: number, data: any) => api.put(`/tenants/${id}`, data),
  delete: (id: number) => api.delete(`/tenants/${id}`),
};

// 用户管理
export const userApi = {
  list: (params?: { page?: number; page_size?: number; keyword?: string; status?: string }) =>
    api.get('/users', { params }),
  get: (id: number) => api.get(`/users/${id}`),
  create: (data: any) => api.post('/users', data),
  update: (id: number, data: any) => api.put(`/users/${id}`, data),
  delete: (id: number) => api.delete(`/users/${id}`),
};

// 角色权限管理
export const roleApi = {
  // 获取所有权限
  getPermissions: () => api.get('/roles/permissions'),
  // 获取角色列表
  list: () => api.get('/roles/'),
  // 获取角色详情
  get: (id: number) => api.get(`/roles/${id}`),
  // 创建角色
  create: (data: any) => api.post('/roles/', data),
  // 更新角色
  update: (id: number, data: any) => api.put(`/roles/${id}`, data),
  // 删除角色
  delete: (id: number) => api.delete(`/roles/${id}`),
  // 获取用户的角色
  getUserRoles: (userId: number) => api.get(`/roles/user/${userId}/roles`),
  // 为用户分配角色
  assignUserRoles: (userId: number, roleIds: number[]) =>
    api.put(`/roles/user/${userId}/roles`, roleIds),
};

// 区域管理
export const regionApi = {
  list: () => api.get('/regions'),
  get: (id: number) => api.get(`/regions/${id}`),
  create: (data: any) => api.post('/regions', data),
  update: (id: number, data: any) => api.put(`/regions/${id}`, data),
  delete: (id: number) => api.delete(`/regions/${id}`),
  // 用户区域分配
  getUserRegions: (userId: number) => api.get(`/users/${userId}/regions`),
  assignUserRegions: (userId: number, regionIds: number[]) =>
    api.put(`/users/${userId}/regions`, { region_ids: regionIds }),
};

// 客户公海
export const customerPoolApi = {
  // 获取公海客户列表
  list: (params?: { skip?: number; limit?: number; template_id?: number; keyword?: string }) =>
    api.get('/customers/pool/', { params }),
  // 认领客户
  claim: (customerId: number) => api.post(`/customers/pool/${customerId}/claim`),
  // 释放客户
  release: (customerId: number, reason?: string) =>
    api.post(`/customers/pool/${customerId}/release`, { reason }),
  // 获取客户公海历史
  history: (customerId: number) => api.get(`/customers/pool/${customerId}/history`),
};

// 拜访任务类型
export const visitTaskTypeApi = {
  list: (params?: { active_only?: boolean }) => api.get('/visit-task-types/', { params }),
  get: (id: number) => api.get(`/visit-task-types/${id}`),
  create: (data: any) => api.post('/visit-task-types/', data),
  update: (id: number, data: any) => api.put(`/visit-task-types/${id}`, data),
  delete: (id: number) => api.delete(`/visit-task-types/${id}`),
};

// 拜访计划
export const visitPlanApi = {
  list: (params?: { date_from?: string; date_to?: string; assigned_to?: number; status?: string; skip?: number; limit?: number }) =>
    api.get('/visit-plans/', { params }),
  get: (id: number) => api.get(`/visit-plans/${id}`),
  create: (data: any) => api.post('/visit-plans/', data),
  update: (id: number, data: any) => api.put(`/visit-plans/${id}`, data),
  delete: (id: number) => api.delete(`/visit-plans/${id}`),
  publish: (id: number) => api.post(`/visit-plans/${id}/publish`),
  cancel: (id: number) => api.post(`/visit-plans/${id}/cancel`),
};

// 拜访任务
export const visitTaskApi = {
  list: (params?: { planned_date?: string; date_from?: string; date_to?: string; assigned_to?: number; customer_id?: number; task_type_id?: number; status?: string; skip?: number; limit?: number }) =>
    api.get('/visit-tasks/', { params }),
  get: (id: number) => api.get(`/visit-tasks/${id}`),
  create: (data: any) => api.post('/visit-tasks/', data),
  cancel: (id: number) => api.post(`/visit-tasks/${id}/cancel`),
};

// 拜访记录
export const visitRecordApi = {
  list: (params?: { date_from?: string; date_to?: string; user_id?: number; customer_id?: number; task_type_id?: number; status?: string; skip?: number; limit?: number }) =>
    api.get('/visit-records/', { params }),
  get: (id: number) => api.get(`/visit-records/${id}`),
  statsSummary: (params?: { date_from?: string; date_to?: string }) =>
    api.get('/visit-records/stats/summary', { params }),
  statsByUser: (params?: { date_from?: string; date_to?: string }) =>
    api.get('/visit-records/stats/by-user', { params }),
};

// 订阅订单管理（超管）
export const subscriptionApi = {
  list: (params?: { page?: number; page_size?: number; status?: string; tenant_id?: number }) =>
    api.get('/subscription-orders/', { params }),
  create: (data: any) => api.post('/subscription-orders/', data),
  update: (id: number, data: any) => api.put(`/subscription-orders/${id}`, data),
  activate: (id: number) => api.post(`/subscription-orders/${id}/activate`),
  cancel: (id: number) => api.post(`/subscription-orders/${id}/cancel`),
};

// 考勤管理
export const attendanceApi = {
  // 配置
  getConfig: () => api.get('/attendance/config'),
  updateConfig: (data: any) => api.put('/attendance/config', data),
  // 打卡地点
  listLocations: () => api.get('/attendance/locations'),
  createLocation: (data: any) => api.post('/attendance/locations', data),
  updateLocation: (id: number, data: any) => api.put(`/attendance/locations/${id}`, data),
  deleteLocation: (id: number) => api.delete(`/attendance/locations/${id}`),
  // 班次
  listShifts: () => api.get('/attendance/shifts'),
  createShift: (data: any) => api.post('/attendance/shifts', data),
  updateShift: (id: number, data: any) => api.put(`/attendance/shifts/${id}`, data),
  deleteShift: (id: number) => api.delete(`/attendance/shifts/${id}`),
  // 排班
  listSchedules: (params: { start_date: string; end_date: string; user_id?: number }) =>
    api.get('/attendance/schedules', { params }),
  batchSchedule: (data: { items: any[] }) => api.post('/attendance/schedules/batch', data),
  // 打卡
  punch: (data: { lat: number; lng: number; address?: string; wifi_ssid?: string; wifi_bssid?: string }) =>
    api.post('/attendance/punch', data),
  // 记录
  todayRecord: () => api.get('/attendance/records/today'),
  myRecords: (params: { year: number; month: number }) =>
    api.get('/attendance/records/my', { params }),
  listRecords: (params: { start_date: string; end_date: string; user_id?: number; status?: string; page?: number; page_size?: number }) =>
    api.get('/attendance/records', { params }),
  // 统计
  monthlyStats: (params: { year: number; month: number }) =>
    api.get('/attendance/stats/monthly', { params }),
  myMonthlyStats: (params: { year: number; month: number }) =>
    api.get('/attendance/stats/my-monthly', { params }),
};

export default api;
