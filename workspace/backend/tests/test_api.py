"""API测试 - 完整测试套件

包含：
1. 认证测试
2. 字段定义测试
3. 模板测试
4. 客户CRUD测试
5. 租户隔离测试
6. 数据权限测试
7. 客户公海测试
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.database import Base, get_db
from app.models import Tenant, FieldDefinition, CustomerTemplate, TemplateField, Customer, CustomerFieldValue
from app.models.user import User
from app.models.customer_pool import CustomerPoolRecord
from app.core.security import get_password_hash

# 使用内存SQLite数据库进行测试
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


class TestContext:
    """测试上下文，存储登录后的token和创建的实体"""
    superadmin_token: str = ""
    tenant1_id: int = 0
    tenant2_id: int = 0
    admin1_token: str = ""
    admin2_token: str = ""
    user1_token: str = ""  # tenant1 的普通用户 (data_scope=self)
    user2_token: str = ""  # tenant1 的团队负责人 (data_scope=team)
    user3_token: str = ""  # tenant1 的全部权限用户 (data_scope=all)
    template1_id: int = 0
    field1_id: int = 0


ctx = TestContext()


@pytest.fixture(autouse=True, scope="module")
def setup_database():
    """初始化数据库和基础数据"""
    Base.metadata.create_all(bind=engine)

    db = TestingSessionLocal()
    try:
        # 创建超级管理员
        superadmin = User(
            username="superadmin",
            password=get_password_hash("123456"),
            is_super_admin=True,
            status="active"
        )
        db.add(superadmin)
        db.flush()

        # 创建租户1
        tenant1 = Tenant(name="测试租户1", code="TEST1", status="active")
        db.add(tenant1)
        db.flush()
        ctx.tenant1_id = tenant1.id

        # 创建租户2
        tenant2 = Tenant(name="测试租户2", code="TEST2", status="active")
        db.add(tenant2)
        db.flush()
        ctx.tenant2_id = tenant2.id

        # 创建租户1管理员
        admin1 = User(
            username="admin1",
            password=get_password_hash("123456"),
            tenant_id=tenant1.id,
            role="tenant_admin",
            status="active"
        )
        db.add(admin1)

        # 创建租户2管理员
        admin2 = User(
            username="admin2",
            password=get_password_hash("123456"),
            tenant_id=tenant2.id,
            role="tenant_admin",
            status="active"
        )
        db.add(admin2)
        db.flush()

        # 创建租户1普通用户（只看自己）
        user1 = User(
            username="user1",
            password=get_password_hash("123456"),
            tenant_id=tenant1.id,
            role="employee",
            data_scope="self",
            status="active"
        )
        db.add(user1)
        db.flush()

        # 创建租户1团队负责人（看自己+下属）
        user2 = User(
            username="user2",
            password=get_password_hash("123456"),
            tenant_id=tenant1.id,
            role="employee",
            data_scope="team",
            status="active"
        )
        db.add(user2)
        db.flush()

        # 设置 user1 的上级为 user2
        user1.manager_id = user2.id

        # 创建租户1全部权限用户
        user3 = User(
            username="user3",
            password=get_password_hash("123456"),
            tenant_id=tenant1.id,
            role="employee",
            data_scope="all",
            status="active"
        )
        db.add(user3)

        db.commit()
    finally:
        db.close()

    yield

    Base.metadata.drop_all(bind=engine)


def login(username: str, password: str) -> str:
    """登录并返回token"""
    response = client.post("/api/auth/login", data={
        "username": username,
        "password": password
    })
    assert response.status_code == 200, f"登录失败: {response.json()}"
    return response.json()["access_token"]


def auth_header(token: str) -> dict:
    """生成认证头"""
    return {"Authorization": f"Bearer {token}"}


class TestAuth:
    """认证测试"""

    def test_login_superadmin(self):
        """测试超管登录"""
        ctx.superadmin_token = login("superadmin", "123456")
        assert ctx.superadmin_token

    def test_login_admin1(self):
        """测试租户1管理员登录"""
        ctx.admin1_token = login("admin1", "123456")
        assert ctx.admin1_token

    def test_login_admin2(self):
        """测试租户2管理员登录"""
        ctx.admin2_token = login("admin2", "123456")
        assert ctx.admin2_token

    def test_login_users(self):
        """测试普通用户登录"""
        ctx.user1_token = login("user1", "123456")
        ctx.user2_token = login("user2", "123456")
        ctx.user3_token = login("user3", "123456")
        assert ctx.user1_token
        assert ctx.user2_token
        assert ctx.user3_token

    def test_login_wrong_password(self):
        """测试错误密码登录"""
        response = client.post("/api/auth/login", data={
            "username": "superadmin",
            "password": "wrong"
        })
        assert response.status_code == 401

    def test_get_me(self):
        """测试获取当前用户信息"""
        response = client.get("/api/auth/me", headers=auth_header(ctx.superadmin_token))
        assert response.status_code == 200
        assert response.json()["username"] == "superadmin"

    def test_unauthorized_access(self):
        """测试未授权访问"""
        response = client.get("/api/customers/")
        assert response.status_code == 401


class TestFieldDefinitions:
    """字段定义测试"""

    def test_create_field(self):
        """测试创建字段"""
        response = client.post(
            "/api/field-definitions/",
            json={
                "name": "测试字段",
                "field_key": "test_field",
                "field_type": "text",
                "is_system": False
            },
            headers=auth_header(ctx.admin1_token)
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "测试字段"
        ctx.field1_id = data["id"]

    def test_create_select_field(self):
        """测试创建单选字段"""
        response = client.post(
            "/api/field-definitions/",
            json={
                "name": "行业",
                "field_key": "industry",
                "field_type": "select",
                "options": ["制造业", "服务业", "零售业"]
            },
            headers=auth_header(ctx.admin1_token)
        )
        assert response.status_code == 200
        data = response.json()
        assert data["field_type"] == "select"
        assert len(data["options"]) == 3

    def test_list_fields(self):
        """测试获取字段列表"""
        response = client.get(
            "/api/field-definitions/",
            headers=auth_header(ctx.admin1_token)
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 2

    def test_duplicate_field_key(self):
        """测试重复字段键名"""
        response = client.post(
            "/api/field-definitions/",
            json={
                "name": "重复字段",
                "field_key": "test_field",  # 与之前创建的相同
                "field_type": "text"
            },
            headers=auth_header(ctx.admin1_token)
        )
        assert response.status_code == 400


class TestCustomerTemplates:
    """客户模板测试"""

    def test_create_template(self):
        """测试创建模板"""
        response = client.post(
            "/api/customer-templates/",
            json={
                "name": "测试模板",
                "description": "测试用模板",
                "is_default": True,
                "fields": []
            },
            headers=auth_header(ctx.admin1_token)
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "测试模板"
        ctx.template1_id = data["id"]

    def test_create_template_with_fields(self):
        """测试创建带字段的模板"""
        response = client.post(
            "/api/customer-templates/",
            json={
                "name": "带字段模板",
                "fields": [
                    {"field_id": ctx.field1_id, "is_required": True, "sort_order": 0}
                ]
            },
            headers=auth_header(ctx.admin1_token)
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["template_fields"]) == 1

    def test_list_templates(self):
        """测试获取模板列表"""
        response = client.get(
            "/api/customer-templates/",
            headers=auth_header(ctx.admin1_token)
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 2


class TestCustomerCRUD:
    """客户CRUD测试"""

    customer_id: int = 0

    def test_create_customer(self):
        """测试创建客户"""
        response = client.post(
            "/api/customers/",
            json={
                "name": "测试客户1",
                "address": "测试地址",
                "template_id": ctx.template1_id,
                "field_values": []
            },
            headers=auth_header(ctx.user1_token)
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "测试客户1"
        TestCustomerCRUD.customer_id = data["id"]

    def test_get_customer(self):
        """测试获取客户详情"""
        response = client.get(
            f"/api/customers/{TestCustomerCRUD.customer_id}",
            headers=auth_header(ctx.user1_token)
        )
        assert response.status_code == 200
        assert response.json()["name"] == "测试客户1"

    def test_update_customer(self):
        """测试更新客户"""
        response = client.put(
            f"/api/customers/{TestCustomerCRUD.customer_id}",
            json={"name": "更新后的名称"},
            headers=auth_header(ctx.user1_token)
        )
        assert response.status_code == 200
        assert response.json()["name"] == "更新后的名称"

    def test_list_customers(self):
        """测试获取客户列表"""
        response = client.get(
            "/api/customers/",
            headers=auth_header(ctx.user1_token)
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1

    def test_list_customers_with_filters(self):
        """测试带筛选条件的客户列表"""
        # 按关键词筛选
        response = client.get(
            "/api/customers/?keyword=更新",
            headers=auth_header(ctx.user1_token)
        )
        assert response.status_code == 200

        # 按模板筛选
        response = client.get(
            f"/api/customers/?template_id={ctx.template1_id}",
            headers=auth_header(ctx.user1_token)
        )
        assert response.status_code == 200


class TestTenantIsolation:
    """租户隔离测试"""

    def test_tenant1_create_customer(self):
        """租户1创建客户"""
        response = client.post(
            "/api/customers/",
            json={
                "name": "租户1客户",
                "template_id": ctx.template1_id,
                "field_values": []
            },
            headers=auth_header(ctx.admin1_token)
        )
        assert response.status_code == 200

    def test_tenant2_cannot_see_tenant1_customers(self):
        """租户2看不到租户1的客户"""
        # 先为租户2创建模板
        template_resp = client.post(
            "/api/customer-templates/",
            json={"name": "租户2模板", "fields": []},
            headers=auth_header(ctx.admin2_token)
        )
        template2_id = template_resp.json()["id"]

        # 租户2创建自己的客户
        client.post(
            "/api/customers/",
            json={
                "name": "租户2客户",
                "template_id": template2_id,
                "field_values": []
            },
            headers=auth_header(ctx.admin2_token)
        )

        # 租户2获取客户列表
        response = client.get(
            "/api/customers/",
            headers=auth_header(ctx.admin2_token)
        )
        assert response.status_code == 200
        customers = response.json()

        # 不应该看到租户1的客户
        for c in customers:
            assert "租户1" not in c["name"]


class TestDataScope:
    """数据权限测试"""

    user1_customer_id: int = 0
    user2_customer_id: int = 0
    admin_customer_id: int = 0

    def test_setup_customers(self):
        """创建测试客户"""
        # user1 创建自己的客户
        response = client.post(
            "/api/customers/",
            json={
                "name": "user1的客户",
                "template_id": ctx.template1_id,
                "field_values": []
            },
            headers=auth_header(ctx.user1_token)
        )
        TestDataScope.user1_customer_id = response.json()["id"]

        # user2 创建自己的客户
        response = client.post(
            "/api/customers/",
            json={
                "name": "user2的客户",
                "template_id": ctx.template1_id,
                "field_values": []
            },
            headers=auth_header(ctx.user2_token)
        )
        TestDataScope.user2_customer_id = response.json()["id"]

        # admin1 创建客户
        response = client.post(
            "/api/customers/",
            json={
                "name": "admin的客户",
                "template_id": ctx.template1_id,
                "field_values": []
            },
            headers=auth_header(ctx.admin1_token)
        )
        TestDataScope.admin_customer_id = response.json()["id"]

    def test_user1_sees_only_own_customers(self):
        """user1 (data_scope=self) 只能看到自己的客户"""
        response = client.get(
            "/api/customers/",
            headers=auth_header(ctx.user1_token)
        )
        customers = response.json()
        customer_names = [c["name"] for c in customers]

        assert "user1的客户" in customer_names
        assert "user2的客户" not in customer_names
        assert "admin的客户" not in customer_names

    def test_user2_sees_team_customers(self):
        """user2 (data_scope=team) 能看到自己和下属的客户"""
        response = client.get(
            "/api/customers/",
            headers=auth_header(ctx.user2_token)
        )
        customers = response.json()
        customer_names = [c["name"] for c in customers]

        # user2 能看到自己的客户
        assert "user2的客户" in customer_names
        # user2 能看到下属 user1 的客户
        assert "user1的客户" in customer_names
        # user2 看不到 admin 的客户
        assert "admin的客户" not in customer_names

    def test_user3_sees_all_customers(self):
        """user3 (data_scope=all) 能看到租户内所有客户"""
        response = client.get(
            "/api/customers/",
            headers=auth_header(ctx.user3_token)
        )
        customers = response.json()
        customer_names = [c["name"] for c in customers]

        assert "user1的客户" in customer_names
        assert "user2的客户" in customer_names
        assert "admin的客户" in customer_names

    def test_admin_sees_all_customers(self):
        """租户管理员能看到所有客户"""
        response = client.get(
            "/api/customers/",
            headers=auth_header(ctx.admin1_token)
        )
        customers = response.json()
        customer_names = [c["name"] for c in customers]

        assert "user1的客户" in customer_names
        assert "user2的客户" in customer_names
        assert "admin的客户" in customer_names


class TestCustomerPool:
    """客户公海测试"""

    pool_customer_id: int = 0

    def test_create_customer_for_pool(self):
        """创建用于公海测试的客户"""
        response = client.post(
            "/api/customers/",
            json={
                "name": "待释放客户",
                "template_id": ctx.template1_id,
                "field_values": []
            },
            headers=auth_header(ctx.user1_token)
        )
        TestCustomerPool.pool_customer_id = response.json()["id"]

    def test_release_customer_to_pool(self):
        """测试释放客户到公海"""
        response = client.post(
            f"/api/customers/pool/{TestCustomerPool.pool_customer_id}/release",
            json={"reason": "测试释放"},
            headers=auth_header(ctx.user1_token)
        )
        assert response.status_code == 200

    def test_list_pool_customers(self):
        """测试获取公海客户列表"""
        response = client.get(
            "/api/customers/pool/",
            headers=auth_header(ctx.user1_token)
        )
        assert response.status_code == 200
        customers = response.json()
        pool_names = [c["name"] for c in customers]
        assert "待释放客户" in pool_names

    def test_claim_customer_from_pool(self):
        """测试从公海认领客户"""
        response = client.post(
            f"/api/customers/pool/{TestCustomerPool.pool_customer_id}/claim",
            headers=auth_header(ctx.user2_token)
        )
        assert response.status_code == 200

        # 验证认领后不在公海了
        response = client.get(
            "/api/customers/pool/",
            headers=auth_header(ctx.user1_token)
        )
        customers = response.json()
        pool_names = [c["name"] for c in customers]
        assert "待释放客户" not in pool_names

    def test_pool_history(self):
        """测试获取公海历史"""
        response = client.get(
            f"/api/customers/pool/{TestCustomerPool.pool_customer_id}/history",
            headers=auth_header(ctx.admin1_token)
        )
        assert response.status_code == 200
        history = response.json()
        assert len(history) == 2  # 释放 + 认领


class TestExport:
    """导出测试"""

    def test_export_customers_excel(self):
        """测试导出客户为Excel"""
        response = client.get(
            "/api/customers/export/excel",
            headers=auth_header(ctx.admin1_token)
        )
        assert response.status_code == 200
        assert "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" in response.headers["content-type"]


class TestCleanup:
    """清理测试：删除测试数据"""

    def test_delete_customer(self):
        """测试删除客户"""
        response = client.delete(
            f"/api/customers/{TestCustomerCRUD.customer_id}",
            headers=auth_header(ctx.user1_token)
        )
        # 可能已删除或成功删除
        assert response.status_code in [200, 404]
