# 外勤管理系统 (Field Work Management System)

## 项目概述

多租户 SaaS 外勤客户管理系统，支持动态表单、区域权限、客户公海等功能。

## 技术栈

- **前端**: React 19 + TypeScript + Vite 7 + Ant Design 6 + React Query 5 + Leaflet
- **后端**: FastAPI + SQLAlchemy 2.0 + Pydantic 2.5 + PyMySQL
- **数据库**: MySQL 8.0 (InnoDB)
- **认证**: JWT (python-jose + passlib/bcrypt)

## 启动方式

```bash
# 后端
cd workspace/backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 前端
cd workspace/frontend
npm install
npm run dev  # port 5173
```

## 项目结构

```
workspace/
├── backend/app/
│   ├── main.py              # FastAPI 入口
│   ├── database.py          # 数据库连接
│   ├── core/deps.py         # 认证依赖 (get_current_active_user, get_effective_tenant_id)
│   ├── models/              # SQLAlchemy 模型 (14张表, tn_前缀)
│   ├── schemas/             # Pydantic 数据模式
│   └── routes/              # API 路由 (9个Router)
│       ├── auth.py          # 认证 (/api/auth)
│       ├── customers.py     # 客户管理 (/api/customers) - 最大文件
│       ├── customer_pool.py # 客户公海 (/api/customers/pool)
│       ├── customer_templates.py # 模板 (/api/customer-templates)
│       ├── field_definitions.py  # 字段 (/api/field-definitions)
│       ├── users.py         # 用户 (/api/users)
│       ├── roles.py         # 角色 (/api/roles)
│       ├── regions.py       # 区域 (/api/regions)
│       └── tenants.py       # 租户 (/api/tenants)
├── frontend/src/
│   ├── App.tsx              # 主应用 (路由+布局+菜单)
│   ├── api/index.ts         # Axios API 封装
│   ├── api/queryKeys.ts     # React Query queryKey 工厂
│   ├── types/index.ts       # TypeScript 类型定义
│   ├── contexts/AuthContext.tsx # 认证上下文
│   ├── components/          # 共享组件
│   │   ├── CustomerForm.tsx # 客户表单 (动态字段)
│   │   └── ErrorBoundary.tsx # 错误边界
│   └── pages/               # 页面 (10个)
│       ├── CustomerList.tsx  # 客户管理
│       ├── CustomerMap.tsx   # 客户分布 (Leaflet地图)
│       ├── CustomerPool.tsx  # 客户公海
│       ├── TemplateList.tsx  # 模板管理
│       ├── FieldList.tsx     # 字段管理
│       ├── Login.tsx         # 登录页
│       ├── admin/TenantList.tsx    # 超管-租户管理
│       └── tenant/
│           ├── UserList.tsx  # 员工管理
│           ├── RoleList.tsx  # 角色权限
│           └── RegionList.tsx # 区域管理
```

## 关键设计决策

### 多租户隔离
- 共享数据库 + `tenant_id` 字段隔离
- 所有表以 `tn_` 为前缀
- 超管可通过 `X-Tenant-Id` Header 切换租户上下文

### 权限系统 (三层共存)
1. **User.role 字段**: `tenant_admin` / `user` (粗粒度)
2. **User.is_super_admin**: 平台超级管理员
3. **RBAC 角色表**: Role + Permission + data_scope (细粒度)
- `data_scope`: `self` (仅自己) / `team` (自己+下属) / `all` (全部)

### 区域权限
- Region 表支持区域划分, UserRegion 表关联用户-区域
- Tenant.enable_region_scope 开关控制是否启用
- 启用后，用户只能操作所负责区域内的客户

### 动态表单
- FieldDefinition: 全局字段定义 (text/number/date/select/multi_select)
- CustomerTemplate: 模板选择哪些字段，配置必填和排序
- TemplateField: 模板-字段关联，可覆盖字段选项
- CustomerFieldValue: 客户的字段值 (JSON类型)

### 客户公海
- `managed_by = NULL` 表示客户在公海中
- 释放(release) → 认领(claim) → 自动回收(auto_reclaim)
- CustomerPoolRecord 记录公海操作历史

## 代码约定

### QueryKey 规范
使用 `api/queryKeys.ts` 中的工厂函数，禁止在页面中直接写字符串 queryKey:
```typescript
import { queryKeys } from '../api/queryKeys';
// 正确: queryKey: queryKeys.customers.list(filters)
// 错误: queryKey: ['customers', filters]
```

### 后端路由模式
```python
# 标准 CRUD 路由
router = APIRouter(prefix="/资源名", tags=["标签"])
# GET    /          → list_xxx (列表)
# POST   /          → create_xxx (创建)
# GET    /{id}      → get_xxx (详情)
# PUT    /{id}      → update_xxx (更新)
# DELETE /{id}      → delete_xxx (删除)

# 权限查询构建
query = get_customer_query(db, current_user, tenant_id)  # 自动处理租户隔离+数据权限
```

### 前端页面模式
```typescript
// 页面标准结构: 列表 + 编辑Modal + 详情Modal
const XxxList: React.FC = () => {
  const queryClient = useQueryClient();
  const [form] = Form.useForm();
  // useQuery 获取数据
  // useMutation / async 函数处理变更
  // Table + Modal 组合
};
```

## 注意事项

- **queryKey 碰撞**: 不同页面使用相同 queryKey 会导致白屏，已发生过两次事故
- **App.tsx selectedKey**: 初始化依赖用户角色，`getInitialKey()` 函数处理不同角色的默认页面
- **导出路由顺序**: `/export/excel` 必须在 `/{customer_id}` 之前定义
- **表格布局**: 内容区约 658px 宽，表格列宽需要精简，使用 `size="small"` 按钮
- **超管租户上下文**: 超管操作业务数据时必须先选择租户 (通过 X-Tenant-Id Header)
