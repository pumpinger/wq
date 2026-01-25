# 前端应用 (Frontend)

外勤管理系统 SaaS 平台 Web 客户端。

## 技术栈

- **框架**: React 19 + TypeScript
- **构建**: Vite 7
- **UI 组件**: Ant Design 6
- **状态管理**: TanStack React Query 5
- **HTTP**: Axios
- **地图**: Leaflet + React-Leaflet

## 环境要求

- Node.js 18+
- npm 或 pnpm

## 快速启动

### 1. 安装依赖

```bash
cd workspace/frontend
npm install
```

### 2. 启动开发服务器

```bash
npm run dev
```

默认访问: http://localhost:5173

### 3. 构建生产版本

```bash
npm run build
```

构建产物在 `dist/` 目录。

## 可用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器（热重载） |
| `npm run build` | 构建生产版本 |
| `npm run preview` | 预览生产构建 |
| `npm run lint` | 运行 ESLint 检查 |

## 项目结构

```
frontend/
├── public/              # 静态资源
├── src/
│   ├── api/             # API 接口封装
│   │   ├── index.ts     # Axios 实例和通用接口
│   │   └── role.ts      # 角色相关接口
│   ├── components/      # 可复用组件
│   │   ├── CustomerForm.tsx    # 客户表单
│   │   ├── DynamicField.tsx    # 动态字段渲染
│   │   └── LocationPicker.tsx  # 地图位置选择
│   ├── contexts/
│   │   └── AuthContext.tsx     # 认证上下文
│   ├── pages/           # 页面组件
│   │   ├── Login.tsx           # 登录页
│   │   ├── CustomerList.tsx    # 客户列表
│   │   ├── CustomerMap.tsx     # 客户地图
│   │   ├── CustomerPool.tsx    # 客户公海
│   │   ├── FieldList.tsx       # 字段管理
│   │   ├── TemplateList.tsx    # 模板管理
│   │   ├── admin/
│   │   │   └── TenantList.tsx  # 租户管理（超管）
│   │   └── tenant/
│   │       ├── UserList.tsx    # 用户管理
│   │       └── RoleList.tsx    # 角色管理
│   ├── types/           # TypeScript 类型定义
│   ├── App.tsx          # 应用入口
│   ├── App.css          # 全局样式
│   └── main.tsx         # 渲染入口
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## 测试账号

登录页提供快速登录按钮，可切换不同角色：

| 角色 | 用户名 | 密码 | 说明 |
|------|--------|------|------|
| 超级管理员 | admin | admin123 | 全局管理 |
| 租户管理员 | test_admin | test123 | 租户内管理 |
| 普通用户 | zhangwei | 123456 | 业务员 |

## API 配置

API 基础地址配置在 `src/api/index.ts`：

```typescript
const api = axios.create({
  baseURL: 'http://localhost:8000/api',
  // ...
});
```

## 功能模块

### 客户管理
- 客户列表（筛选、搜索、分页）
- 客户详情（动态表单）
- 客户地图（位置标注）
- 客户公海（释放、认领）
- 客户导出（Excel）

### 模板管理
- 客户模板 CRUD
- 字段关联配置

### 字段管理
- 字段定义 CRUD
- 多种字段类型（文本、数字、单选、多选、日期等）

### 系统管理
- 租户管理（超管）
- 用户管理
- 角色管理（RBAC）
