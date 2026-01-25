# 后端服务 (Backend)

外勤管理系统 SaaS 平台 API 服务。

## 技术栈

- **框架**: FastAPI 0.109
- **数据库**: MySQL 8.0 + SQLAlchemy 2.0
- **认证**: JWT (python-jose)
- **测试**: pytest + httpx

## 环境要求

- Python 3.10+
- MySQL 8.0+

## 快速启动

### 1. 安装依赖

```bash
cd workspace/backend
pip install -r requirements.txt
```

### 2. 配置数据库

确保 MySQL 服务运行，并创建数据库：

```sql
CREATE DATABASE wq CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

数据库连接配置在 `app/database.py`：
```python
DATABASE_URL = "mysql+pymysql://root:root@127.0.0.1:3306/wq"
```

### 3. 启动服务

```bash
# 开发模式（热重载）
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 生产模式
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

### 4. 初始化数据（可选）

```bash
# 初始化基础数据（租户、用户、角色）
python init_data.py

# 创建测试数据（客户、模板、字段）
python create_test_data.py
```

## API 文档

启动服务后访问：
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 测试

### 运行所有测试

```bash
# 使用 pytest
python -m pytest

# 或使用批处理脚本 (Windows)
run_tests.bat
```

### 运行特定测试

```bash
# 运行特定测试类
python -m pytest tests/test_api.py::TestAuth -v

# 运行单个测试
python -m pytest tests/test_api.py::TestAuth::test_login_superadmin -v

# 按关键词筛选
python -m pytest -k "login" -v
```

### 测试覆盖范围

共 33 个测试用例，覆盖：

| 模块 | 测试数 | 说明 |
|------|--------|------|
| 认证 (TestAuth) | 7 | 登录、权限验证 |
| 字段定义 (TestFieldDefinitions) | 4 | CRUD、重复校验 |
| 模板 (TestCustomerTemplates) | 3 | 创建、字段关联 |
| 客户 CRUD (TestCustomerCRUD) | 5 | 增删改查、筛选 |
| 租户隔离 (TestTenantIsolation) | 2 | 数据隔离验证 |
| 数据权限 (TestDataScope) | 5 | self/team/all |
| 客户公海 (TestCustomerPool) | 5 | 释放、认领 |
| 导出 (TestExport) | 1 | Excel 导出 |
| 清理 (TestCleanup) | 1 | 删除操作 |

## 项目结构

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py           # FastAPI 入口
│   ├── database.py       # 数据库配置
│   ├── core/
│   │   ├── deps.py       # 依赖注入
│   │   ├── security.py   # JWT 认证
│   │   └── permissions.py # 权限控制
│   ├── models/           # SQLAlchemy 模型
│   ├── schemas/          # Pydantic 模式
│   ├── routes/           # API 路由
│   └── services/         # 业务逻辑
├── tests/
│   └── test_api.py       # API 测试
├── requirements.txt
├── pytest.ini
└── README.md
```

## 常用脚本

| 脚本 | 用途 |
|------|------|
| `init_data.py` | 初始化基础数据 |
| `create_test_data.py` | 创建完整测试数据 |
| `create_test_customers.py` | 仅创建测试客户 |
| `create_test_employees.py` | 仅创建测试员工 |
| `migrate_saas.py` | SaaS 多租户迁移 |
| `migrate_rbac.py` | RBAC 权限迁移 |
