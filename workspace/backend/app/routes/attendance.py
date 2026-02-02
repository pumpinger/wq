"""
考勤管理路由
"""
import math
from datetime import date, datetime, timedelta
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func as sql_func, extract, and_

from ..database import get_db
from ..models.attendance import (
    AttendanceConfig,
    AttendanceLocation,
    AttendanceShift,
    AttendanceSchedule,
    AttendanceRecord,
)
from ..models.user import User
from ..schemas.attendance import (
    AttendanceConfigUpdate,
    AttendanceConfigResponse,
    LocationCreate,
    LocationUpdate,
    LocationResponse,
    ShiftCreate,
    ShiftUpdate,
    ShiftResponse,
    ScheduleBatchCreate,
    ScheduleResponse,
    PunchRequest,
    PunchResponse,
    RecordResponse,
    RecordListResponse,
    MonthlyStatsItem,
    MonthlyStatsResponse,
)
from ..core.deps import (
    get_current_active_user,
    require_tenant_admin,
    require_tenant_context,
)
from ..core.module_guard import require_module

router = APIRouter(
    prefix="/attendance",
    tags=["考勤管理"],
    dependencies=[Depends(require_module("attendance"))],
)


# ────────────────────── helpers ──────────────────────


def _get_or_create_config(db: Session, tenant_id: int) -> AttendanceConfig:
    config = db.query(AttendanceConfig).filter(AttendanceConfig.tenant_id == tenant_id).first()
    if not config:
        config = AttendanceConfig(tenant_id=tenant_id)
        db.add(config)
        db.commit()
        db.refresh(config)
    return config


def _haversine(lat1, lng1, lat2, lng2) -> float:
    """两点之间的距离(米)"""
    R = 6371000
    lat1, lng1, lat2, lng2 = map(math.radians, [float(lat1), float(lng1), float(lat2), float(lng2)])
    dlat = lat2 - lat1
    dlng = lng2 - lng1
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


def _find_nearest_location(db: Session, tenant_id: int, lat, lng):
    """查找最近的打卡地点，返回 (location, distance)"""
    locations = (
        db.query(AttendanceLocation)
        .filter(AttendanceLocation.tenant_id == tenant_id, AttendanceLocation.is_active == True)
        .all()
    )
    best = None
    best_dist = float("inf")
    for loc in locations:
        dist = _haversine(lat, lng, loc.latitude, loc.longitude)
        if dist < best_dist:
            best_dist = dist
            best = loc
    return best, best_dist


def _resolve_shift(db: Session, tenant_id: int, user_id: int, work_date: date, config: AttendanceConfig):
    """根据排班模式获取用户当天的班次"""
    mode = config.schedule_mode or "fixed"

    if mode == "fixed":
        # 固定模式 → 用默认班次
        shift = (
            db.query(AttendanceShift)
            .filter(AttendanceShift.tenant_id == tenant_id, AttendanceShift.is_default == True)
            .first()
        )
        return shift

    elif mode == "rotating":
        # 轮班模式 → 查排班表
        sched = (
            db.query(AttendanceSchedule)
            .filter(
                AttendanceSchedule.user_id == user_id,
                AttendanceSchedule.work_date == work_date,
            )
            .first()
        )
        if sched:
            return db.query(AttendanceShift).filter(AttendanceShift.id == sched.shift_id).first()
        return None

    else:
        # 弹性模式 → 找弹性班次(有 flex_start_from)
        shift = (
            db.query(AttendanceShift)
            .filter(
                AttendanceShift.tenant_id == tenant_id,
                AttendanceShift.flex_start_from.isnot(None),
            )
            .first()
        )
        if not shift:
            shift = (
                db.query(AttendanceShift)
                .filter(AttendanceShift.tenant_id == tenant_id, AttendanceShift.is_default == True)
                .first()
            )
        return shift


# ────────────────────── 配置 ──────────────────────


@router.get("/config", response_model=AttendanceConfigResponse)
def get_config(
    tenant_id: int = Depends(require_tenant_context),
    db: Session = Depends(get_db),
    _user=Depends(require_tenant_admin),
):
    return _get_or_create_config(db, tenant_id)


@router.put("/config", response_model=AttendanceConfigResponse)
def update_config(
    data: AttendanceConfigUpdate,
    tenant_id: int = Depends(require_tenant_context),
    db: Session = Depends(get_db),
    _user=Depends(require_tenant_admin),
):
    config = _get_or_create_config(db, tenant_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(config, field, value)
    db.commit()
    db.refresh(config)
    return config


# ────────────────────── 打卡地点 CRUD ──────────────────────


@router.get("/locations", response_model=list[LocationResponse])
def list_locations(
    tenant_id: int = Depends(require_tenant_context),
    db: Session = Depends(get_db),
    _user=Depends(require_tenant_admin),
):
    return db.query(AttendanceLocation).filter(AttendanceLocation.tenant_id == tenant_id).all()


@router.post("/locations", response_model=LocationResponse)
def create_location(
    data: LocationCreate,
    tenant_id: int = Depends(require_tenant_context),
    db: Session = Depends(get_db),
    _user=Depends(require_tenant_admin),
):
    loc = AttendanceLocation(tenant_id=tenant_id, **data.model_dump())
    db.add(loc)
    db.commit()
    db.refresh(loc)
    return loc


@router.put("/locations/{loc_id}", response_model=LocationResponse)
def update_location(
    loc_id: int,
    data: LocationUpdate,
    tenant_id: int = Depends(require_tenant_context),
    db: Session = Depends(get_db),
    _user=Depends(require_tenant_admin),
):
    loc = db.query(AttendanceLocation).filter(
        AttendanceLocation.id == loc_id, AttendanceLocation.tenant_id == tenant_id
    ).first()
    if not loc:
        raise HTTPException(status_code=404, detail="地点不存在")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(loc, field, value)
    db.commit()
    db.refresh(loc)
    return loc


@router.delete("/locations/{loc_id}")
def delete_location(
    loc_id: int,
    tenant_id: int = Depends(require_tenant_context),
    db: Session = Depends(get_db),
    _user=Depends(require_tenant_admin),
):
    loc = db.query(AttendanceLocation).filter(
        AttendanceLocation.id == loc_id, AttendanceLocation.tenant_id == tenant_id
    ).first()
    if not loc:
        raise HTTPException(status_code=404, detail="地点不存在")
    db.delete(loc)
    db.commit()
    return {"message": "已删除"}


# ────────────────────── 班次 CRUD ──────────────────────


@router.get("/shifts", response_model=list[ShiftResponse])
def list_shifts(
    tenant_id: int = Depends(require_tenant_context),
    db: Session = Depends(get_db),
    _user=Depends(require_tenant_admin),
):
    return db.query(AttendanceShift).filter(AttendanceShift.tenant_id == tenant_id).all()


@router.post("/shifts", response_model=ShiftResponse)
def create_shift(
    data: ShiftCreate,
    tenant_id: int = Depends(require_tenant_context),
    db: Session = Depends(get_db),
    _user=Depends(require_tenant_admin),
):
    shift = AttendanceShift(tenant_id=tenant_id, **data.model_dump())
    db.add(shift)
    db.commit()
    db.refresh(shift)
    return shift


@router.put("/shifts/{shift_id}", response_model=ShiftResponse)
def update_shift(
    shift_id: int,
    data: ShiftUpdate,
    tenant_id: int = Depends(require_tenant_context),
    db: Session = Depends(get_db),
    _user=Depends(require_tenant_admin),
):
    shift = db.query(AttendanceShift).filter(
        AttendanceShift.id == shift_id, AttendanceShift.tenant_id == tenant_id
    ).first()
    if not shift:
        raise HTTPException(status_code=404, detail="班次不存在")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(shift, field, value)
    db.commit()
    db.refresh(shift)
    return shift


@router.delete("/shifts/{shift_id}")
def delete_shift(
    shift_id: int,
    tenant_id: int = Depends(require_tenant_context),
    db: Session = Depends(get_db),
    _user=Depends(require_tenant_admin),
):
    shift = db.query(AttendanceShift).filter(
        AttendanceShift.id == shift_id, AttendanceShift.tenant_id == tenant_id
    ).first()
    if not shift:
        raise HTTPException(status_code=404, detail="班次不存在")
    db.delete(shift)
    db.commit()
    return {"message": "已删除"}


# ────────────────────── 排班 ──────────────────────


@router.get("/schedules", response_model=list[ScheduleResponse])
def list_schedules(
    start_date: date = Query(...),
    end_date: date = Query(...),
    user_id: int = Query(None),
    tenant_id: int = Depends(require_tenant_context),
    db: Session = Depends(get_db),
    _user=Depends(require_tenant_admin),
):
    q = db.query(AttendanceSchedule).filter(
        AttendanceSchedule.tenant_id == tenant_id,
        AttendanceSchedule.work_date >= start_date,
        AttendanceSchedule.work_date <= end_date,
    )
    if user_id:
        q = q.filter(AttendanceSchedule.user_id == user_id)
    rows = q.all()
    result = []
    for s in rows:
        r = ScheduleResponse.model_validate(s)
        if s.user:
            r.user_name = s.user.real_name or s.user.username
        if s.shift:
            r.shift_name = s.shift.name
        result.append(r)
    return result


@router.post("/schedules/batch")
def batch_schedule(
    data: ScheduleBatchCreate,
    tenant_id: int = Depends(require_tenant_context),
    db: Session = Depends(get_db),
    _user=Depends(require_tenant_admin),
):
    created = 0
    for item in data.items:
        existing = db.query(AttendanceSchedule).filter(
            AttendanceSchedule.user_id == item.user_id,
            AttendanceSchedule.work_date == item.work_date,
        ).first()
        if existing:
            existing.shift_id = item.shift_id
        else:
            db.add(AttendanceSchedule(
                tenant_id=tenant_id,
                user_id=item.user_id,
                shift_id=item.shift_id,
                work_date=item.work_date,
            ))
            created += 1
    db.commit()
    return {"message": f"排班已保存，新增{created}条"}


# ────────────────────── 打卡 ──────────────────────


@router.post("/punch", response_model=PunchResponse)
def punch(
    data: PunchRequest,
    tenant_id: int = Depends(require_tenant_context),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """GPS+WiFi打卡"""
    today = date.today()
    now = datetime.now()
    config = _get_or_create_config(db, tenant_id)

    # 1. 获取班次
    shift = _resolve_shift(db, tenant_id, current_user.id, today, config)

    # 2. GPS 校验
    location, distance = _find_nearest_location(db, tenant_id, data.lat, data.lng)
    loc_radius = location.radius if location else config.punch_radius
    in_range = location is not None and distance <= loc_radius

    # 3. WiFi 校验
    wifi_ok = True
    if config.wifi_check_enabled and location and location.wifi_bssid:
        if not data.wifi_bssid or data.wifi_bssid.lower() != location.wifi_bssid.lower():
            wifi_ok = False

    # 4. 查找或创建记录
    record = db.query(AttendanceRecord).filter(
        AttendanceRecord.user_id == current_user.id,
        AttendanceRecord.work_date == today,
    ).first()

    if record and record.punch_in_time and record.punch_out_time:
        return PunchResponse(
            action="already_done",
            status="normal",
            message="今日已完成打卡",
            record_id=record.id,
        )

    if not record:
        record = AttendanceRecord(
            tenant_id=tenant_id,
            user_id=current_user.id,
            work_date=today,
            shift_id=shift.id if shift else None,
        )
        db.add(record)
        db.flush()

    if not record.punch_in_time:
        # ── 签到 ──
        punch_status = "normal"
        if not in_range:
            punch_status = "out_of_range"
        elif not wifi_ok:
            punch_status = "no_wifi"
        elif shift and shift.start_time:
            shift_start_dt = datetime.combine(today, shift.start_time)
            tolerance = timedelta(minutes=config.late_tolerance_minutes or 0)
            if now > shift_start_dt + tolerance:
                punch_status = "late"

        record.punch_in_time = now
        record.punch_in_lat = data.lat
        record.punch_in_lng = data.lng
        record.punch_in_address = data.address
        record.punch_in_wifi = data.wifi_ssid
        record.punch_in_location_id = location.id if location and in_range else None
        record.punch_in_status = punch_status
        record.status = "incomplete"

        db.commit()
        db.refresh(record)

        status_msg = {"normal": "签到成功", "late": "签到成功(迟到)", "out_of_range": "签到成功(不在范围内)", "no_wifi": "签到成功(WiFi不匹配)"}
        return PunchResponse(
            action="punch_in",
            status=punch_status,
            message=status_msg.get(punch_status, "签到成功"),
            record_id=record.id,
        )
    else:
        # ── 签退 ──
        punch_status = "normal"
        if not in_range:
            punch_status = "out_of_range"
        elif not wifi_ok:
            punch_status = "no_wifi"
        elif shift and shift.end_time:
            shift_end_dt = datetime.combine(today, shift.end_time)
            tolerance = timedelta(minutes=config.early_leave_tolerance_minutes or 0)
            if now < shift_end_dt - tolerance:
                punch_status = "early_leave"

        record.punch_out_time = now
        record.punch_out_lat = data.lat
        record.punch_out_lng = data.lng
        record.punch_out_address = data.address
        record.punch_out_wifi = data.wifi_ssid
        record.punch_out_location_id = location.id if location and in_range else None
        record.punch_out_status = punch_status

        # 算工时
        diff = (now - record.punch_in_time).total_seconds() / 3600
        record.work_hours = round(Decimal(str(diff)), 2)

        # 判定整体状态
        in_s = record.punch_in_status
        out_s = punch_status
        if in_s == "late" and out_s == "early_leave":
            record.status = "late_and_early"
        elif in_s == "late":
            record.status = "late"
        elif out_s == "early_leave":
            record.status = "early_leave"
        else:
            record.status = "normal"

        db.commit()
        db.refresh(record)

        status_msg = {"normal": "签退成功", "early_leave": "签退成功(早退)", "out_of_range": "签退成功(不在范围内)", "no_wifi": "签退成功(WiFi不匹配)"}
        return PunchResponse(
            action="punch_out",
            status=punch_status,
            message=status_msg.get(punch_status, "签退成功"),
            record_id=record.id,
        )


# ────────────────────── 记录查询 ──────────────────────


@router.get("/records/today", response_model=RecordResponse | None)
def today_record(
    tenant_id: int = Depends(require_tenant_context),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    record = db.query(AttendanceRecord).filter(
        AttendanceRecord.user_id == current_user.id,
        AttendanceRecord.work_date == date.today(),
    ).first()
    if not record:
        return None
    r = RecordResponse.model_validate(record)
    r.user_name = current_user.real_name or current_user.username
    if record.shift:
        r.shift_name = record.shift.name
    return r


@router.get("/records/my", response_model=RecordListResponse)
def my_records(
    year: int = Query(...),
    month: int = Query(...),
    tenant_id: int = Depends(require_tenant_context),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    start = date(year, month, 1)
    if month == 12:
        end = date(year + 1, 1, 1)
    else:
        end = date(year, month + 1, 1)
    q = db.query(AttendanceRecord).filter(
        AttendanceRecord.user_id == current_user.id,
        AttendanceRecord.work_date >= start,
        AttendanceRecord.work_date < end,
    ).order_by(AttendanceRecord.work_date)
    items = q.all()
    result = []
    for rec in items:
        r = RecordResponse.model_validate(rec)
        r.user_name = current_user.real_name or current_user.username
        if rec.shift:
            r.shift_name = rec.shift.name
        result.append(r)
    return RecordListResponse(items=result, total=len(result))


@router.get("/records", response_model=RecordListResponse)
def list_records(
    start_date: date = Query(...),
    end_date: date = Query(...),
    user_id: int = Query(None),
    status_filter: str = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    tenant_id: int = Depends(require_tenant_context),
    db: Session = Depends(get_db),
    _user=Depends(require_tenant_admin),
):
    q = db.query(AttendanceRecord).filter(
        AttendanceRecord.tenant_id == tenant_id,
        AttendanceRecord.work_date >= start_date,
        AttendanceRecord.work_date <= end_date,
    )
    if user_id:
        q = q.filter(AttendanceRecord.user_id == user_id)
    if status_filter:
        q = q.filter(AttendanceRecord.status == status_filter)
    total = q.count()
    rows = q.order_by(AttendanceRecord.work_date.desc()).offset((page - 1) * page_size).limit(page_size).all()
    result = []
    for rec in rows:
        r = RecordResponse.model_validate(rec)
        if rec.user:
            r.user_name = rec.user.real_name or rec.user.username
        if rec.shift:
            r.shift_name = rec.shift.name
        result.append(r)
    return RecordListResponse(items=result, total=total)


# ────────────────────── 统计 ──────────────────────


@router.get("/stats/monthly", response_model=MonthlyStatsResponse)
def monthly_stats(
    year: int = Query(...),
    month: int = Query(...),
    tenant_id: int = Depends(require_tenant_context),
    db: Session = Depends(get_db),
    _user=Depends(require_tenant_admin),
):
    start = date(year, month, 1)
    if month == 12:
        end = date(year + 1, 1, 1)
    else:
        end = date(year, month + 1, 1)

    records = db.query(AttendanceRecord).filter(
        AttendanceRecord.tenant_id == tenant_id,
        AttendanceRecord.work_date >= start,
        AttendanceRecord.work_date < end,
    ).all()

    user_map: dict[int, MonthlyStatsItem] = {}
    for rec in records:
        if rec.user_id not in user_map:
            u = rec.user
            user_map[rec.user_id] = MonthlyStatsItem(
                user_id=rec.user_id,
                user_name=u.real_name or u.username if u else str(rec.user_id),
            )
        s = user_map[rec.user_id]
        s.total_days += 1
        if rec.status == "normal":
            s.normal_days += 1
        elif rec.status == "late":
            s.late_days += 1
        elif rec.status == "early_leave":
            s.early_leave_days += 1
        elif rec.status == "late_and_early":
            s.late_days += 1
            s.early_leave_days += 1
        elif rec.status == "absent":
            s.absent_days += 1
        if rec.work_hours:
            s.total_work_hours += rec.work_hours

    return MonthlyStatsResponse(year=year, month=month, items=list(user_map.values()))


@router.get("/stats/my-monthly", response_model=MonthlyStatsItem)
def my_monthly_stats(
    year: int = Query(...),
    month: int = Query(...),
    tenant_id: int = Depends(require_tenant_context),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    start = date(year, month, 1)
    if month == 12:
        end = date(year + 1, 1, 1)
    else:
        end = date(year, month + 1, 1)

    records = db.query(AttendanceRecord).filter(
        AttendanceRecord.user_id == current_user.id,
        AttendanceRecord.work_date >= start,
        AttendanceRecord.work_date < end,
    ).all()

    item = MonthlyStatsItem(
        user_id=current_user.id,
        user_name=current_user.real_name or current_user.username,
    )
    for rec in records:
        item.total_days += 1
        if rec.status == "normal":
            item.normal_days += 1
        elif rec.status == "late":
            item.late_days += 1
        elif rec.status == "early_leave":
            item.early_leave_days += 1
        elif rec.status == "late_and_early":
            item.late_days += 1
            item.early_leave_days += 1
        elif rec.status == "absent":
            item.absent_days += 1
        if rec.work_hours:
            item.total_work_hours += rec.work_hours

    return item
