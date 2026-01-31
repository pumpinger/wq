# 风险识别规则

> 根据场景自动提示潜在风险，避免重复踩坑。

## 规则格式

```yaml
- trigger: "触发关键词或场景描述"
  level: "high|medium|low"
  alert: "风险提示内容"
  solution: "建议的解决方案"
```

## 规则列表

### 高风险 (high)

```yaml
- trigger: "修改测试账号配置"
  level: "high"
  alert: "修改 Login.tsx 测试账号时，必须同步检查数据库中实际密码是否匹配"
  solution: "1. 确认数据库密码 2. 更新数据库或前端配置保持一致 3. 避免部分更新导致不一致"

- trigger: "创建测试用户脚本"
  level: "high"
  alert: "创建用户脚本可能只更新已存在用户的部分字段，不更新密码"
  solution: "脚本应明确说明是创建新用户还是更新现有用户，密码更新需要单独处理"

- trigger: "多租户用户名"
  level: "high"
  alert: "用户名在不同租户间可能重复，导致登录歧义"
  solution: "1. 考虑全局唯一约束 2. 登录时带租户标识 3. 避免测试时使用相同用户名"

- trigger: "React Query queryKey"
  level: "high"
  alert: "不同页面使用相同 queryKey 字符串会导致缓存碰撞，造成白屏或数据错乱。已发生两次事故。"
  solution: "1. 必须使用 api/queryKeys.ts 工厂函数 2. 禁止在页面中直接写字符串 queryKey 3. 带参数的 key 使用结构化格式 ['entity', 'action', params]"

- trigger: "App.tsx selectedKey 初始化"
  level: "high"
  alert: "selectedKey 初始化必须根据用户角色动态计算，硬编码会导致非匹配角色用户看到白屏"
  solution: "使用 getInitialKey() 函数: 超管→tenants, 租户管理员→users, 普通用户→customers"

- trigger: "导出路由路径"
  level: "high"
  alert: "FastAPI 路由 /export/excel 必须在 /{customer_id} 之前定义，否则 'export' 会被当作 customer_id"
  solution: "确保 export 路由在动态路径路由之前注册"
```

### 中风险 (medium)

```yaml
- trigger: "超管操作业务数据"
  level: "medium"
  alert: "超管在平台模式下操作业务API会缺少 tenant_id，导致数据隔离失效"
  solution: "使用 require_tenant_context() 确保写操作必须有租户上下文; 读操作使用 get_effective_tenant_id()"

- trigger: "修改表格列宽"
  level: "medium"
  alert: "内容区仅约658px宽，表格列宽总和过大会导致严重横向滚动"
  solution: "优先使用 ellipsis、缩短列标题、按钮用 size=small type=link、时间格式用 MM-DD HH:mm"

- trigger: "invalidateQueries 跨页面"
  level: "medium"
  alert: "修改客户后需要同时刷新 customers 和 pool-customers; 修改区域后需刷新 regions 和 regions-list"
  solution: "使用 queryKeys.xxx.all 前缀匹配刷新相关的所有查询"

- trigger: "区域权限开关"
  level: "medium"
  alert: "Tenant.enable_region_scope 是租户级开关，开启后未分配区域的员工只能看到未分配区域的客户"
  solution: "开启前确保已为相关员工分配区域，否则员工将看不到已有客户"
```

### 低风险 (low)

```yaml
- trigger: "日期格式化"
  level: "low"
  alert: "表格中日期统一使用 dayjs(text).format('MM-DD HH:mm') 格式以节省列宽"
  solution: "导入 dayjs, 在 render 函数中格式化"

- trigger: "Modal destroyOnClose"
  level: "low"
  alert: "编辑Modal使用 destroyOnClose 可避免表单残留旧数据"
  solution: "在包含 Form 的 Modal 上添加 destroyOnClose 属性"
```

---

*遇到新的风险场景时及时补充*
