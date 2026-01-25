# 外勤管理系统 - SaaS 多租户平台

多租户 SaaS 客户管理系统，支持多模板、多字段的客户信息录入与管理。

## 项目结构

```
workspace/
├── backend/        # FastAPI 后端服务
└── frontend/       # React 前端应用
```

## 快速启动

### 环境要求

- Python 3.10+
- Node.js 18+
- MySQL 8.0+

### 1. 启动后端

```bash
# 安装依赖
cd workspace/backend
pip install -r requirements.txt

# 创建数据库
mysql -u root -p -e "CREATE DATABASE wq CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 启动服务
uvicorn app.main:app --reload --port 8000
```

### 2. 启动前端

```bash
# 安装依赖
cd workspace/frontend
npm install

# 启动开发服务器
npm run dev
```

### 3. 初始化数据（可选）

```bash
cd workspace/backend
python create_test_data.py
```

### 4. 访问应用

- **前端**: http://localhost:5173
- **后端 API**: http://localhost:8000
- **API 文档**: http://localhost:8000/docs

## 测试账号

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 超级管理员 | admin | admin123 |
| 租户管理员 | test_admin | test123 |
| 普通用户 | zhangwei | 123456 |

## 运行测试

```bash
cd workspace/backend

# 运行所有测试
python -m pytest

# 运行指定测试
python -m pytest tests/test_api.py::TestAuth -v
```

## 技术栈

### 后端
- FastAPI + SQLAlchemy + MySQL
- JWT 认证
- RBAC 权限控制

### 前端
- React 19 + TypeScript + Vite
- Ant Design 6
- TanStack React Query
- Leaflet 地图

## 详细文档

- [后端文档](backend/README.md)
- [前端文档](frontend/README.md)
