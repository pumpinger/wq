"""
权限检查服务
"""
from typing import List, Set, Optional
from functools import wraps
from fastapi import HTTPException, status, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.user import User
from ..models.role import Role, Permission, UserRole


def get_user_permissions(db: Session, user_id: int) -> Set[str]:
    """获取用户的所有权限编码"""
    # 查询用户的所有角色
    roles = db.query(Role).join(
        UserRole, UserRole.role_id == Role.id
    ).filter(UserRole.user_id == user_id).all()

    # 收集所有权限
    permissions = set()
    for role in roles:
        for perm in role.permissions:
            permissions.add(perm.code)

    return permissions


def get_user_data_scope(db: Session, user: User) -> str:
    """获取用户的数据范围（取角色中最大的）"""
    if user.is_super_admin:
        return 'all'

    # 查询用户的所有角色
    roles = db.query(Role).join(
        UserRole, UserRole.role_id == Role.id
    ).filter(UserRole.user_id == user.id).all()

    if not roles:
        # 如果没有角色，使用用户表的 data_scope
        return user.data_scope or 'self'

    # 取最大的 data_scope
    scopes = [r.data_scope for r in roles if r.data_scope]
    if 'all' in scopes:
        return 'all'
    if 'team' in scopes:
        return 'team'
    return 'self'


def check_permission(db: Session, user: User, permission: str) -> bool:
    """检查用户是否有某个权限"""
    # 超管有所有权限
    if user.is_super_admin:
        return True

    # 租户管理员（旧逻辑兼容）有所有租户内权限
    if user.role == 'tenant_admin':
        return True

    # 检查 RBAC 权限
    user_permissions = get_user_permissions(db, user.id)
    return permission in user_permissions


def require_permission(permission: str):
    """权限检查装饰器，用于路由"""
    from .deps import get_current_active_user

    def decorator(func):
        @wraps(func)
        async def wrapper(*args, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user), **kwargs):
            if not check_permission(db, current_user, permission):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"没有权限执行此操作，需要权限: {permission}"
                )
            return await func(*args, db=db, current_user=current_user, **kwargs)
        return wrapper
    return decorator


class PermissionChecker:
    """权限检查依赖，用于 FastAPI Depends"""

    def __init__(self, permission: str):
        self.permission = permission

    def __call__(self, db: Session = Depends(get_db), current_user: User = Depends(None)):
        from .deps import get_current_active_user
        # 这里需要手动获取 current_user，因为依赖注入的顺序问题
        if not check_permission(db, current_user, self.permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"没有权限执行此操作，需要权限: {self.permission}"
            )
        return True
