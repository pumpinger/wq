// 用户信息类型
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

// 租户信息类型
export interface TenantInfo {
  id: number;
  name: string;
  code: string;
  status: string;
}
