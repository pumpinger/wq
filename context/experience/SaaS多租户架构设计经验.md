# SaaS 多租户架构设计经验

## 背景
将单租户客户管理系统升级为 SaaS 多租户平台。

## 关键决策

### 1. 多租户数据隔离策略
**选择**: 共享数据库 + tenant_id 字段隔离

**优点**:
- 实现简单，不需要动态切换数据库
- 便于跨租户统计（超管视角）
- 资源利用率高

**缺点**:
- 需要在所有查询中添加 tenant_id 过滤
- 数据量大时性能可能下降

**最佳实践**:
- 封装 `get_xxx_query(db, current_user)` 函数统一处理租户过滤
- 所有业务表都添加 tenant_id 字段
- 系统级数据（如系统字段、系统模板）tenant_id 设为 NULL

### 2. 权限控制层次
```
超级管理员 (is_super_admin=True)
    └── 可管理所有租户

租户管理员 (role='tenant_admin')
    └── 可管理本租户所有数据

普通员工 (role='user')
    └── 只能管理自己负责的客户 (managed_by=user_id)
```

### 3. JWT Token 设计
Token Payload 包含:
- `sub`: 用户 ID
- `tenant_id`: 租户 ID
- `exp`: 过期时间

不在 Token 中存储权限信息，每次请求从数据库验证，保证权限变更即时生效。

## 踩坑记录

### 1. SQLAlchemy 枚举类型
MySQL 的 ENUM 类型在 SQLAlchemy 中需要显式定义:
```python
status = Column(
    Enum("active", "inactive", name="user_status"),
    default="active"
)
```

### 2. 外键约束顺序
创建表时注意外键引用顺序，被引用的表必须先创建:
```
tn_tenants → tn_users → tn_customers
```

### 3. OAuth2PasswordRequestForm
FastAPI 的 OAuth2 登录需要 `python-multipart` 依赖:
```bash
pip install python-multipart
```

## 代码模式

### 统一权限检查依赖
```python
from ..core.deps import get_current_active_user, require_tenant_admin

# 需要登录
@router.get("/")
def list_items(current_user: User = Depends(get_current_active_user)):
    pass

# 需要管理员权限
@router.post("/")
def create_item(current_user: User = Depends(require_tenant_admin)):
    pass
```

### 统一租户数据过滤
```python
def get_xxx_query(db: Session, current_user: User):
    query = db.query(Model)

    if current_user.is_super_admin:
        return query

    if current_user.tenant_id:
        query = query.filter(Model.tenant_id == current_user.tenant_id)

    return query
```

## 文件清单
- `backend/app/core/security.py` - JWT 和密码加密
- `backend/app/core/deps.py` - 权限依赖注入
- `backend/app/models/tenant.py` - 租户模型
- `backend/app/models/user.py` - 用户模型
- `backend/app/models/role.py` - 角色权限模型
- `backend/app/routes/auth.py` - 认证路由
- `backend/app/routes/tenants.py` - 租户管理路由
- `backend/app/routes/users.py` - 用户管理路由
- `backend/migrate_saas.py` - 数据库迁移脚本
- `frontend/src/contexts/AuthContext.tsx` - 认证上下文
- `frontend/src/pages/Login.tsx` - 登录页面
- `frontend/src/pages/admin/TenantList.tsx` - 租户管理页面
- `frontend/src/pages/tenant/UserList.tsx` - 员工管理页面

---

## 超管租户上下文切换设计（2026-01-24 补充）

### 问题
超级管理员操作租户级资源（模板、字段、员工）时，缺乏租户上下文，不清楚数据归属。

### 解决方案
实现"平台管理"和"租户管理"两种模式切换：

```
超管登录 → 平台管理模式（只看租户列表）
         ↓ 点击"进入管理"
         租户管理模式（以该租户视角操作）
         ↓ 点击"返回平台"
         平台管理模式
```

### 技术实现

**前端：**
```typescript
// AuthContext 增加租户选择状态
const [selectedTenant, setSelectedTenant] = useState<TenantInfo | null>(null);
const isInTenantMode = !!selectedTenant;

// API 请求自动带上 X-Tenant-Id Header
if (currentTenantId) {
  config.headers['X-Tenant-Id'] = currentTenantId;
}
```

**后端：**
```python
def get_effective_tenant_id(request: Request, current_user: User) -> int | None:
    """获取有效的租户ID"""
    if current_user.is_super_admin:
        header_tenant = request.headers.get("X-Tenant-Id")
        if header_tenant:
            return int(header_tenant)
        return None
    return current_user.tenant_id

def require_tenant_context(request, current_user) -> int:
    """要求必须有租户上下文"""
    tenant_id = get_effective_tenant_id(request, current_user)
    if tenant_id is None:
        raise HTTPException(400, "请先选择要管理的租户")
    return tenant_id
```

### 关键点
1. 超管未选择租户时，创建操作应报错，而非静默创建 tenant_id=NULL 的数据
2. 菜单根据模式动态显示，避免用户困惑
3. Header 用颜色和标签区分当前模式

---
*最后更新: 2026-01-24*
