---
description: Bug 修复入口 - 先查经验再动手
argument-hint: [bug描述或bug ID]
---

# Bug 修复流程

## 1. 加载项目规范

@AGENTS.md

## 2. 任务

Bug 描述：$ARGUMENTS

请按照 **Plan → Work → Review → Compound** 流程执行：

### Plan（规划）- 重点：先查历史经验
1. 检索 `context/experience/` 看是否有类似问题的解决方案
2. 匹配 `rules/risk-rules.md` 识别潜在风险
3. 分析 bug 根因

### Work（执行）
- 定位问题代码
- 实施修复
- 验证修复效果

### Review（复查）
- 检查是否引入新问题
- 参考 `rules/checklist-rules.md`

### Compound（沉淀）
- 如果发现新的风险模式，更新 `rules/risk-rules.md`

---

请先执行 Plan 阶段：
1. 检索相关历史经验
2. 分析可能的原因
3. 提出修复方案
