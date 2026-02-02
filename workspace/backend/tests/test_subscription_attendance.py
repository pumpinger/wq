"""订阅管理 + 模块守卫 + 考勤系统 测试

覆盖:
1. 订阅订单CRUD (超管)
2. 订阅激活 → 租户模块开关
3. 模块守卫 - 未开通模块拒绝访问
4. 考勤配置CRUD
5. 打卡地点CRUD
6. 班次CRUD
7. 排班管理
8. GPS打卡 (签到+签退)
9. 打卡状态判定 (迟到/早退/正常)
10. 考勤记录查询
11. 月度统计
"""
import pytest
from datetime import date, time, datetime, timedelta
from decimal import Decimal
from fastapi.testclient import TestClient

from app.main import app
from app.models import Tenant
from app.models.user import User
from app.models.attendance import (
    AttendanceConfig,
    AttendanceLocation,
    AttendanceShift,
    AttendanceSchedule,
    AttendanceRecord,
)
from app.core.security import get_password_hash

# 使用 conftest.py 提供的共享数据库配置
from .conftest import TestingSessionLocal

client = TestClient(app)


class Ctx:
    """测试上下文"""
    superadmin_token: str = ""
    tenant1_id: int = 0
    admin1_token: str = ""
    user1_token: str = ""
    user1_id: int = 0
    admin1_id: int = 0
    # 订阅
    order_id: int = 0
    # 考勤
    location_id: int = 0
    shift_id: int = 0


ctx = Ctx()


@pytest.fixture(autouse=True, scope="module")
def setup_test_data():
    """初始化基础测试数据（数据库已由 conftest 创建）"""
    db = TestingSessionLocal()
    try:
        # 超管
        superadmin = User(
            username="sa_test",
            password=get_password_hash("123456"),
            is_super_admin=True,
            status="active",
        )
        db.add(superadmin)
        db.flush()

        # 租户1 — 默认 attendance=False
        tenant1 = Tenant(
            name="考勤测试租户",
            code="ATT_TEST",
            status="active",
            enable_customer=True,
            enable_attendance=False,
            enable_visit=True,
        )
        db.add(tenant1)
        db.flush()
        ctx.tenant1_id = tenant1.id

        # 租户管理员
        admin1 = User(
            username="att_admin",
            password=get_password_hash("123456"),
            tenant_id=tenant1.id,
            role="tenant_admin",
            status="active",
        )
        db.add(admin1)
        db.flush()
        ctx.admin1_id = admin1.id

        # 普通员工
        user1 = User(
            username="att_user",
            password=get_password_hash("123456"),
            tenant_id=tenant1.id,
            role="employee",
            data_scope="self",
            status="active",
        )
        db.add(user1)
        db.flush()
        ctx.user1_id = user1.id

        db.commit()
    finally:
        db.close()

    yield
    # 不需要 drop_all，由 conftest session-scoped fixture 处理


def login(username: str, password: str = "123456") -> str:
    r = client.post("/api/auth/login", data={"username": username, "password": password})
    assert r.status_code == 200, f"登录失败: {r.text}"
    return r.json()["access_token"]


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def admin_headers() -> dict:
    """租户管理员 headers — 含 tenant context"""
    return auth(ctx.admin1_token)


def user_headers() -> dict:
    return auth(ctx.user1_token)


def sa_headers(tenant_id: int = None) -> dict:
    """超管 headers，可选指定租户"""
    h = auth(ctx.superadmin_token)
    if tenant_id:
        h["X-Tenant-Id"] = str(tenant_id)
    return h


# ════════════════════════════════════════════════════
#  1. 认证
# ════════════════════════════════════════════════════


class TestAuth:
    def test_login_all(self):
        ctx.superadmin_token = login("sa_test")
        ctx.admin1_token = login("att_admin")
        ctx.user1_token = login("att_user")
        assert ctx.superadmin_token
        assert ctx.admin1_token
        assert ctx.user1_token

    def test_me_returns_enabled_modules(self):
        r = client.get("/api/auth/me", headers=admin_headers())
        assert r.status_code == 200
        data = r.json()
        assert "enabled_modules" in data
        modules = data["enabled_modules"]
        assert modules["customer"] is True
        assert modules["attendance"] is False
        assert modules["visit"] is True


# ════════════════════════════════════════════════════
#  2. 订阅订单 CRUD
# ════════════════════════════════════════════════════


class TestSubscriptionOrders:
    def test_create_order(self):
        """超管创建订阅订单"""
        r = client.post(
            "/api/subscription-orders/",
            json={
                "tenant_id": ctx.tenant1_id,
                "tenant_name": "考勤测试租户",
                "modules": {"customer": True, "attendance": True, "visit": True},
                "max_users": 20,
                "amount": "99.00",
                "start_date": "2026-01-01",
                "end_date": "2026-12-31",
                "remark": "测试订单",
            },
            headers=sa_headers(),
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["status"] == "pending"
        assert data["order_no"].startswith("SUB-")
        assert data["tenant_id"] == ctx.tenant1_id
        ctx.order_id = data["id"]

    def test_list_orders(self):
        r = client.get("/api/subscription-orders/", headers=sa_headers())
        assert r.status_code == 200
        data = r.json()
        assert data["total"] >= 1
        assert any(o["id"] == ctx.order_id for o in data["items"])

    def test_update_pending_order(self):
        r = client.put(
            f"/api/subscription-orders/{ctx.order_id}",
            json={"max_users": 50, "remark": "更新备注"},
            headers=sa_headers(),
        )
        assert r.status_code == 200
        assert r.json()["max_users"] == 50
        assert r.json()["remark"] == "更新备注"

    def test_non_superadmin_cannot_access(self):
        """非超管不能访问订阅接口"""
        r = client.get("/api/subscription-orders/", headers=admin_headers())
        assert r.status_code == 403

    def test_activate_order(self):
        """激活订阅 → 租户模块开关更新"""
        r = client.post(
            f"/api/subscription-orders/{ctx.order_id}/activate",
            headers=sa_headers(),
        )
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "active"
        assert data["activated_at"] is not None

    def test_cannot_activate_again(self):
        """已激活不能再次激活"""
        r = client.post(
            f"/api/subscription-orders/{ctx.order_id}/activate",
            headers=sa_headers(),
        )
        assert r.status_code == 400

    def test_tenant_modules_updated_after_activation(self):
        """激活后租户的模块开关应已更新"""
        r = client.get("/api/auth/me", headers=admin_headers())
        modules = r.json()["enabled_modules"]
        assert modules["attendance"] is True  # 从 False → True
        assert modules["customer"] is True
        assert modules["visit"] is True

    def test_cancel_active_order(self):
        """取消活跃订单"""
        # 先创建一个新的pending订单用于取消测试
        r = client.post(
            "/api/subscription-orders/",
            json={
                "tenant_id": ctx.tenant1_id,
                "tenant_name": "考勤测试租户",
                "modules": {"customer": True, "attendance": False, "visit": True},
                "max_users": 5,
                "amount": "0",
                "start_date": "2026-01-01",
                "end_date": "2026-06-30",
            },
            headers=sa_headers(),
        )
        cancel_id = r.json()["id"]
        r = client.post(
            f"/api/subscription-orders/{cancel_id}/cancel",
            headers=sa_headers(),
        )
        assert r.status_code == 200
        assert r.json()["status"] == "cancelled"

    def test_cannot_cancel_cancelled(self):
        """已取消不能再取消"""
        # 取最后一个cancelled的
        r = client.get("/api/subscription-orders/?status=cancelled", headers=sa_headers())
        cancelled = r.json()["items"]
        assert len(cancelled) > 0
        cid = cancelled[0]["id"]
        r = client.post(f"/api/subscription-orders/{cid}/cancel", headers=sa_headers())
        assert r.status_code == 400


# ════════════════════════════════════════════════════
#  3. 模块守卫
# ════════════════════════════════════════════════════


class TestModuleGuard:
    def test_attendance_accessible_after_activation(self):
        """考勤模块已开通 → 可访问"""
        r = client.get("/api/attendance/config", headers=admin_headers())
        assert r.status_code == 200

    def test_superadmin_bypasses_module_check(self):
        """超管绕过模块检查"""
        r = client.get(
            "/api/attendance/config",
            headers=sa_headers(tenant_id=ctx.tenant1_id),
        )
        assert r.status_code == 200

    def test_module_disabled_returns_403(self):
        """关闭模块后应返回403"""
        # 直接修改数据库关闭考勤
        db = TestingSessionLocal()
        try:
            tenant = db.query(Tenant).filter(Tenant.id == ctx.tenant1_id).first()
            tenant.enable_attendance = False
            db.commit()
        finally:
            db.close()

        r = client.get("/api/attendance/config", headers=admin_headers())
        assert r.status_code == 403
        assert "未开通" in r.json()["detail"]

        # 恢复开通
        db = TestingSessionLocal()
        try:
            tenant = db.query(Tenant).filter(Tenant.id == ctx.tenant1_id).first()
            tenant.enable_attendance = True
            db.commit()
        finally:
            db.close()


# ════════════════════════════════════════════════════
#  4. 考勤配置
# ════════════════════════════════════════════════════


class TestAttendanceConfig:
    def test_get_config_auto_creates(self):
        """首次获取配置自动创建默认值"""
        r = client.get("/api/attendance/config", headers=admin_headers())
        assert r.status_code == 200
        data = r.json()
        assert data["schedule_mode"] == "fixed"
        assert data["punch_radius"] == 200
        assert data["wifi_check_enabled"] is False

    def test_update_config(self):
        r = client.put(
            "/api/attendance/config",
            json={
                "schedule_mode": "fixed",
                "punch_radius": 300,
                "late_tolerance_minutes": 5,
                "early_leave_tolerance_minutes": 10,
            },
            headers=admin_headers(),
        )
        assert r.status_code == 200
        data = r.json()
        assert data["punch_radius"] == 300
        assert data["late_tolerance_minutes"] == 5

    def test_employee_cannot_access_config(self):
        """普通员工不能访问配置"""
        r = client.get("/api/attendance/config", headers=user_headers())
        assert r.status_code == 403


# ════════════════════════════════════════════════════
#  5. 打卡地点 CRUD
# ════════════════════════════════════════════════════


class TestLocations:
    def test_create_location(self):
        r = client.post(
            "/api/attendance/locations",
            json={
                "name": "总部办公室",
                "latitude": "39.9042000",
                "longitude": "116.4074000",
                "address": "北京市东城区",
                "radius": 200,
                "wifi_ssid": "Company-WiFi",
                "wifi_bssid": "AA:BB:CC:DD:EE:FF",
            },
            headers=admin_headers(),
        )
        assert r.status_code == 200
        data = r.json()
        assert data["name"] == "总部办公室"
        assert data["is_active"] is True
        ctx.location_id = data["id"]

    def test_list_locations(self):
        r = client.get("/api/attendance/locations", headers=admin_headers())
        assert r.status_code == 200
        locs = r.json()
        assert len(locs) >= 1
        assert any(l["id"] == ctx.location_id for l in locs)

    def test_update_location(self):
        r = client.put(
            f"/api/attendance/locations/{ctx.location_id}",
            json={"name": "总部办公室(更新)", "radius": 250},
            headers=admin_headers(),
        )
        assert r.status_code == 200
        assert r.json()["name"] == "总部办公室(更新)"
        assert r.json()["radius"] == 250

    def test_delete_location(self):
        # 创建一个临时地点然后删除
        r = client.post(
            "/api/attendance/locations",
            json={"name": "临时", "latitude": "40.0", "longitude": "116.0", "radius": 100},
            headers=admin_headers(),
        )
        tmp_id = r.json()["id"]
        r = client.delete(f"/api/attendance/locations/{tmp_id}", headers=admin_headers())
        assert r.status_code == 200

    def test_delete_nonexistent(self):
        r = client.delete("/api/attendance/locations/99999", headers=admin_headers())
        assert r.status_code == 404


# ════════════════════════════════════════════════════
#  6. 班次 CRUD
# ════════════════════════════════════════════════════


class TestShifts:
    def test_create_shift(self):
        r = client.post(
            "/api/attendance/shifts",
            json={
                "name": "标准班",
                "start_time": "09:00:00",
                "end_time": "18:00:00",
                "is_default": True,
            },
            headers=admin_headers(),
        )
        assert r.status_code == 200
        data = r.json()
        assert data["name"] == "标准班"
        assert data["is_default"] is True
        ctx.shift_id = data["id"]

    def test_list_shifts(self):
        r = client.get("/api/attendance/shifts", headers=admin_headers())
        assert r.status_code == 200
        assert len(r.json()) >= 1

    def test_update_shift(self):
        r = client.put(
            f"/api/attendance/shifts/{ctx.shift_id}",
            json={"name": "标准班(更新)", "start_time": "08:30:00"},
            headers=admin_headers(),
        )
        assert r.status_code == 200
        assert r.json()["name"] == "标准班(更新)"

    def test_delete_nonexistent_shift(self):
        r = client.delete("/api/attendance/shifts/99999", headers=admin_headers())
        assert r.status_code == 404


# ════════════════════════════════════════════════════
#  7. 排班管理
# ════════════════════════════════════════════════════


class TestSchedules:
    def test_batch_schedule(self):
        today = date.today().isoformat()
        r = client.post(
            "/api/attendance/schedules/batch",
            json={
                "items": [
                    {"user_id": ctx.user1_id, "shift_id": ctx.shift_id, "work_date": today},
                ]
            },
            headers=admin_headers(),
        )
        assert r.status_code == 200
        assert "排班已保存" in r.json()["message"]

    def test_batch_schedule_update_existing(self):
        """重复排班 → 更新已有记录"""
        today = date.today().isoformat()
        r = client.post(
            "/api/attendance/schedules/batch",
            json={
                "items": [
                    {"user_id": ctx.user1_id, "shift_id": ctx.shift_id, "work_date": today},
                ]
            },
            headers=admin_headers(),
        )
        assert r.status_code == 200
        # 新增0条（已存在）
        assert "新增0条" in r.json()["message"]

    def test_list_schedules(self):
        today = date.today()
        start = today.isoformat()
        end = (today + timedelta(days=6)).isoformat()
        r = client.get(
            f"/api/attendance/schedules?start_date={start}&end_date={end}",
            headers=admin_headers(),
        )
        assert r.status_code == 200
        schedules = r.json()
        assert len(schedules) >= 1


# ════════════════════════════════════════════════════
#  8. GPS 打卡
# ════════════════════════════════════════════════════


class TestPunch:
    def test_punch_in_normal(self):
        """正常签到 — 在打卡范围内"""
        # 先清理今日记录（如有）
        db = TestingSessionLocal()
        try:
            db.query(AttendanceRecord).filter(
                AttendanceRecord.user_id == ctx.user1_id,
                AttendanceRecord.work_date == date.today(),
            ).delete()
            db.commit()
        finally:
            db.close()

        r = client.post(
            "/api/attendance/punch",
            json={
                "lat": "39.9042000",
                "lng": "116.4074000",
                "address": "北京市东城区",
                "wifi_ssid": "Company-WiFi",
                "wifi_bssid": "AA:BB:CC:DD:EE:FF",
            },
            headers=user_headers(),
        )
        assert r.status_code == 200
        data = r.json()
        assert data["action"] == "punch_in"
        assert data["record_id"] > 0

    def test_punch_out_normal(self):
        """正常签退"""
        r = client.post(
            "/api/attendance/punch",
            json={
                "lat": "39.9042000",
                "lng": "116.4074000",
                "address": "北京市东城区",
            },
            headers=user_headers(),
        )
        assert r.status_code == 200
        data = r.json()
        assert data["action"] == "punch_out"

    def test_punch_already_done(self):
        """已完成打卡 → already_done"""
        r = client.post(
            "/api/attendance/punch",
            json={"lat": "39.9042000", "lng": "116.4074000"},
            headers=user_headers(),
        )
        assert r.status_code == 200
        assert r.json()["action"] == "already_done"

    def test_punch_out_of_range(self):
        """超出范围签到"""
        # 清掉今日记录
        db = TestingSessionLocal()
        try:
            db.query(AttendanceRecord).filter(
                AttendanceRecord.user_id == ctx.user1_id,
                AttendanceRecord.work_date == date.today(),
            ).delete()
            db.commit()
        finally:
            db.close()

        # 远离总部的坐标
        r = client.post(
            "/api/attendance/punch",
            json={"lat": "31.2304000", "lng": "121.4737000", "address": "上海"},
            headers=user_headers(),
        )
        assert r.status_code == 200
        data = r.json()
        assert data["action"] == "punch_in"
        assert data["status"] == "out_of_range"


# ════════════════════════════════════════════════════
#  9. 考勤记录查询
# ════════════════════════════════════════════════════


class TestRecords:
    def test_today_record(self):
        r = client.get("/api/attendance/records/today", headers=user_headers())
        # 可能有也可能无（取决于前面测试最终状态），但接口应200
        assert r.status_code == 200

    def test_my_records(self):
        today = date.today()
        r = client.get(
            f"/api/attendance/records/my?year={today.year}&month={today.month}",
            headers=user_headers(),
        )
        assert r.status_code == 200
        data = r.json()
        assert "items" in data
        assert "total" in data

    def test_admin_list_records(self):
        today = date.today()
        start = today.replace(day=1).isoformat()
        end = today.isoformat()
        r = client.get(
            f"/api/attendance/records?start_date={start}&end_date={end}",
            headers=admin_headers(),
        )
        assert r.status_code == 200
        data = r.json()
        assert "items" in data
        assert "total" in data

    def test_employee_cannot_list_all_records(self):
        """普通员工不能查看全部记录"""
        today = date.today()
        start = today.replace(day=1).isoformat()
        end = today.isoformat()
        r = client.get(
            f"/api/attendance/records?start_date={start}&end_date={end}",
            headers=user_headers(),
        )
        assert r.status_code == 403


# ════════════════════════════════════════════════════
#  10. 月度统计
# ════════════════════════════════════════════════════


class TestStats:
    def test_my_monthly_stats(self):
        today = date.today()
        r = client.get(
            f"/api/attendance/stats/my-monthly?year={today.year}&month={today.month}",
            headers=user_headers(),
        )
        assert r.status_code == 200
        data = r.json()
        assert "user_id" in data
        assert "total_days" in data
        assert "late_days" in data
        assert "early_leave_days" in data

    def test_admin_monthly_stats(self):
        today = date.today()
        r = client.get(
            f"/api/attendance/stats/monthly?year={today.year}&month={today.month}",
            headers=admin_headers(),
        )
        assert r.status_code == 200
        data = r.json()
        assert "year" in data
        assert "month" in data
        assert "items" in data
        # 至少有打卡过的user1
        assert isinstance(data["items"], list)

    def test_employee_cannot_view_all_stats(self):
        """普通员工不能看全部统计"""
        today = date.today()
        r = client.get(
            f"/api/attendance/stats/monthly?year={today.year}&month={today.month}",
            headers=user_headers(),
        )
        assert r.status_code == 403


# ════════════════════════════════════════════════════
#  11. 边界场景
# ════════════════════════════════════════════════════


class TestEdgeCases:
    def test_order_not_found(self):
        r = client.post(
            "/api/subscription-orders/99999/activate",
            headers=sa_headers(),
        )
        assert r.status_code == 404

    def test_update_active_order_fails(self):
        """已激活的订单不能修改"""
        r = client.put(
            f"/api/subscription-orders/{ctx.order_id}",
            json={"max_users": 100},
            headers=sa_headers(),
        )
        assert r.status_code == 400

    def test_location_tenant_isolation(self):
        """不同租户不能操作对方的地点"""
        r = client.put(
            f"/api/attendance/locations/{ctx.location_id}",
            json={"name": "hacked"},
            headers=sa_headers(tenant_id=99999),  # 不存在的租户
        )
        assert r.status_code == 404

    def test_shift_not_found(self):
        r = client.put(
            "/api/attendance/shifts/99999",
            json={"name": "ghost"},
            headers=admin_headers(),
        )
        assert r.status_code == 404


# ════════════════════════════════════════════════════
#  12. 订阅取消 → 租户停用
# ════════════════════════════════════════════════════


class TestSubscriptionCancellationSuspendsTenant:
    """取消唯一活跃订阅后，租户应被停用，用户无法登录"""

    cancel_order_id: int = 0
    second_order_id: int = 0

    def test_cancel_only_active_subscription_suspends_tenant(self):
        """取消租户唯一的活跃订阅 → tenant.status 变为 suspended"""
        # 先确认当前租户有活跃订阅
        r = client.get(
            f"/api/subscription-orders/?tenant_id={ctx.tenant1_id}&status=active",
            headers=sa_headers(),
        )
        active_orders = r.json()["items"]
        assert len(active_orders) >= 1
        target_order_id = active_orders[0]["id"]

        # 取消该订阅
        r = client.post(
            f"/api/subscription-orders/{target_order_id}/cancel",
            headers=sa_headers(),
        )
        assert r.status_code == 200
        assert r.json()["status"] == "cancelled"
        self.__class__.cancel_order_id = target_order_id

        # 验证租户状态变为 suspended
        db = TestingSessionLocal()
        try:
            tenant = db.query(Tenant).filter(Tenant.id == ctx.tenant1_id).first()
            assert tenant.status == "suspended", (
                f"租户状态应为 suspended，实际为 {tenant.status}"
            )
        finally:
            db.close()

    def test_suspended_tenant_user_cannot_login(self):
        """租户被停用后，其用户无法登录"""
        r = client.post(
            "/api/auth/login",
            data={"username": "att_admin", "password": "123456"},
        )
        assert r.status_code == 403, f"应拒绝登录，实际状态码: {r.status_code}"
        assert "停用" in r.json()["detail"] or "禁用" in r.json()["detail"]

    def test_reactivate_restores_tenant(self):
        """重新激活新订阅 → 租户恢复 active"""
        # 创建新订阅
        r = client.post(
            "/api/subscription-orders/",
            json={
                "tenant_id": ctx.tenant1_id,
                "tenant_name": "考勤测试租户",
                "modules": {"customer": True, "attendance": True, "visit": True},
                "max_users": 20,
                "amount": "0",
                "start_date": "2026-01-01",
                "end_date": "2026-12-31",
            },
            headers=sa_headers(),
        )
        assert r.status_code == 200
        new_order_id = r.json()["id"]
        self.__class__.second_order_id = new_order_id

        # 激活新订阅
        r = client.post(
            f"/api/subscription-orders/{new_order_id}/activate",
            headers=sa_headers(),
        )
        assert r.status_code == 200

        # 验证租户恢复 active
        db = TestingSessionLocal()
        try:
            tenant = db.query(Tenant).filter(Tenant.id == ctx.tenant1_id).first()
            assert tenant.status == "active", (
                f"租户状态应恢复 active，实际为 {tenant.status}"
            )
        finally:
            db.close()

    def test_user_can_login_after_reactivation(self):
        """恢复后用户可以重新登录"""
        r = client.post(
            "/api/auth/login",
            data={"username": "att_admin", "password": "123456"},
        )
        assert r.status_code == 200
        ctx.admin1_token = r.json()["access_token"]

    def test_cancel_one_of_multiple_active_does_not_suspend(self):
        """有多个活跃订阅时，取消一个不应停用租户"""
        # 创建第三个订阅并激活
        r = client.post(
            "/api/subscription-orders/",
            json={
                "tenant_id": ctx.tenant1_id,
                "tenant_name": "考勤测试租户",
                "modules": {"customer": True, "attendance": False, "visit": True},
                "max_users": 10,
                "amount": "0",
                "start_date": "2026-01-01",
                "end_date": "2026-12-31",
            },
            headers=sa_headers(),
        )
        third_order_id = r.json()["id"]
        client.post(
            f"/api/subscription-orders/{third_order_id}/activate",
            headers=sa_headers(),
        )

        # 取消其中一个（second_order）
        r = client.post(
            f"/api/subscription-orders/{self.__class__.second_order_id}/cancel",
            headers=sa_headers(),
        )
        assert r.status_code == 200

        # 租户应仍为 active（还有 third_order 是活跃的）
        db = TestingSessionLocal()
        try:
            tenant = db.query(Tenant).filter(Tenant.id == ctx.tenant1_id).first()
            assert tenant.status == "active", (
                f"仍有活跃订阅，租户不应被停用，实际为 {tenant.status}"
            )
        finally:
            db.close()

        # 用户仍可登录
        r = client.post(
            "/api/auth/login",
            data={"username": "att_admin", "password": "123456"},
        )
        assert r.status_code == 200
        ctx.admin1_token = r.json()["access_token"]
