---
title: 关于 Workflow 与 Agent Harness 的一些想法
summary: 当模型开始动态规划和调用工具，Workflow 并没有消失，而是在 Harness 中变成可执行、可恢复、可验证的控制结构。
publishedAt: "2026-08-21 01:35:36"
language: zh
translationKey: workflow-to-agent-harness
routeSlug: workflow-to-agent-harness
keywords:
  - agent harness
  - workflow
  - orchestration
  - durable execution
  - agent trajectory
draft: false
featured: true
comments: true
cover: /uploads/blogs/workflow-to-agent-harness/cover.png
coverAlt: 蓝粉长发的原创研究者与星猫修复包含检查点、反馈回路和恢复路径的智能体执行网络
order: 400
---

近两年出现了大量可视化 Agent workflow 工具：把 LLM、检索、条件分支、工具调用和多个 Agent 拖成一张图，就能得到一条可执行流程。它们解决了真实问题，但也让我产生一个疑问：当模型越来越擅长自己规划，继续做“更多节点、更漂亮的连线”是否仍然构成足够强的技术贡献？

我的暂时答案是：**手工微观编排正在商品化，Workflow 本身却不会消失。它会从最高层的求解算法，逐渐变成 Agent Harness 中的一种控制原语。**

## 先把四层分开

很多争论来自把不同层次叫成同一个“Agent 平台”。我更愿意采用下面的分层：

```text
业务流程与制度约束
        ↓
Agent / Workflow 编排
        ↓
Harness / Runtime
        ↓
模型、工具与外部环境
```

模型负责一次调用中的局部推理和动作建议。Workflow 描述一个相对显式的执行图。Harness 则维持跨多次模型调用的运行状态：上下文、工具、权限、重试、恢复、记忆、验证、终止和观测。

Anthropic 在 *Building Effective Agents* 中给出了一个有用区分：workflow 通过预先定义的代码路径编排模型和工具，而 agent 让模型动态决定自己的过程与工具使用。这个区分并不意味着二者只能选一个。现实系统往往是在固定边界内允许局部自治。

## 模型 CoT 与 Agent trajectory 不是一回事

一次模型调用内部的推理，可以粗略写成

```text
context → reasoning → answer or action
```

Harness 维持的则是跨调用闭环：

```text
goal
  ↓
reason → act → observe
  ↑              ↓
  └── update state
  ↓
verify → stop or continue
```

因此，更准确的说法是：模型产生局部 reasoning，Harness 组织全局 agent trajectory。搜索、读取文件、执行程序、看到失败、压缩上下文、再次规划，这些事件共同组成一条执行轨迹，不能简单等同于模型内部的 Chain of Thought。

可以把这个闭环抽象成

$$
s_{t+1}=F(s_t,a_t,o_{t+1}),\qquad a_t\sim\pi_\theta(\cdot\mid s_t),
$$

其中模型近似承担策略 $\pi_\theta$，Harness 维护状态 $s_t$、执行动作 $a_t$ 并接收环境观测 $o_{t+1}$。这不是说 Agent 系统就是一个已经定义完善的 MDP，而是说明它更接近闭环控制，而非一条静态文字推理链。

## Workflow 会从“怎样做”转向“什么必须发生”

如果任务只是“查资料—总结—输出”，一个更强的 Agent 也许能够临时生成计划，不需要用户画十几个节点。但银行审批、生产发布、数据删除或安全修复并不能只交给模型自由发挥。它们需要明确规定：

- 哪些检查不可跳过；
- 哪些工具或数据不可访问；
- 哪一步需要人工批准；
- 失败后如何补偿、重试或回滚；
- 哪些证据必须被保存以便审计。

因此 Workflow 的角色可能从

> 完整描述任务应该怎样被求解

转向

> 声明执行过程中必须满足的制度、约束和检查点。

这也是 durable execution 仍然重要的原因。一个运行几分钟、几小时甚至几天的 Agent 会遇到进程重启、网络失败、工具超时和人工等待。Temporal 的官方文档把 durable execution 的目标描述为：记录执行进度，并在故障后从原位置继续。无论规划者是人还是模型，这一类运行时保证都不会因为模型变聪明而自动出现。

## Workflow 作为 Harness 的可插拔能力

从软件结构看，一个 Harness 可以暴露类似这样的能力：

```text
Harness
 ├─ tool registry
 ├─ memory
 ├─ sandbox and permissions
 ├─ evaluator
 ├─ scheduler
 └─ workflow engine
```

Workflow engine 可以执行静态 DAG、状态机或带人工节点的持久流程，也可以执行 Agent 临时生成的计划。OpenAI Agents SDK 的文档同样把工具、handoff、guardrail、session 与 orchestration 放在运行框架中，而不是假设一张可视化图足以承担全部运行时职责。

这时 Workflow 不再等于整个系统，而是一种 structured plan / execution graph：可以生成、检查、执行、暂停、恢复和废弃。

## 我认为真正还值得做的问题

如果去掉可视化界面，一个 Workflow 项目还剩下什么？这个问题或许比“节点够不够多”更能判断技术价值。下面这些方向仍然很难：

1. **Workflow synthesis**：给定目标、工具和约束，生成可执行图，而不是只生成自然语言计划。
2. **Verification**：在执行前证明危险路径不可达，或确保审批节点无法被绕过。
3. **Recovery**：模型调用非确定、外部 API 有副作用时，怎样实现安全的重试和补偿？
4. **Permission shaping**：根据当前步骤动态授予最小权限，而不是让 Agent 从开始就拥有所有工具。
5. **Trajectory learning**：从成功和失败轨迹中学习何时展开计划、何时调用既有 Workflow、何时回到人工控制。
6. **Evaluation**：评价的不只是最终答案，还包括成本、风险、可恢复性和过程证据。

所以我并不认为“Workflow 的时代已经结束”。更准确的判断是：只把固定节点连起来的微观流程越来越容易被复制；把 Workflow 变成 Harness 内可生成、可验证、可恢复、可学习的执行结构，反而刚刚成为一个更清楚的问题。

## 参考资料

- Anthropic, [Building Effective Agents](https://www.anthropic.com/engineering/building-effective-agents).
- OpenAI, [Agents SDK documentation](https://openai.github.io/openai-agents-python/agents/) and [agent orchestration](https://openai.github.io/openai-agents-js/guides/multi-agent/).
- Temporal, [Durable Execution documentation](https://docs.temporal.io/).
