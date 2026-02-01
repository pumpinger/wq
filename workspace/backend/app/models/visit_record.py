from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, Numeric, JSON, Index, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..database import Base


class VisitRecord(Base):
    """拜访执行记录"""
    __tablename__ = "tn_visit_records"
    __table_args__ = (
        Index("idx_vr_user_time", "user_id", "check_in_time"),
        Index("idx_vr_customer", "customer_id"),
        Index("idx_vr_tenant", "tenant_id"),
        {"extend_existing": True},
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id = Column(Integer, ForeignKey("tn_tenants.id"), nullable=False, comment="租户ID")
    task_id = Column(Integer, ForeignKey("tn_visit_tasks.id", ondelete="SET NULL"), nullable=True, comment="关联任务")
    customer_id = Column(Integer, ForeignKey("tn_customers.id"), nullable=False, comment="客户")
    user_id = Column(Integer, ForeignKey("tn_users.id"), nullable=False, comment="执行人")
    task_type_id = Column(Integer, ForeignKey("tn_visit_task_types.id"), nullable=False, comment="任务类型")
    check_in_time = Column(DateTime, nullable=False, comment="签到时间")
    check_in_lat = Column(Numeric(10, 7), nullable=True, comment="签到纬度")
    check_in_lng = Column(Numeric(10, 7), nullable=True, comment="签到经度")
    check_in_address = Column(String(500), nullable=True, comment="签到地址")
    check_in_distance = Column(Integer, nullable=True, comment="距客户距离(米)")
    check_out_time = Column(DateTime, nullable=True, comment="签退时间")
    check_out_lat = Column(Numeric(10, 7), nullable=True, comment="签退纬度")
    check_out_lng = Column(Numeric(10, 7), nullable=True, comment="签退经度")
    duration_minutes = Column(Integer, nullable=True, comment="拜访时长(分钟)")
    status = Column(String(20), default="in_progress", comment="状态: in_progress/completed/abnormal")
    remark = Column(Text, nullable=True, comment="备注")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # 关联
    task = relationship("VisitTask", back_populates="record")
    customer = relationship("Customer", backref="visit_records")
    user = relationship("User", backref="visit_records")
    task_type = relationship("VisitTaskType", backref="records")
    field_values = relationship("VisitRecordField", back_populates="record", cascade="all, delete-orphan")
    photos = relationship("VisitPhoto", back_populates="record", cascade="all, delete-orphan")


class VisitRecordField(Base):
    """拜访记录表单值"""
    __tablename__ = "tn_visit_record_fields"
    __table_args__ = (
        UniqueConstraint("record_id", "field_key", name="uq_vrf_record_field"),
        {"extend_existing": True},
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    record_id = Column(Integer, ForeignKey("tn_visit_records.id", ondelete="CASCADE"), nullable=False)
    field_key = Column(String(50), nullable=False, comment="字段key")
    value = Column(JSON, nullable=True, comment="字段值")

    # 关联
    record = relationship("VisitRecord", back_populates="field_values")


class VisitPhoto(Base):
    """拜访照片"""
    __tablename__ = "tn_visit_photos"
    __table_args__ = (
        Index("idx_vp_record_id", "record_id"),
        {"extend_existing": True},
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    record_id = Column(Integer, ForeignKey("tn_visit_records.id", ondelete="CASCADE"), nullable=False)
    field_key = Column(String(50), nullable=True, comment="关联的表单字段key")
    file_path = Column(String(500), nullable=False, comment="文件路径")
    file_name = Column(String(200), nullable=True, comment="原始文件名")
    file_size = Column(Integer, nullable=True, comment="文件大小(字节)")
    thumbnail_path = Column(String(500), nullable=True, comment="缩略图路径")
    sort_order = Column(Integer, default=0, comment="排序")
    created_at = Column(DateTime, server_default=func.now())

    # 关联
    record = relationship("VisitRecord", back_populates="photos")
