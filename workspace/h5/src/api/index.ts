import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api',
  timeout: 10000,
});

// 请求拦截器 - 添加 Token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 响应拦截器 - 处理 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user_info');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

// Auth API
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

// Customer API
export const customerApi = {
  list: (params?: {
    skip?: number;
    limit?: number;
    template_id?: number;
    keyword?: string;
  }) => api.get('/customers/', { params }),
  get: (id: number) => api.get(`/customers/${id}`),
  create: (data: any) => api.post('/customers/', data),
  update: (id: number, data: any) => api.put(`/customers/${id}`, data),
  delete: (id: number) => api.delete(`/customers/${id}`),
};

// Template API (只读)
export const templateApi = {
  list: () => api.get('/customer-templates/'),
  get: (id: number) => api.get(`/customer-templates/${id}`),
};

// Field API (只读)
export const fieldApi = {
  list: () => api.get('/field-definitions/'),
};

// Region API (只读)
export const regionApi = {
  list: () => api.get('/regions'),
};

// 客户公海 API
export const poolApi = {
  list: (params?: { skip?: number; limit?: number; template_id?: number; keyword?: string }) =>
    api.get('/customers/pool/', { params }),
  claim: (customerId: number) => api.post(`/customers/pool/${customerId}/claim`),
  release: (customerId: number, reason?: string) =>
    api.post(`/customers/pool/${customerId}/release`, { reason }),
  history: (customerId: number) => api.get(`/customers/pool/${customerId}/history`),
};

// 拜访 API
export const visitApi = {
  // 任务类型
  getTaskTypes: () => api.get('/visit-task-types/'),
  getTaskType: (id: number) => api.get(`/visit-task-types/${id}`),
  // 今日任务
  todayTasks: () => api.get('/visit-tasks/my/today'),
  myTasks: (params?: { date_from?: string; date_to?: string; status?: string; skip?: number; limit?: number }) =>
    api.get('/visit-tasks/my/list', { params }),
  getTask: (id: number) => api.get(`/visit-tasks/${id}`),
  // 签到/签退
  checkIn: (taskId: number, data: { lat: number; lng: number; address?: string }) =>
    api.post(`/visit-tasks/${taskId}/check-in`, data),
  complete: (taskId: number, data: { field_values?: any[]; photos?: string[]; remark?: string; check_out_lat?: number; check_out_lng?: number }) =>
    api.post(`/visit-tasks/${taskId}/complete`, data),
  // 临时任务
  createTask: (data: any) => api.post('/visit-tasks/', data),
  // 拜访记录
  myRecords: (params?: { date_from?: string; date_to?: string; skip?: number; limit?: number }) =>
    api.get('/visit-records/my', { params }),
  getRecord: (id: number) => api.get(`/visit-records/${id}`),
  // 图片上传
  uploadImage: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/upload/image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};
