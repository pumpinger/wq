import request from './index';

export interface Permission {
  id: number;
  module: string;
  action: string;
  name: string;
  description?: string;
}

export interface Role {
  id: number;
  name: string;
  code: string;
  description?: string;
  is_system: boolean;
  data_scope: string;
  tenant_id?: number;
  permissions: Permission[];
}

export interface RoleCreate {
  name: string;
  code: string;
  description?: string;
  data_scope: string;
  permission_ids: number[];
}

export interface RoleUpdate {
  name?: string;
  description?: string;
  data_scope?: string;
  permission_ids?: number[];
}

export const roleApi = {
  // 获取所有权限
  getPermissions: () => request.get<Permission[]>('/roles/permissions'),

  // 获取角色列表
  list: () => request.get<Role[]>('/roles/'),

  // 获取角色详情
  get: (id: number) => request.get<Role>(`/roles/${id}`),

  // 创建角色
  create: (data: RoleCreate) => request.post<Role>('/roles/', data),

  // 更新角色
  update: (id: number, data: RoleUpdate) => request.put<Role>(`/roles/${id}`, data),

  // 删除角色
  delete: (id: number) => request.delete(`/roles/${id}`),

  // 获取用户的角色
  getUserRoles: (userId: number) => request.get<Role[]>(`/roles/user/${userId}/roles`),

  // 为用户分配角色
  assignUserRoles: (userId: number, roleIds: number[]) =>
    request.put(`/roles/user/${userId}/roles`, roleIds),
};
