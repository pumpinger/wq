"""
考勤模型 - 5张表
"""
from sqlalchemy import (
    Column, Integer, String, DateTime, Date, Time, Boolean,
    ForeignKey, Enum, Text, Numeric, UniqueConstraint,
)
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from ..database import Base


class AttendanceConfig(Base):
    """租户考勤配置（1对1）"""
    __tablename__ = "tn_attendance_configs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id = Column(Integer, ForeignKey("tn_tenants.id"), unique=True, nullable=False)
    schedule_mode = Column(
        Enum("fixed", "rotating", "flex", name="schedule_mode_type"),
        default="fixed",
        comment="排班模式: fixed=固定 / rotating=轮班 / flex=弹性",
    )
    punch_radius = Column(Integer, default=200, comment="打卡范围(米)")
    wifi_check_enabled = Column(Boolean, default=False, comment="WiFi校验")
    late_tolerance_minutes = Column(Integer, default=0, comment="迟到容忍分钟")
    early_leave_tolerance_minutes = Column(Integer, default=0, comment="早退容忍分钟")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    tenant = relationship("Tenant", backref="attendance_config")


class AttendanceLocation(Base):
    """打卡地点"""
    __tablename__ = "tn_attendance_locations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id = Column(Integer, ForeignKey("tn_tenants.id"), nullable=False)
    name = Column(String(100), nullable=False, comment="地点名称")
    latitude = Column(Numeric(10, 7), nullable=False)
    longitude = Column(Numeric(10, 7), nullable=False)
    address = Column(String(500), nullable=True)
    radius = Column(Integer, default=200, comment="单点覆盖范围(米)")
    wifi_ssid = Column(String(100), nullable=True, comment="WiFi名称")
    wifi_bssid = Column(String(100), nullable=True, comment="WiFi MAC")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class AttendanceShift(Base):
    """班次定义"""
    __tablename__ = "tn_attendance_shifts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id = Column(Integer, ForeignKey("tn_tenants.id"), nullable=False)
    name = Column(String(50), nullable=False, comment="班次名称")
    start_time = Column(Time, nullable=False, comment="上班时间")
    end_time = Column(Time, nullable=False, comment="下班时间")
    break_start = Column(Time, nullable=True, comment="休息开始")
    break_end = Column(Time, nullable=True, comment="休息结束")
    flex_start_from = Column(Time, nullable=True, comment="弹性上班窗口起")
    flex_start_to = Column(Time, nullable=True, comment="弹性上班窗口止")
    core_start = Column(Time, nullable=True, comment="核心工作时段起")
    core_end = Column(Time, nullable=True, comment="核心工作时段止")
    min_work_hours = Column(Numeric(4, 2), nullable=True, comment="弹性模式最低工时")
    is_default = Column(Boolean, default=False, comment="默认班次")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class AttendanceSchedule(Base):
    """排班表"""
    __tablename__ = "tn_attendance_schedules"
    __table_args__ = (
        UniqueConstraint("user_id", "work_date", name="uq_schedule_user_date"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id = Column(Integer, ForeignKey("tn_tenants.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("tn_users.id"), nullable=False)
    shift_id = Column(Integer, ForeignKey("tn_attendance_shifts.id"), nullable=False)
    work_date = Column(Date, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User", backref="attendance_schedules")
    shift = relationship("AttendanceShift", backref="schedules")


class AttendanceRecord(Base):
    """打卡记录"""
    __tablename__ = "tn_attendance_records"
    __table_args__ = (
        UniqueConstraint("user_id", "work_date", name="uq_record_user_date"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id = Column(Integer, ForeignKey("tn_tenants.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("tn_users.id"), nullable=False)
    work_date = Column(Date, nullable=False)
    shift_id = Column(Integer, ForeignKey("tn_attendance_shifts.id"), nullable=True)

    # 签到
    punch_in_time = Column(DateTime, nullable=True)
    punch_in_lat = Column(Numeric(10, 7), nullable=True)
    punch_in_lng = Column(Numeric(10, 7), nullable=True)
    punch_in_address = Column(String(500), nullable=True)
    punch_in_wifi = Column(String(100), nullable=True)
    punch_in_location_id = Column(Integer, ForeignKey("tn_attendance_locations.id"), nullable=True)
    punch_in_status = Column(
        Enum("normal", "late", "no_wifi", "out_of_range", "missing", name="punch_in_status_type"),
        nullable=True,
    )

    # 签退
    punch_out_time = Column(DateTime, nullable=True)
    punch_out_lat = Column(Numeric(10, 7), nullable=True)
    punch_out_lng = Column(Numeric(10, 7), nullable=True)
    punch_out_address = Column(String(500), nullable=True)
    punch_out_wifi = Column(String(100), nullable=True)
    punch_out_location_id = Column(Integer, ForeignKey("tn_attendance_locations.id"), nullable=True)
    punch_out_status = Column(
        Enum("normal", "early_leave", "no_wifi", "out_of_range", "missing", name="punch_out_status_type"),
        nullable=True,
    )

    work_hours = Column(Numeric(4, 2), nullable=True, comment="计算工时")
    status = Column(
        Enum("normal", "late", "early_leave", "late_and_early", "absent", "incomplete", name="attendance_status_type"),
        default="incomplete",
        comment="整体状态",
    )
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    user = relationship("User", backref="attendance_records")
    shift = relationship("AttendanceShift")
    punch_in_location = relationship("AttendanceLocation", foreign_keys=[punch_in_location_id])
    punch_out_location = relationship("AttendanceLocation", foreign_keys=[punch_out_location_id])
