# 外勤管理系统 (Field Work Management)

多租户 SaaS 客户管理系统，支持自定义字段模板、RBAC 权限控制、客户公海、区域管理、地图分布等功能。

## 技术栈

| 层 | 技术 |
|---|------|
| 前端 | React 18 + TypeScript + Ant Design 5 + React Query |
| 后端 | Python FastAPI + SQLAlchemy 2.0 |
| 数据库 | MySQL 8.0 |
| 地图 | Leaflet + OpenStreetMap |

## 快速开始

### 方式一：Docker 一键启动（推荐）

```bash
git clone https://github.com/pumpinger/wq.git
cd wq
docker compose up -d
```

启动后访问 http://localhost

### 方式二：手动安装

**环境要求：** Python 3.10+、Node.js 18+、MySQL 8.0

#### 1. 创建数据库

```sql
CREATE DATABASE wq CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

#### 2. 启动后端

```bash
cd workspace/backend

# 安装依赖
pip install -r requirements.txt

# 配置环境变量（按需修改数据库连接等）
cp .env.example .env

# 初始化数据库（建表 + 创建管理员 + 初始化权限/角色/字段）
python setup_db.py

# 启动服务
uvicorn app.main:app --reload
```

#### 3. 启动前端

```bash
cd workspace/frontend

npm install
npm run dev
```

访问 http://localhost:5173

## 默认账号

| 角色 | 用户名 | 密码 | 说明 |
|------|--------|------|------|
| 超级管理员 | superadmin | admin123 | 平台级管理，可创建租户 |

> 登录后请立即修改密码。超管可在「租户管理」中创建租户和租户管理员。

## 功能模块

- **多租户管理** — 租户隔离，超管可进入任意租户操作
- **客户管理** — 基于自定义模板的客户 CRUD、Excel 导出
- **字段/模板系统** — 动态字段定义 + 模板组合，适应不同业务场景
- **RBAC 权限** — 角色/权限/数据范围（自己/团队/全部）三级控制
- **客户公海** — 客户释放、认领、历史追踪
- **区域管理** — 区域划分 + 员工区域分配 + 区域数据权限
- **客户分布** — Leaflet 地图展示客户地理位置

## 项目结构

```
wq/
├── docker-compose.yml          # Docker 编排
├── workspace/
│   ├── backend/                # FastAPI 后端
│   │   ├── app/
│   │   │   ├── models/         # SQLAlchemy 数据模型
│   │   │   ├── routes/         # API 路由
│   │   │   ├── schemas/        # Pydantic 请求/响应模型
│   │   │   └── core/           # 安全、认证等核心模块
│   │   ├── setup_db.py         # 数据库初始化脚本
│   │   └── requirements.txt
│   └── frontend/               # React 前端
│       ├── src/
│       │   ├── pages/          # 页面组件
│       │   ├── components/     # 通用组件
│       │   ├── api/            # API 接口 + queryKeys
│       │   └── contexts/       # React Context (Auth)
│       └── package.json
└── CLAUDE.md                   # AI 开发上下文
```

## API 文档

启动后端后访问：http://127.0.0.1:8000/docs (Swagger UI)

## License

[MIT](LICENSE)
