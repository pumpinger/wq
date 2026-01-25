"""
依赖注入：获取当前用户、租户等
"""
from typing import Optional
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from ..database import get_db
from .security import verify_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

# 用于存储当前请求的租户上下文
_tenant_context: dict = {}


def get_current_user(
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
):
    """获取当前登录用户"""
    from ..models.user import User

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="未登录",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = verify_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token无效或已过期",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id_str = payload.get("sub")
    if user_id_str is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token无效",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = int(user_id_str)
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户不存在",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


def get_current_active_user(current_user = Depends(get_current_user)):
    """获取当前活跃用户（状态检查）"""
    if current_user.status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="用户已被禁用"
        )
    return current_user


def get_current_tenant(current_user = Depends(get_current_active_user)):
    """获取当前用户的租户"""
    from ..models.tenant import Tenant
    from ..database import SessionLocal

    if current_user.is_super_admin:
        return None  # 超级管理员不属于任何租户

    if not current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="用户未分配租户"
        )

    db = SessionLocal()
    try:
        tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="租户不存在"
            )
        if tenant.status != "active":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="租户已被禁用"
            )
        return tenant
    finally:
        db.close()


def require_super_admin(current_user = Depends(get_current_active_user)):
    """要求超级管理员权限"""
    if not current_user.is_super_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要超级管理员权限"
        )
    return current_user


def require_tenant_admin(current_user = Depends(get_current_active_user)):
    """要求租户管理员权限"""
    if current_user.is_super_admin:
        return current_user
    if current_user.role not in ["admin", "tenant_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要管理员权限"
        )
    return current_user


def get_effective_tenant_id(
    request: Request,
    current_user = Depends(get_current_active_user)
) -> Optional[int]:
    """
    获取有效的租户ID
    - 超管可以通过 X-Tenant-Id Header 指定租户
    - 普通用户使用自己的 tenant_id
    """
    if current_user.is_super_admin:
        # 超管可以通过 Header 指定租户
        header_tenant = request.headers.get("X-Tenant-Id")
        if header_tenant:
            try:
                return int(header_tenant)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="无效的租户ID"
                )
        return None  # 超管未指定租户
    return current_user.tenant_id


def require_tenant_context(
    request: Request,
    current_user = Depends(get_current_active_user)
) -> int:
    """
    要求必须有租户上下文
    - 租户用户：使用自己的 tenant_id
    - 超管：必须通过 Header 指定租户
    """
    tenant_id = get_effective_tenant_id(request, current_user)
    if tenant_id is None:
        if current_user.is_super_admin:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="请先选择要管理的租户"
            )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="用户未分配租户"
        )
    return tenant_id


def require_permission(permission: str):
    """
    权限检查依赖工厂函数
    用法: Depends(require_permission("customer:delete"))
    """
    from .permissions import check_permission

    def checker(
        db: Session = Depends(get_db),
        current_user = Depends(get_current_active_user)
    ):
        if not check_permission(db, current_user, permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"没有权限: {permission}"
            )
        return current_user

    return checker
