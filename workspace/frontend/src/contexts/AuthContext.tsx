import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { authApi, setTenantHeader } from '../api';
import type { UserInfo, TenantInfo } from '../types/auth';

// Re-export types for convenience
export type { UserInfo, TenantInfo } from '../types/auth';

// 认证上下文类型
interface AuthContextType {
  user: UserInfo | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  // 租户上下文（超管专用）
  selectedTenant: TenantInfo | null;
  isInTenantMode: boolean;
  enterTenant: (tenant: TenantInfo) => void;
  exitTenantMode: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTenant, setSelectedTenant] = useState<TenantInfo | null>(null);

  // 初始化时检查本地存储的用户信息
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('access_token');
      const storedUser = localStorage.getItem('user_info');

      if (token && storedUser) {
        try {
          // 验证 token 是否有效
          const response = await authApi.me();
          setUser(response.data);
          localStorage.setItem('user_info', JSON.stringify(response.data));
        } catch (error) {
          // Token 无效，清除存储
          localStorage.removeItem('access_token');
          localStorage.removeItem('user_info');
          setUser(null);
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  // 登录
  const login = async (username: string, password: string) => {
    const response = await authApi.login(username, password);
    const { access_token, user: userInfo } = response.data;

    localStorage.setItem('access_token', access_token);
    localStorage.setItem('user_info', JSON.stringify(userInfo));
    setUser(userInfo);
  };

  // 登出
  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_info');
    localStorage.removeItem('selected_tenant');
    setUser(null);
    setSelectedTenant(null);
    setTenantHeader(null);
  };

  // 进入租户管理模式（超管专用）
  const enterTenant = (tenant: TenantInfo) => {
    setSelectedTenant(tenant);
    localStorage.setItem('selected_tenant', JSON.stringify(tenant));
    setTenantHeader(tenant.id);
  };

  // 退出租户管理模式
  const exitTenantMode = () => {
    setSelectedTenant(null);
    localStorage.removeItem('selected_tenant');
    setTenantHeader(null);
  };

  // 是否在租户管理模式
  const isInTenantMode = !!selectedTenant;

  // 刷新用户信息
  const refreshUser = async () => {
    try {
      const response = await authApi.me();
      setUser(response.data);
      localStorage.setItem('user_info', JSON.stringify(response.data));
    } catch (error) {
      logout();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        refreshUser,
        selectedTenant,
        isInTenantMode,
        enterTenant,
        exitTenantMode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// 自定义 Hook
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
