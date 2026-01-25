# AI 工程化协作规范

> 每次会话从这里开始。本文件只放通用规范和目录指针，具体内容下沉到对应目录。

## 核心理念

**复合工程**：每一次工作都让下一次更快、更稳。知识沉淀到工具链，而非人脑。

## 工作流程：Plan → Work → Review → Compound

### Plan（规划）
- 新需求 → 先在 `requirements/in-progress/` 创建或者读取需求文档
- 改 Bug → 先检索 `context/experience/` 查历史经验
- 重要变更 → 先设计方案，再动手
- 使用/ralph-loop插件，设定目标

### Work（执行）
- 按计划执行，边做边记录关键决策
- 遇到问题立即记录，不要事后补
- 复合工程本身的文档如果有问题，也需要立即修改
- 补充完善测试方法和目标

### Review（复查）
- 完成前进行代码测试，充分利用mcp工具以及项目的单元测试来确保功能正常
- 完成后检查是否遗漏
- 参考 `rules/checklist-rules.md`

### Compound（沉淀）
- **当下立即沉淀**，不是事后补文档
- 踩坑经验 → `context/experience/`
- 发现规律 → `rules/` 对应文件
- 可复用知识 → `context/tech/` 或 `context/business/`

## 上下文工程

### 即时加载策略（Just-in-Time）
不预加载所有文档，按需加载：

1. **意图识别** → 判断任务类型
2. **规则匹配** → 查 `rules/context-rules.md` 确定需加载的上下文
3. **按需加载** → 只加载当前阶段需要的文档
4. **经验检索** → 自动匹配 `context/experience/` 相关经验并提醒

### 上下文分层
```
概要层（快速理解）     → AGENTS.md、requirements/INDEX.md
业务层（需求分析时）   → context/business/
技术层（方案设计时）   → context/tech/
经验层（实施前）       → context/experience/
规则层（全程）         → rules/
```

## 目录结构（位置即语义）

```
├── AGENTS.md              # 本文件 - AI 协作入口
├── context/               # 可复用上下文（长期记忆）
│   ├── business/          # 业务领域知识
│   ├── tech/              # 技术背景
│   │   └── services/      # 服务/模块技术总结
│   └── experience/        # 历史经验沉淀
├── requirements/          # 需求产物
│   ├── INDEX.md           # 需求状态索引（先看这个）
│   ├── in-progress/       # 进行中需求
│   └── completed/         # 已完成需求
├── rules/                 # 经验规则库
│   ├── context-rules.md   # 上下文加载规则
│   ├── risk-rules.md      # 风险识别规则
│   ├── pattern-rules.md   # 代码模式规则
│   └── checklist-rules.md # 检查清单
└── workspace/             # 代码工作区（临时文件）
```

## 核心约束

0. **拒绝推测**：不清楚的问题，要去查阅，要去确定，不要主观推测
1. **入口短小**：本文件只放规范和指针，不写具体步骤
2. **位置即语义**：文件放对位置，不用额外解释用途
3. **复利沉淀**：每次产出结果的同时，沉淀让下次更快的知识
4. **即时检索**：经验在正确时刻自动推送，不依赖人记忆
5. **当下记录**：问题解决的当下立即沉淀，不事后补文档

## 快速入口

| 场景 | 入口 |
|------|------|
| 开始新需求 | `requirements/INDEX.md` → 创建需求文档 |
| 继续现有需求 | `requirements/in-progress/{需求文档}` |
| 查历史经验 | `context/experience/` |
| 查业务背景 | `context/business/` |
| 查技术细节 | `context/tech/` |
| 沉淀新经验 | 写入 `context/experience/` + 更新 `rules/` |

## 项目特定信息

> 以下指向项目特有的规范和背景，与 AI 工程化流程分离

- 源码位置：`./workspace/`
- 项目概述：`./context/business/项目概述.md`
- 技术架构：`./context/tech/架构概述.md`

---

*最后更新: 2026-01-19*
