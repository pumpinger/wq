---
description: 需求开发入口 - 自动遵循 AI 工程化流程
argument-hint: [需求描述或需求ID]
---

# 需求开发流程启动

## 1. 加载项目规范

@AGENTS.md

## 2. 查看当前需求状态

@requirements/INDEX.md

## 3. 任务

用户需求：$ARGUMENTS

请按照 AGENTS.md 中的 **Plan → Work → Review → Compound** 流程执行：

### Plan（规划）
- 如果是新需求：在 `requirements/in-progress/` 创建需求文档
- 如果是继续需求：读取对应的需求文档
- 检索 `context/experience/` 中的相关历史经验
- 匹配 `rules/context-rules.md` 加载相关上下文
- 检查 `rules/risk-rules.md` 提示潜在风险


### Compound（沉淀）
- 更新 `requirements/INDEX.md` 状态

---

请先执行 Plan 阶段，告诉我：
1. 你对需求的理解
2. 检索到的相关历史经验（如有）
3. 识别到的风险点（如有）
4. 建议的执行方案
