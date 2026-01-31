# 代码模式规则

> 记录项目中的最佳实践和代码模式，保持代码风格一致。

## 命名模式

### 文件命名
```yaml
后端模型: workspace/backend/app/models/{entity}.py (snake_case)
后端路由: workspace/backend/app/routes/{entity_plural}.py (snake_case)
后端Schema: workspace/backend/app/schemas/{entity}.py (snake_case)
前端页面: workspace/frontend/src/pages/{EntityName}.tsx (PascalCase)
前端组件: workspace/frontend/src/components/{ComponentName}.tsx (PascalCase)
数据库表名: tn_{entity_plural} (snake_case, tn_前缀)
```

### 变量命名
```yaml
后端Python: snake_case (函数、变量、路由参数)
前端TypeScript: camelCase (变量、函数), PascalCase (组件、接口)
React Query Key: 使用 queryKeys 工厂函数, 格式 queryKeys.{entity}.{action}(params)
API 端点: kebab-case (/api/customer-templates, /api/field-definitions)
```

## 后端路由模式

### CRUD 路由标准
```python
router = APIRouter(prefix="/资源路径", tags=["中文标签"])

# 列表: GET /
@router.get("/", response_model=List[XxxResponse])
def list_xxx(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    tenant_id = get_effective_tenant_id(request, current_user)
    # ...

# 创建: POST /
# 详情: GET /{id}
# 更新: PUT /{id}
# 删除: DELETE /{id}
```

### 权限查询构建
```python
# 客户查询使用 get_customer_query() 自动处理:
# 1. 租户隔离 (tenant_id)
# 2. 数据权限 (data_scope: self/team/all)
# 3. 区域权限 (enable_region_scope + UserRegion)
query = get_customer_query(db, current_user, tenant_id)

# 标准筛选使用 apply_standard_filters():
query = apply_standard_filters(query, template_id=..., keyword=..., ...)
```

### 依赖注入标准
```python
from ..core.deps import get_current_active_user, get_effective_tenant_id, require_tenant_context

# get_effective_tenant_id: 读操作, 超管可选租户
# require_tenant_context: 写操作, 必须有租户上下文
```

## 前端页面模式

### 页面标准结构
```typescript
import { queryKeys } from '../api/queryKeys';

const XxxList: React.FC = () => {
  const queryClient = useQueryClient();
  const [form] = Form.useForm();
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Xxx | undefined>();

  // 数据查询
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.xxx.list(filters),
    queryFn: () => xxxApi.list(filters).then(res => res.data),
  });

  // 变更后刷新
  queryClient.invalidateQueries({ queryKey: queryKeys.xxx.all });

  return (
    <div>
      {/* 工具栏 */}
      <Table columns={columns} dataSource={data} rowKey="id" />
      <Modal>{/* 编辑表单 */}</Modal>
    </div>
  );
};
```

### Table 列宽约定
```yaml
ID列: width: 60
名称列: width: 100-150, ellipsis: true
时间列: width: 100, 格式 dayjs(text).format('MM-DD HH:mm')
标签列: width: 80-100
操作列: width: 160-200, Space size={0}, Button size="small" type="link"
表格scroll: 根据列宽总和计算, 内容区约658px
```

### 组件模式
```yaml
共享组件位置: src/components/
错误边界: ErrorBoundary 包裹主内容区
动态表单: CustomerForm 组件处理模板选择+字段渲染
```

## QueryKey 规范

### 工厂函数 (api/queryKeys.ts)
```typescript
// 所有 queryKey 必须通过工厂函数生成
queryKeys.customers.all          // ['customers'] - 用于 invalidateQueries
queryKeys.customers.list(filters) // ['customers', 'list', filters]
queryKeys.customers.detail(id)    // ['customers', 'detail', id]

// 禁止直接写字符串: queryKey: ['customers']
```

---

*发现新的代码模式时补充*
