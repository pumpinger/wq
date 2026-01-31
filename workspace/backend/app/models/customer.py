from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Numeric, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..database import Base


class Customer(Base):
    __tablename__ = "tn_customers"
    __table_args__ = (
        Index("idx_customer_tenant_id", "tenant_id"),
        Index("idx_customer_managed_by", "managed_by"),
        Index("idx_customer_region_id", "region_id"),
        Index("idx_customer_template_id", "template_id"),
        Index("idx_customer_created_at", "created_at"),
        {"extend_existing": True},
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(200), nullable=False, comment="客户名称")
    address = Column(String(500), nullable=True, comment="地址")
    latitude = Column(Numeric(10, 7), nullable=True, comment="纬度")
    longitude = Column(Numeric(10, 7), nullable=True, comment="经度")
    managed_by = Column(Integer, nullable=True, comment="负责人ID")
    template_id = Column(Integer, ForeignKey("tn_customer_templates.id"), nullable=True, comment="使用的模板")
    tenant_id = Column(Integer, ForeignKey("tn_tenants.id"), nullable=True, comment="所属租户")
    region_id = Column(Integer, ForeignKey("tn_regions.id"), nullable=True, comment="所属区域")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # 关联
    template = relationship("CustomerTemplate", back_populates="customers")
    field_values = relationship("CustomerFieldValue", back_populates="customer", cascade="all, delete-orphan")
    region = relationship("Region", backref="customers")
