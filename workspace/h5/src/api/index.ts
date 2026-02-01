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
