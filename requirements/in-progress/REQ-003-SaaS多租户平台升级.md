# REQ-003 SaaS 多租户平台升级

## 需求概述
将现有客户管理系统升级为完整的 SaaS 多租户平台，支持多公司隔离、员工管理、权限控制和登录认证。

## 功能需求

### 1. 多租户架构
- 租户（公司）管理：创建、编辑、禁用租户
- 数据隔离：所有业务数据按 tenant_id 隔离
- 租户配额：可配置用户数上限等

### 2. 用户认证
- JWT Token 登录认证
- 密码加密存储（bcrypt）
- Token 刷新机制
- 登出功能

### 3. 角色权限
- 超级管理员：管理所有租户
- 租户管理员：管理本租户员工和配置
- 普通员工：操作业务数据

### 4. 员工管理
- 员工 CRUD
- 员工角色分配
- 员工状态管理（启用/禁用）

### 5. 数据权限
- 客户数据按 managed_by 过滤
- 管理员可查看所有数据
- 普通员工只看自己负责的客户

## 技术方案

### 数据库设计

```sql
-- 租户表
CREATE TABLE tn_tenants (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL COMMENT '租户名称',
    code VARCHAR(50) NOT NULL UNIQUE COMMENT '租户编码',
    status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
    max_users INT DEFAULT 10 COMMENT '最大用户数',
    expires_at DATE COMMENT '到期时间',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 修改用户表（增加字段）
ALTER TABLE tn_users ADD COLUMN tenant_id INT COMMENT '所属租户';
ALTER TABLE tn_users ADD COLUMN email VARCHAR(100) COMMENT '邮箱';
ALTER TABLE tn_users ADD COLUMN phone VARCHAR(20) COMMENT '手机号';
ALTER TABLE tn_users ADD COLUMN real_name VARCHAR(50) COMMENT '真实姓名';
ALTER TABLE tn_users ADD COLUMN status ENUM('active', 'inactive') DEFAULT 'active';
ALTER TABLE tn_users ADD COLUMN is_super_admin BOOLEAN DEFAULT FALSE COMMENT '是否超级管理员';

-- 角色表
CREATE TABLE tn_roles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT COMMENT '所属租户，NULL表示系统角色',
    name VARCHAR(50) NOT NULL COMMENT '角色名称',
    code VARCHAR(50) NOT NULL COMMENT '角色编码',
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_tenant_code (tenant_id, code)
);

-- 用户角色关联表
CREATE TABLE tn_user_roles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    role_id INT NOT NULL,
    UNIQUE KEY uk_user_role (user_id, role_id),
    FOREIGN KEY (user_id) REFERENCES tn_users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES tn_roles(id) ON DELETE CASCADE
);

-- 权限表
CREATE TABLE tn_permissions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(100) NOT NULL UNIQUE COMMENT '权限编码',
    name VARCHAR(100) NOT NULL COMMENT '权限名称',
    module VARCHAR(50) COMMENT '所属模块',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 角色权限关联表
CREATE TABLE tn_role_permissions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    role_id INT NOT NULL,
    permission_id INT NOT NULL,
    UNIQUE KEY uk_role_permission (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES tn_roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES tn_permissions(id) ON DELETE CASCADE
);

-- 修改客户表（增加租户字段）
ALTER TABLE tn_customers ADD COLUMN tenant_id INT COMMENT '所属租户';

-- 修改其他业务表增加 tenant_id
ALTER TABLE tn_customer_templates ADD COLUMN tenant_id INT COMMENT '所属租户';
ALTER TABLE tn_field_definitions ADD COLUMN tenant_id INT COMMENT '所属租户，NULL表示系统字段';
```

### 后端架构

```
backend/app/
├── core/
│   ├── security.py      # JWT、密码加密
│   ├── deps.py          # 依赖注入（获取当前用户、租户）
│   └── permissions.py   # 权限装饰器
├── models/
│   ├── tenant.py        # 租户模型
│   ├── user.py          # 用户模型（扩展）
│   ├── role.py          # 角色模型
│   └── permission.py    # 权限模型
├── schemas/
│   ├── auth.py          # 登录相关
│   ├── tenant.py        # 租户
│   ├── user.py          # 用户
│   └── role.py          # 角色
├── routes/
│   ├── auth.py          # 登录、登出
│   ├── tenants.py       # 租户管理（超管）
│   ├── users.py         # 用户管理
│   └── roles.py         # 角色管理
└── middleware/
    └── tenant.py        # 租户上下文中间件
```

### 前端架构

```
frontend/src/
├── pages/
│   ├── Login.tsx           # 登录页
│   ├── admin/              # 总后台
│   │   ├── TenantList.tsx  # 租户管理
│   │   └── Dashboard.tsx   # 总览
│   └── tenant/             # 租户后台
│       ├── UserList.tsx    # 员工管理
│       ├── RoleList.tsx    # 角色管理
│       └── Dashboard.tsx   # 工作台
├── contexts/
│   └── AuthContext.tsx     # 认证上下文
├── hooks/
│   └── useAuth.ts          # 认证钩子
└── utils/
    └── request.ts          # 带Token的请求封装
```

## 开发计划

### 阶段一：基础设施
- [x] 创建租户表和角色权限表
- [x] 修改用户表结构
- [x] JWT 认证模块
- [x] 数据隔离中间件

### 阶段二：总后台
- [x] 租户 CRUD API
- [x] 总后台前端
- [x] 超级管理员账号

### 阶段三：租户后台
- [x] 员工管理 API
- [x] 角色权限 API
- [x] 登录页面
- [x] 员工/角色管理界面

### 阶段四：业务集成
- [x] 客户管理租户隔离
- [x] 数据权限过滤
- [x] 界面权限控制

## 状态
- **创建时间**: 2026-01-23
- **状态**: 开发完成，待测试

## 部署说明

### 运行迁移脚本
```bash
cd backend
python migrate_saas.py
```

### 默认超级管理员
- 用户名: `superadmin`
- 密码: `admin123`
- 请登录后立即修改密码!

## 测试计划
1. 单元测试：认证、权限模块
2. 集成测试：多租户数据隔离
3. 端到端测试：完整登录和业务流程
