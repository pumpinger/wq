"""
考勤 Schema
"""
from typing import Optional
from datetime import date, time, datetime
from decimal import Decimal
from pydantic import BaseModel


# ── 考勤配置 ──
class AttendanceConfigUpdate(BaseModel):
    schedule_mode: Optional[str] = None  # fixed / rotating / flex
    punch_radius: Optional[int] = None
    wifi_check_enabled: Optional[bool] = None
    late_tolerance_minutes: Optional[int] = None
    early_leave_tolerance_minutes: Optional[int] = None


class AttendanceConfigResponse(BaseModel):
    id: int
    tenant_id: int
    schedule_mode: str
    punch_radius: int
    wifi_check_enabled: bool
    late_tolerance_minutes: int
    early_leave_tolerance_minutes: int

    class Config:
        from_attributes = True


# ── 打卡地点 ──
class LocationCreate(BaseModel):
    name: str
    latitude: Decimal
    longitude: Decimal
    address: Optional[str] = None
    radius: int = 200
    wifi_ssid: Optional[str] = None
    wifi_bssid: Optional[str] = None


class LocationUpdate(BaseModel):
    name: Optional[str] = None
    latitude: Optional[Decimal] = None
    longitude: Optional[Decimal] = None
    address: Optional[str] = None
    radius: Optional[int] = None
    wifi_ssid: Optional[str] = None
    wifi_bssid: Optional[str] = None
    is_active: Optional[bool] = None


class LocationResponse(BaseModel):
    id: int
    tenant_id: int
    name: str
    latitude: Decimal
    longitude: Decimal
    address: Optional[str] = None
    radius: int
    wifi_ssid: Optional[str] = None
    wifi_bssid: Optional[str] = None
    is_active: bool

    class Config:
        from_attributes = True


# ── 班次 ──
class ShiftCreate(BaseModel):
    name: str
    start_time: time
    end_time: time
    break_start: Optional[time] = None
    break_end: Optional[time] = None
    flex_start_from: Optional[time] = None
    flex_start_to: Optional[time] = None
    core_start: Optional[time] = None
    core_end: Optional[time] = None
    min_work_hours: Optional[Decimal] = None
    is_default: bool = False


class ShiftUpdate(BaseModel):
    name: Optional[str] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    break_start: Optional[time] = None
    break_end: Optional[time] = None
    flex_start_from: Optional[time] = None
    flex_start_to: Optional[time] = None
    core_start: Optional[time] = None
    core_end: Optional[time] = None
    min_work_hours: Optional[Decimal] = None
    is_default: Optional[bool] = None


class ShiftResponse(BaseModel):
    id: int
    tenant_id: int
    name: str
    start_time: time
    end_time: time
    break_start: Optional[time] = None
    break_end: Optional[time] = None
    flex_start_from: Optional[time] = None
    flex_start_to: Optional[time] = None
    core_start: Optional[time] = None
    core_end: Optional[time] = None
    min_work_hours: Optional[Decimal] = None
    is_default: bool

    class Config:
        from_attributes = True


# ── 排班 ──
class ScheduleItem(BaseModel):
    user_id: int
    shift_id: int
    work_date: date


class ScheduleBatchCreate(BaseModel):
    items: list[ScheduleItem]


class ScheduleResponse(BaseModel):
    id: int
    tenant_id: int
    user_id: int
    shift_id: int
    work_date: date
    user_name: Optional[str] = None
    shift_name: Optional[str] = None

    class Config:
        from_attributes = True


# ── 打卡 ──
class PunchRequest(BaseModel):
    lat: Decimal
    lng: Decimal
    address: Optional[str] = None
    wifi_ssid: Optional[str] = None
    wifi_bssid: Optional[str] = None


class PunchResponse(BaseModel):
    action: str  # punch_in / punch_out / already_done
    status: str  # normal / late / early_leave / out_of_range / no_wifi
    message: str
    record_id: int


# ── 打卡记录 ──
class RecordResponse(BaseModel):
    id: int
    tenant_id: int
    user_id: int
    user_name: Optional[str] = None
    work_date: date
    shift_id: Optional[int] = None
    shift_name: Optional[str] = None
    punch_in_time: Optional[datetime] = None
    punch_in_address: Optional[str] = None
    punch_in_status: Optional[str] = None
    punch_out_time: Optional[datetime] = None
    punch_out_address: Optional[str] = None
    punch_out_status: Optional[str] = None
    work_hours: Optional[Decimal] = None
    status: str

    class Config:
        from_attributes = True


class RecordListResponse(BaseModel):
    items: list[RecordResponse]
    total: int


# ── 统计 ──
class MonthlyStatsItem(BaseModel):
    user_id: int
    user_name: Optional[str] = None
    total_days: int = 0
    normal_days: int = 0
    late_days: int = 0
    early_leave_days: int = 0
    absent_days: int = 0
    total_work_hours: Decimal = Decimal("0")


class MonthlyStatsResponse(BaseModel):
    year: int
    month: int
    items: list[MonthlyStatsItem]
