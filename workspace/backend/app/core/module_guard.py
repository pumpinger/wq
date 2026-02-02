"""
模块守卫依赖 - 检查租户是否开通指定模块
"""
from fastapi import Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.tenant import Tenant
from .deps import get_current_active_user


def require_module(module_name: str):
    """
    返回 FastAPI Depends，检查租户是否开通该模块
    module_name: customer / attendance / visit
    super_admin 免检
    """
    def checker(
        request: Request,
        db: Session = Depends(get_db),
        current_user=Depends(get_current_active_user),
    ):
        # 超管免检
        if current_user.is_super_admin:
            return current_user

        if not current_user.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="用户未分配租户",
            )

        tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="租户不存在",
            )

        field_name = f"enable_{module_name}"
        enabled = getattr(tenant, field_name, None)
        if enabled is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"未知模块: {module_name}",
            )
        if not enabled:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"租户未开通该模块: {module_name}",
            )

        return current_user

    return checker
