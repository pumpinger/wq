"""
角色管理路由 (RBAC v2)
支持每个权限独立的数据范围
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import or_
from pydantic import BaseModel

from ..database import get_db
from ..models.user import User
from ..models.role import Role, Permission, UserRole, RolePermission
from ..core.deps import get_current_active_user, require_tenant_admin, get_effective_tenant_id, require_tenant_context

router = APIRouter(prefix="/roles", tags=["角色管理"])


# ===== Schemas =====

class PermissionResponse(BaseModel):
    id: int
    module: str
    action: str
    name: str
    description: Optional[str] = None

    class Config:
        from_attributes = True


class PermissionWithScope(BaseModel):
    """权限及其数据范围"""
    id: int
    module: str
    action: str
    name: str
    description: Optional[str] = None
    data_scope: str = "self"

    class Config:
        from_attributes = True


class PermissionInput(BaseModel):
    """创建/更新角色时的权限输入"""
    permission_id: int
    data_scope: str = "self"


class RoleCreate(BaseModel):
    name: str
    code: str
    description: Optional[str] = None
    data_scope: str = "self"  # 默认数据范围
    permissions: List[PermissionInput] = []


class RoleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    data_scope: Optional[str] = None
    permissions: Optional[List[PermissionInput]] = None


class RoleResponse(BaseModel):
    id: int
    name: str
    code: str
    description: Optional[str] = None
    is_system: bool
    data_scope: str  # 默认数据范围
    tenant_id: Optional[int] = None
    permissions: List[PermissionWithScope] = []

    class Config:
        from_attributes = True


# ===== Helper Functions =====

def role_to_response(role: Role) -> dict:
    """将角色对象转换为响应格式"""
    # 获取角色的权限及其数据范围
    permissions = []
    for rp in role.role_permissions:
        perm = rp.permission
        permissions.append({
            "id": perm.id,
            "module": perm.module,
            "action": perm.action,
            "name": perm.name,
            "description": perm.description,
            "data_scope": rp.data_scope
        })

    return {
        "id": role.id,
        "name": role.name,
        "code": role.code,
        "description": role.description,
        "is_system": role.is_system,
        "data_scope": role.data_scope,
        "tenant_id": role.tenant_id,
        "permissions": permissions
    }


# ===== Routes =====

@router.get("/permissions", response_model=List[PermissionResponse])
def list_permissions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """获取所有权限列表"""
    return db.query(Permission).all()


@router.get("/", response_model=List[RoleResponse])
def list_roles(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """获取角色列表（系统角色 + 租户自定义角色）"""
    tenant_id = get_effective_tenant_id(request, current_user)

    query = db.query(Role)

    if current_user.is_super_admin and tenant_id is None:
        # 超管未选择租户时，返回所有角色
        pass
    elif tenant_id:
        # 系统角色 + 租户自定义角色
        query = query.filter(
            or_(
                Role.tenant_id == None,  # 系统角色
                Role.tenant_id == tenant_id  # 租户自定义角色
            )
        )
    else:
        # 只返回系统角色
        query = query.filter(Role.tenant_id == None)

    roles = query.all()
    return [role_to_response(r) for r in roles]


@router.post("/", response_model=RoleResponse)
def create_role(
    request: Request,
    data: RoleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_tenant_admin)
):
    """创建自定义角色"""
    tenant_id = require_tenant_context(request, current_user)

    # 检查编码是否已存在
    existing = db.query(Role).filter(
        Role.tenant_id == tenant_id,
        Role.code == data.code
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="角色编码已存在")

    # 创建角色
    role = Role(
        tenant_id=tenant_id,
        name=data.name,
        code=data.code,
        description=data.description,
        data_scope=data.data_scope,
        is_system=False
    )
    db.add(role)
    db.flush()

    # 关联权限（带数据范围）
    for perm_input in data.permissions:
        perm = db.query(Permission).filter(Permission.id == perm_input.permission_id).first()
        if perm:
            role_perm = RolePermission(
                role_id=role.id,
                permission_id=perm.id,
                data_scope=perm_input.data_scope
            )
            db.add(role_perm)

    db.commit()
    db.refresh(role)
    return role_to_response(role)


@router.get("/{role_id}", response_model=RoleResponse)
def get_role(
    role_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """获取角色详情"""
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="角色不存在")

    tenant_id = get_effective_tenant_id(request, current_user)
    if role.tenant_id and role.tenant_id != tenant_id and not current_user.is_super_admin:
        raise HTTPException(status_code=403, detail="无权限查看该角色")

    return role_to_response(role)


@router.put("/{role_id}", response_model=RoleResponse)
def update_role(
    role_id: int,
    request: Request,
    data: RoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_tenant_admin)
):
    """更新角色"""
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="角色不存在")

    # 系统角色不能修改
    if role.is_system:
        raise HTTPException(status_code=403, detail="系统角色不能修改")

    tenant_id = get_effective_tenant_id(request, current_user)
    if role.tenant_id != tenant_id and not current_user.is_super_admin:
        raise HTTPException(status_code=403, detail="无权限修改该角色")

    # 更新字段
    if data.name is not None:
        role.name = data.name
    if data.description is not None:
        role.description = data.description
    if data.data_scope is not None:
        role.data_scope = data.data_scope

    # 更新权限（带数据范围）
    if data.permissions is not None:
        # 删除旧的权限关联
        db.query(RolePermission).filter(RolePermission.role_id == role.id).delete()
        db.flush()

        # 创建新的权限关联
        for perm_input in data.permissions:
            perm = db.query(Permission).filter(Permission.id == perm_input.permission_id).first()
            if perm:
                role_perm = RolePermission(
                    role_id=role.id,
                    permission_id=perm.id,
                    data_scope=perm_input.data_scope
                )
                db.add(role_perm)

    db.commit()
    db.refresh(role)
    return role_to_response(role)


@router.delete("/{role_id}")
def delete_role(
    role_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_tenant_admin)
):
    """删除角色"""
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="角色不存在")

    # 系统角色不能删除
    if role.is_system:
        raise HTTPException(status_code=403, detail="系统角色不能删除")

    tenant_id = get_effective_tenant_id(request, current_user)
    if role.tenant_id != tenant_id and not current_user.is_super_admin:
        raise HTTPException(status_code=403, detail="无权限删除该角色")

    db.delete(role)
    db.commit()
    return {"message": "删除成功"}


# ===== 用户角色分配 =====

@router.get("/user/{user_id}/roles", response_model=List[RoleResponse])
def get_user_roles(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_tenant_admin)
):
    """获取用户的角色列表"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    return [role_to_response(r) for r in user.roles]


@router.put("/user/{user_id}/roles")
def assign_user_roles(
    user_id: int,
    role_ids: List[int],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_tenant_admin)
):
    """为用户分配角色"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    # 不能修改超级管理员的角色
    if user.is_super_admin:
        raise HTTPException(status_code=403, detail="不能修改超级管理员的角色")

    # 获取角色
    roles = db.query(Role).filter(Role.id.in_(role_ids)).all()

    # 更新用户角色
    user.roles = roles
    db.commit()

    return {"message": "角色分配成功", "roles": [r.name for r in roles]}
