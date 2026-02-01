/**
 * React Query queryKey 工厂函数
 * 所有 queryKey 集中管理，禁止在页面中直接写字符串
 */

export const queryKeys = {
  // 客户
  customers: {
    all: ['customers'] as const,
    list: (filters?: Record<string, any>) => ['customers', 'list', filters] as const,
    detail: (id: number) => ['customers', 'detail', id] as const,
  },

  // 客户公海
  pool: {
    all: ['pool-customers'] as const,
    list: (filters?: Record<string, any>) => ['pool-customers', 'list', filters] as const,
  },

  // 模板
  templates: {
    all: ['templates'] as const,
    list: () => ['templates', 'list'] as const,
    detail: (id: number) => ['templates', 'detail', id] as const,
  },

  // 字段定义
  fields: {
    all: ['fields'] as const,
    list: () => ['fields', 'list'] as const,
  },

  // 用户
  users: {
    all: ['users'] as const,
    list: () => ['users', 'list'] as const,
    options: () => ['users', 'options'] as const,
  },

  // 角色
  roles: {
    all: ['roles'] as const,
    list: () => ['roles', 'list'] as const,
    permissions: () => ['roles', 'permissions'] as const,
  },

  // 区域
  regions: {
    all: ['regions'] as const,
    list: () => ['regions', 'list'] as const,
    management: () => ['regions', 'management'] as const,
  },

  // 租户
  tenants: {
    all: ['tenants'] as const,
    list: () => ['tenants', 'list'] as const,
  },

  // 拜访任务类型
  visitTaskTypes: {
    all: ['visitTaskTypes'] as const,
    list: (filters?: Record<string, any>) => ['visitTaskTypes', 'list', filters] as const,
    detail: (id: number) => ['visitTaskTypes', 'detail', id] as const,
  },

  // 拜访计划
  visitPlans: {
    all: ['visitPlans'] as const,
    list: (filters?: Record<string, any>) => ['visitPlans', 'list', filters] as const,
    detail: (id: number) => ['visitPlans', 'detail', id] as const,
  },

  // 拜访任务
  visitTasks: {
    all: ['visitTasks'] as const,
    list: (filters?: Record<string, any>) => ['visitTasks', 'list', filters] as const,
    detail: (id: number) => ['visitTasks', 'detail', id] as const,
  },

  // 拜访记录
  visitRecords: {
    all: ['visitRecords'] as const,
    list: (filters?: Record<string, any>) => ['visitRecords', 'list', filters] as const,
    detail: (id: number) => ['visitRecords', 'detail', id] as const,
    statsSummary: (filters?: Record<string, any>) => ['visitRecords', 'statsSummary', filters] as const,
  },
};
