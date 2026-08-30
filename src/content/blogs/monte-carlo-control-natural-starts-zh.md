---
title: 关于 Monte Carlo 控制算法与自然起点的一些想法
summary: 从 Basic MC、Exploring Starts 与 ε-greedy 的差异出发，重新理解初始分布、探索机制、命中概率和自然起点。
publishedAt: "2026-08-30 15:48:15"
language: zh
translationKey: monte-carlo-control-natural-starts
routeSlug: monte-carlo-control-natural-starts
keywords:
  - Monte Carlo control
  - reinforcement learning
  - exploring starts
  - epsilon-greedy
  - hitting probability
draft: false
featured: true
comments: true
cover: /uploads/blogs/monte-carlo-control-natural-starts/cover.png
coverAlt: 蓝粉长发的原创研究者与星猫在实验台前引导多个自然起点沿随机状态路径汇聚至奖励节点
order: 500
---

第一次接触 Monte Carlo 控制时，Basic MC、Exploring Starts 和 $\epsilon$-greedy 很容易被记成三套互不相干的算法。后来我更愿意把它们看成同一个问题的三种回答：在不知道环境模型、只能等待一局结束后观察回报的情况下，我们究竟怎样保证值得评估的状态—动作对会被看到？

## 同一条主线，三种探索方式

一条 episode 可以写成

$$
S_0,A_0,R_1,S_1,A_1,\ldots,S_T,
$$

从时刻 $t$ 开始的折扣回报是

$$
G_t=R_{t+1}+\gamma R_{t+2}+\gamma^2R_{t+3}+\cdots.
$$

Monte Carlo 方法用完整轨迹的实际回报估计 $q_\pi(s,a)$，再依据估计结果改进策略。三种方法共享“采样—估值—改进”这条骨架，差别主要在探索从哪里进入。

| 方法 | 探索怎样发生 | 主要限制 |
| --- | --- | --- |
| Basic MC | 分别从希望评估的状态—动作对出发 | 需要强大的重置能力，采样也很低效 |
| MC Exploring Starts | 每局随机选择一个起始状态—动作对，并要求所有对都有机会被选中 | 现实系统通常不能任意指定开局 |
| MC $\epsilon$-greedy | 按任务原有规则开局，在轨迹的每一步保留随机动作 | 随机探索可能很慢，固定 $\epsilon$ 还会长期采取次优动作 |

“Basic MC”并不是所有教材都统一采用的专名，更像是为了讲清策略评估与策略改进而抽出的教学骨架。Sutton 与 Barto 的经典教材把重点放在 Monte Carlo prediction、Exploring Starts 和 on-policy control 上。真正值得保留下来的不是三个名字，而是它们对“覆盖从何而来”的不同回答。

## 什么是自然起点

所谓“正常入口”并不是严格术语。更准确的对象是环境规定的初始状态分布

$$
S_0\sim\rho_0.
$$

迷宫可能总从左下角开始，纸牌环境可能通过洗牌和发牌自然产生初始牌局，机器人也可能总从充电站附近启动。它们都属于任务本身的初始化规则，而不是算法为了探索而把系统搬到任意状态。

Exploring Starts 改变的是初始分布，要求

$$
\Pr(S_0=s,A_0=a)>0
$$

对所有待研究的 $(s,a)$ 成立。$\epsilon$-greedy 则通常保留 $\rho_0$，通过策略改变之后的转移规律。固定策略后，状态序列构成马尔可夫链，其转移核为

$$
P_\pi(s'\mid s)=\sum_a\pi(a\mid s)P(s'\mid s,a).
$$

这也提醒我：从自然起点出发并不等于能覆盖整个状态空间。若某个状态从 $\rho_0$ 的支撑集不可达，再积极的 $\epsilon$-greedy 也无法穿过环境本身不存在的通路。

## $\epsilon$-greedy 作为有漂移的随机游走

考虑一维状态 $0,1,\ldots,N$，每步可以向左或向右。如果当前贪心动作是向右，标准二动作 $\epsilon$-greedy 给出

$$
\Pr(\text{right})=1-\frac{\epsilon}{2},\qquad
\Pr(\text{left})=\frac{\epsilon}{2}.
$$

令位置增量为 $\Delta S_t\in\{-1,1\}$，则

$$
\mathbb E[\Delta S_t]=1-\epsilon.
$$

因此它不是无方向的简单随机游走，而是“策略产生的漂移”和“探索产生的扩散”的混合。$\epsilon$ 越小，轨迹越集中于当前贪心方向；$\epsilon$ 越大，覆盖更广，但到达目标所需时间和回报方差也可能增加。

如果边界 $0$ 与 $N$ 是吸收态，那么从 $i$ 出发先到达 $N$ 的概率满足离散调和方程

$$
h(i)=p\,h(i+1)+(1-p)h(i-1),\qquad h(0)=0,\quad h(N)=1,
$$

其中 $p=1-\epsilon/2$。这把一个强化学习探索问题转成了经典的命中概率问题。更一般地，命中时间、覆盖时间和访问次数都能用马尔可夫链的势理论语言描述。

## “自然起点”可能值得研究什么

Exploring Starts 给理论提供了干净的全覆盖条件，却把困难转移给了环境重置；$\epsilon$-greedy 不要求任意重置，却可能把大量轨迹花在抵达有价值区域的路上。两者之间似乎还有一个空间：不人为指定任意状态，而是从环境允许的一组自然重启状态中选择起点，并根据当前访问不足程度动态调整这个起点分布。

可以把它写成

$$
(S_0,A_0)\sim\mu_k,
$$

其中第 $k$ 轮的 $\mu_k$ 只能支持环境允许的起点，但会更偏向尚未充分评估、同时从真实任务中确实可达的区域。这不是一个已经完成的算法结论，只是一条研究路线。若要把它变成可靠方法，至少需要回答：

1. 哪些可达性条件足以替代 Exploring Starts 的全支撑假设？
2. 自适应改变起点会不会给价值估计带来不可控偏差？
3. 应该优化状态—动作覆盖、有效更新次数，还是到关键集合的命中时间？
4. 当 episode 很长时，是否应把重启机制与重要性采样或 off-policy 校正结合？

我喜欢这个问题，是因为它把“探索”从一个固定的随机按钮，变成了初始分布、转移结构和访问目标之间的几何关系。MC 的表格算法今天未必是大型系统的主角，但它们仍然给出了一间足够简单的实验室，让这些问题可以被清楚地写出来。

## 参考资料

- Richard S. Sutton and Andrew G. Barto, [*Reinforcement Learning: An Introduction*, second edition](https://incompleteideas.net/book/RLbook2020.pdf), Chapter 5.
- MIT Press, [book information for *Reinforcement Learning: An Introduction*](https://mitpress.mit.edu/9780262039246/reinforcement-learning/).
