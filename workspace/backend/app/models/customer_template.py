from sqlalchemy import Column, Integer, String, Boolean, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..database import Base


class CustomerTemplate(Base):
    __tablename__ = "tn_customer_templates"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, comment="模板名称")
    description = Column(Text, nullable=True, comment="模板描述")
    is_default = Column(Boolean, default=False, comment="是否默认模板")
    tenant_id = Column(Integer, ForeignKey("tn_tenants.id"), nullable=True, comment="所属租户，NULL表示系统模板")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # 关联
    template_fields = relationship("TemplateField", back_populates="template", cascade="all, delete-orphan")
    customers = relationship("Customer", back_populates="template")
