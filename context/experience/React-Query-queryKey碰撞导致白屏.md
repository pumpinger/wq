# React Query queryKey 碰撞导致白屏

## 问题描述

多个页面使用相同的 queryKey 字符串（如 `['templates']`、`['fields']`），导致 React Query 缓存碰撞。当从一个页面导航到另一个页面时，缓存数据类型不匹配，组件渲染崩溃产生白屏。

## 触发条件

- 两个不同页面使用完全相同的 queryKey（如 `['regions']` vs `['regions-list']`）
- 页面 A 的查询返回格式与页面 B 不同（如 `res.data` vs `res.data.items`）
- 用户在两个页面之间切换时，React Query 复用了不匹配的缓存

## 根因分析

1. queryKey 是 React Query 的缓存键，完全相同的 key 会共享缓存
2. 项目中 `['regions']` 在 CustomerForm 和 UserList 中都被使用，但返回格式不同
3. 没有统一的 queryKey 命名规范，各页面独立定义字符串

## 解决方案

1. **创建 queryKeys 工厂函数** (`api/queryKeys.ts`)
   - 所有 queryKey 集中管理
   - 格式: `[entity, action, ...params]`
   - 如: `queryKeys.regions.list()` → `['regions', 'list']`
   - 如: `queryKeys.regions.all` → `['regions']` (仅用于 invalidateQueries)

2. **禁止直接写字符串 queryKey**
   - 所有页面必须 `import { queryKeys } from '../api/queryKeys'`

3. **invalidateQueries 使用前缀匹配**
   - `queryClient.invalidateQueries({ queryKey: queryKeys.regions.all })` 会刷新所有以 `['regions']` 开头的查询

## 校验方式

1. 全局搜索 `queryKey: [` 确认没有直接写字符串的地方
2. 在所有页面间循环导航，确认无白屏
3. 检查浏览器控制台无渲染错误

## 关联文档

- `rules/risk-rules.md` → queryKey 碰撞风险规则
- `rules/pattern-rules.md` → QueryKey 规范
