---
title: 关于 Agent 分层记忆架构的一些想法
summary: 从分层记忆系统出发，思考 Agent 如何区分事实、经历和操作经验，并在有限上下文中决定何时记住、读取、更新与遗忘。
publishedAt: "2026-10-22T10:36:51Z"
updatedAt: "2026-10-30T14:34:14Z"
language: zh
translationKey: agent-layered-memory
routeSlug: agent-layered-memory
category: inspirations
keywords:
  - agent memory
  - layered memory
  - ZenBrain
  - context management
  - memory routing
draft: false
featured: true
comments: true
cover: /uploads/blogs/agent-layered-memory/cover.png
coverAlt: 蓝粉长发的原创研究者在阶梯图书馆中引导记忆从档案抽屉进入工作台，星猫守在不同记忆层之间
order: 900
---

我越来越觉得，Agent 的长期记忆不像一个只需要不断扩容的硬盘，更像一间需要有人整理的房间。昨天的决定、今天的目标、一条读来的说法、一次成功的操作，都可以被保存，但它们不应该用完全相同的方式影响下一步行动。

阅读 [ZenBrain](https://arxiv.org/abs/2604.23878v3) 时，分层管理给了我一个有意思的切入口。它提出七层记忆及统一协调器，但我更关心的不是层数本身，而是不同信息有没有各自明确的生命周期和调用规则。

这里也需要保留一个阅读边界：作者的[技术页面](https://zensation.ai/en/technologie)包含评测更正与实现范围说明。因此，我不把某个成绩数字当作“七层必然优于其他架构”的证明；下面主要是由分层思路引出的个人研究设想。

## 分层首先是职责划分

我会先按问题组织记忆，而不急着决定使用几个数据库。

| 记忆职责 | 应该回答的问题 |
| --- | --- |
| 工作状态 | 当前任务是什么，哪些约束仍然有效？ |
| 情景记录 | 当时发生过什么，决定依据是什么？ |
| 语义知识 | 目前相信哪些事实，它们的来源是什么？ |
| 操作经验 | 哪种步骤曾经有效，适用于什么条件？ |

同一条原始记录可以拥有多个索引，而不必被机械复制到多个存储层。比如一次失败实验，既能按时间查到，也能通过方法、参数和失败原因被找到。

“核心偏好”或“跨任务知识”也不该因此获得无限权威。它们需要可修改、可追溯，还要尊重项目和用户之间的访问边界。分层是一种组织方式，不是给信息附加真实性的仪式。

## 非线性记忆不等于非线性输入

我之前对 Agent 轨迹有一个疑问：工具越用越多，历史却往往还是按先后顺序追加成一条长链。能否把任务、证据和经验组织成分层甚至并行的上下文？

外部记忆可以是一张图，多名执行者也可以维护不同的局部工作区；但对一次普通的文本模型调用而言，被选中的材料仍然需要转成模型实际能读的输入。改变外部组织方式，并不会自动改变模型内部的计算结构。

[MemGPT](https://arxiv.org/abs/2310.08560)的上下文管理思路让我更愿意把重点放在“搬运哪些信息”上，而不是声称摆脱了所有上下文限制。一个协调器可以维护全局目标，让不同任务只交换必要的证据摘要与原文入口，避免彼此吞入全部历史。

## 记忆管理是一项决策

设当前问题为 $q_t$，可用记忆为 $\mathcal M_t$，本次选中的集合为 $S_t$。一个尚待实现的目标可以写成

$$
S_t\in\operatorname*{arg\,max}_{S\subseteq\mathcal M_t}
\bigl[U(S,q_t)-\lambda C(S)\bigr],
\qquad C(S)\le B_t.
$$

其中 $U$ 表示对当前问题的帮助，$C$ 表示读取成本，$B_t$ 是预算。这只是问题定义：效用如何估计、证据之间如何去重、遗漏风险如何计入，都还没有被这个式子解决。

协调器的动作也不止检索：

$$
a_t=(\mathrm{read},\mathrm{write},\mathrm{revise},
\mathrm{consolidate},\mathrm{forget}).
$$

这是一组操作类别，不要求每轮全部执行。什么时候写入，什么时候只暂存，什么时候把一段经验提炼成可复用步骤，本身就是需要验证的策略。

反复取回某条信息，最多说明它经常被使用，并不证明它正确。频率、置信度、来源质量和权限应该分别记录，不能把“常被记起”简单等同于“更可信”。

## 更新比追加更困难

一个很普通的例子是配置变更：最初采用了一个超时设置，后来根据失败记录换了新值。问“现在用什么”与问“当时为什么失败”，需要的是不同的时间视角。

因此，一条记忆至少应保留来源、记录时间、适用时间、版本与状态。新的决定应能取代旧决定的当前效力，却不一定要抹去旧决定作为历史证据的存在。

[LongMemEval](https://arxiv.org/abs/2410.10813)把时间推理、知识更新与应当拒答的情形纳入评估，提醒我不能只检查“是否检索到了相似的一段话”。如果记忆中没有支持答案的资料，能够说明不知道，同样是一种必要能力。

## 从一个小实验开始

我更愿意先做一个固定资料集上的受控比较，而不是马上实现复杂的多层仿脑系统：

1. 保持同一模型、资料与 token 预算，比较平铺检索和按记忆职责路由。
2. 加入配置更新、项目隔离、冲突记录与证据缺失的任务。
3. 同时测量答案、证据命中、过期事实使用、读取量和延迟。
4. 再逐项加入遗忘与巩固，观察收益是否来自额外信息或更大的预算。

这些是计划中的验证，不是我已经取得的实验结果。只有较简单的系统在一致条件下仍有明显问题，才值得继续增加协调层。

我想做的也许不是一个更会收藏的 Agent，而是一个知道何时该翻哪一页、何时该改掉旧结论、何时应该暂时不下判断的 Agent。至于它怎样避免把有害材料变成长期经验，还需要单独讨论[记忆安全](/blogs/agent-memory-security/)。

## 参考资料

- Alexander Bering, [ZenBrain: A Neuroscience-Inspired 7-Layer Memory Architecture for Autonomous AI Systems, v3](https://arxiv.org/abs/2604.23878v3).
- ZenSation Research, [The science behind ZenBrain and evaluation clarifications](https://zensation.ai/en/technologie).
- Charles Packer et al., [MemGPT: Towards LLMs as Operating Systems](https://arxiv.org/abs/2310.08560).
- Di Wu et al., [LongMemEval](https://arxiv.org/abs/2410.10813).
