---
title: 关于大模型采样与能量视角的一些想法
summary: 从训练数据、token 到推理轨迹，区分大模型中不同的采样问题，并讨论 Gibbs 能量视角能带来什么。
publishedAt: "2026-08-30 12:00:00"
language: zh
translationKey: llm-sampling-energy-view
routeSlug: llm-sampling-energy-view
keywords:
  - large language model
  - sampling
  - data mixture
  - Gibbs distribution
  - reasoning trajectory
draft: false
featured: true
comments: true
order: 200
---

“大模型用什么采样器？”看似是一个简单问题，实际上把几种完全不同的随机对象放进了同一个词里。正态分布只在其中一部分场景出现。更重要的问题始终是：**我们究竟在采什么？**

## 先区分五种采样

大模型系统里至少有五个不同层次：

1. **参数与连续噪声**：权重初始化、潜变量或扰动可能使用 Gaussian 等连续分布。
2. **训练样本**：从海量文档中选择一个 batch，通常是离散索引采样。
3. **数据混合**：决定网页、代码、数学、多语言语料各自占多少训练预算。
4. **下一个 token**：从词表上的 categorical distribution 选择离散 token。
5. **推理轨迹**：对同一道题生成多条 reasoning path 或 rollout，再进行评价、投票或训练。

如果采样对象是词表中的 token，就没有必要先从 $N(0,1)$ 抽一个连续数。模型给出 logits $z_i$，temperature sampling 使用

$$
p_i(T)=\frac{\exp(z_i/T)}{\sum_j\exp(z_j/T)}.
$$

这已经是一个离散概率分布。$T\to0$ 时它趋向贪心选择；$T$ 增大时分布变平，但“更随机”不自动意味着“更多有意义的差异”。如果候选之间高度同质，提高温度可能只是增加错误而非结构性多样性。

## 训练数据采样其实决定模型把时间花在哪里

假设原始语料由网页、代码、数学和论文组成。完全按数据量采样，最大的来源会主导梯度；完全平均，又可能反复过采样小型语料。实际的数据混合需要选择权重

$$
w_1,\ldots,w_K,\qquad \sum_{k=1}^K w_k=1,
$$

并从 mixture

$$
p(x)=\sum_{k=1}^K w_k p_k(x)
$$

中取样。权重不仅是加载器配置，也是在固定 token 预算下分配学习机会。相关研究尝试用小规模训练结果或 scaling law 预测更大训练的合适 mixture，但这仍然依赖目标任务、模型规模、去重和质量过滤等条件。

课程学习、难例采样和动态 mixture 都是在改变“什么时候看什么”。它们真正的比较对象不是采样分布是否新奇，而是在相同计算预算下是否改善目标能力，同时避免过拟合、遗忘或训练不稳定。

## Token sampling 本来就很像 Gibbs distribution

若定义能量

$$
E_i=-z_i,
$$

则 softmax 可以重写为

$$
p_i(T)=\frac{\exp(-E_i/T)}{\sum_j\exp(-E_j/T)}.
$$

这与离散 Gibbs / Boltzmann distribution 具有相同形式。这里的温度不是物理温度，而是控制概率集中程度的参数。这个等价关系有用，因为它把 sampling 写成熵正则优化。对概率向量 $p$，考虑

$$
\max_{p\in\Delta}
\left\{\sum_i p_i z_i+T H(p)\right\},
$$

其中 $H(p)=-\sum_i p_i\log p_i$。最优解正是 softmax。第一项偏好高分候选，熵项阻止分布过早坍缩。

因此，直接问“能否把 Maxwell–Boltzmann 分布用于 LLM”需要拆开回答。Boltzmann / Gibbs 的指数能量形式早已存在于 softmax 中；Maxwell speed distribution 额外包含来自三维速度空间体积的 $v^2$ 因子。LLM 没有天然的三维速度空间，所以不能只因它来自物理就认为它更适合 token 采样。

如果模型中确实存在 $d$ 维各向同性 Gaussian 扰动，其半径自然服从 $\chi_d$；Maxwell 只是 $d=3$ 的特例。分布应当从对象的几何结构推导，而不是先选一个物理名称再寻找应用。

## 更有意思的是推理轨迹采样

Self-consistency 会为同一问题采样多条推理路径，再选择一致答案。DeepSeek-R1 等工作也显示，rollout 已经成为 reasoning model 训练的重要对象。此时成本不再只是“抽一个 token”，而是生成整条轨迹

$$
\tau=(y_1,y_2,\ldots,y_L).
$$

不同轨迹可能重复、过长、明显错误，也可能提供新的解题结构。固定采样 $N$ 条并不总是最合理：简单问题可能一条就够，困难问题则需要更大探索预算。

可以把轨迹采样写成一个研究性的熵正则目标：

$$
\max_q\;
\mathbb E_{\tau\sim q}
[R(\tau)-\lambda C(\tau)-\mu D(\tau)]
+T H(q).
$$

这里 $R$ 表示可验证质量，$C$ 表示 token 或时间成本，$D$ 表示与已生成轨迹的重复惩罚。形式上的最优分布是

$$
q^*(\tau)\propto
\exp\left(
\frac{R(\tau)-\lambda C(\tau)-\mu D(\tau)}{T}
\right).
$$

这不是一个已经验证完毕的通用 sampler，而是一种建模语言。真正困难的地方在于：轨迹生成前无法准确知道 $R$，多样性度量可能奖励表面差异，verifier 也可能被系统性利用。

## 从固定温度走向状态依赖控制

比“temperature 应该设成 0.7 还是 1.0”更有研究价值的问题，是让预算和温度依赖输入与当前不确定性：

$$
T=T(x,\theta,h_t),\qquad N=N(x,\theta,h_t).
$$

模型很确定且已有轨迹相互一致时，可以提前停止；候选冲突或验证不稳定时，再扩大探索。评价这类方法应固定准确率或任务收益，比较它能否降低总 rollout token、延迟和训练计算，而不是只展示一种新分布的形状。

所以，统计物理给大模型采样最有价值的并不是某个现成分布的名字，而是三件事：能量把质量与成本写进统一目标，熵描述探索，density of states 提醒我们同一质量水平可能对应许多不同路径。只有当这些概念导出可验证的预算节省、误差界或算法，它们才从类比变成方法。

## 参考资料

- DeepSeek-AI, [DeepSeek-R1: Incentivizing Reasoning Capability in LLMs via Reinforcement Learning](https://arxiv.org/abs/2501.12948).
- Xuezhi Wang et al., [Self-Consistency Improves Chain of Thought Reasoning in Language Models](https://arxiv.org/abs/2203.11171), ICLR 2023.
- Apple Machine Learning Research, [Scaling Laws for Optimal Data Mixtures](https://machinelearning.apple.com/research/optimal-data-mixtures).
