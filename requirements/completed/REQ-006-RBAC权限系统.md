# REQ-006 RBAC 权限系统

## 需求概述
实现标准的 RBAC（基于角色的访问控制）权限系统，支持：
1. 灵活的角色定义
2. 细粒度的功能权限控制
3. 独立的数据范围控制
4. 易于扩展新功能权限

## 架构设计

### 数据模型

```
用户(User) ←→ 用户角色(UserRole) ←→ 角色(Role)
                                        ↓
                                角色权限(RolePermission) ←→ 权限(Permission)
```

### 数据库表设计

#### 1. tn_roles 角色表
```sql
CREATE TABLE tn_roles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NULL COMMENT '所属租户，NULL为系统预置角色',
    name VARCHAR(50) NOT NULL COMMENT '角色名称',
    code VARCHAR(50) NOT NULL COMMENT '角色编码',
    description VARCHAR(200) COMMENT '角色描述',
    is_system BOOLEAN DEFAULT FALSE COMMENT '是否系统预置',
    data_scope ENUM('self', 'team', 'all') DEFAULT 'self' COMMENT '数据范围',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_tenant_code (tenant_id, code)
);
```

#### 2. tn_permissions 权限表
```sql
CREATE TABLE tn_permissions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    module VARCHAR(50) NOT NULL COMMENT '模块：customer, template, user等',
    action VARCHAR(50) NOT NULL COMMENT '操作：view, create, edit, delete等',
    name VARCHAR(100) NOT NULL COMMENT '权限名称',
    description VARCHAR(200) COMMENT '权限描述',
    UNIQUE KEY uk_module_action (module, action)
);
```

#### 3. tn_role_permissions 角色权限关联表
```sql
CREATE TABLE tn_role_permissions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    role_id INT NOT NULL,
    permission_id INT NOT NULL,
    UNIQUE KEY uk_role_permission (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES tn_roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES tn_permissions(id) ON DELETE CASCADE
);
```

#### 4. tn_user_roles 用户角色关联表
```sql
CREATE TABLE tn_user_roles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    role_id INT NOT NULL,
    UNIQUE KEY uk_user_role (user_id, role_id),
    FOREIGN KEY (user_id) REFERENCES tn_users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES tn_roles(id) ON DELETE CASCADE
);
```

### 预置权限

| 模块 | 操作 | 权限编码 | 说明 |
|------|------|----------|------|
| customer | view | customer:view | 查看客户 |
| customer | create | customer:create | 创建客户 |
| customer | edit | customer:edit | 编辑客户 |
| customer | delete | customer:delete | 删除客户 |
| customer | transfer | customer:transfer | 转移跟进人 |
| template | view | template:view | 查看模板 |
| template | manage | template:manage | 管理模板 |
| field | view | field:view | 查看字段 |
| field | manage | field:manage | 管理字段 |
| user | view | user:view | 查看员工 |
| user | manage | user:manage | 管理员工 |
| role | manage | role:manage | 管理角色 |

### 预置角色

| 角色编码 | 名称 | 数据范围 | 权限 |
|----------|------|----------|------|
| tenant_admin | 租户管理员 | all | 全部权限 |
| manager | 部门经理 | team | 客户全部 + 查看员工 |
| sales | 销售员 | self | 客户查看/创建/编辑 |

## 权限检查逻辑

```python
def check_permission(user: User, permission: str) -> bool:
    """检查用户是否有某个权限"""
    # 超管有所有权限
    if user.is_super_admin:
        return True

    # 查询用户的所有角色的权限
    user_permissions = get_user_permissions(user.id)
    return permission in user_permissions

def get_data_scope(user: User) -> str:
    """获取用户的数据范围（取最大的）"""
    if user.is_super_admin:
        return 'all'

    roles = get_user_roles(user.id)
    scopes = [r.data_scope for r in roles]

    if 'all' in scopes:
        return 'all'
    if 'team' in scopes:
        return 'team'
    return 'self'
```

## 开发计划

- [x] 1. 创建数据库表
- [x] 2. 创建 SQLAlchemy 模型
- [x] 3. 初始化预置权限和角色
- [x] 4. 实现权限检查依赖注入
- [x] 5. 创建角色管理 API
- [x] 6. 前端角色管理页面
- [x] 7. 前端用户角色分配
- [x] 8. 测试验证

## 待优化（后续迭代）

- [ ] 修改现有 API 使用 `require_permission()` 进行权限检查
- [ ] 在菜单和按钮级别根据权限动态显示/隐藏

## 迁移策略

1. 现有 `role='tenant_admin'` 用户 → 分配 `tenant_admin` 角色
2. 现有 `role='user'` 用户 → 分配 `sales` 角色
3. 保留 `data_scope` 字段在用户表，优先使用角色的 data_scope

## 状态
- **创建时间**: 2026-01-24
- **完成时间**: 2026-01-24
- **状态**: ✅ 已完成

## 实现成果

### 后端
- `backend/app/models/role.py` - RBAC 数据模型（Role, Permission, UserRole, RolePermission）
- `backend/app/core/permissions.py` - 权限检查服务
- `backend/app/routes/roles.py` - 角色管理 API
- `backend/migrate_rbac.py` - 数据迁移脚本

### 前端
- `frontend/src/pages/tenant/RoleList.tsx` - 角色管理页面
- `frontend/src/pages/tenant/UserList.tsx` - 员工角色分配功能
- `frontend/src/api/index.ts` - roleApi 接口
