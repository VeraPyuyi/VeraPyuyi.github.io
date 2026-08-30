---
title: 关于 SGD 轨迹与 Zigzag 偏序集的一些想法
summary: 把随机梯度轨迹投影为次序模式，探索 fence 偏序集、局部振荡、参数可识别性与真实神经网络之间的距离。
publishedAt: "2026-08-24 02:37:52"
language: zh
translationKey: sgd-zigzag-posets
routeSlug: sgd-zigzag-posets
keywords:
  - stochastic gradient descent
  - zigzag poset
  - ordinal pattern
  - fence poset
  - edge of stability
draft: false
featured: true
comments: true
cover: /uploads/blogs/sgd-zigzag-posets/cover.png
coverAlt: 蓝粉长发的原创研究者绘制损失地形上交替升降的发光 SGD 轨迹，星猫在一旁测量节点
order: 300
---

mini-batch 梯度带有噪声：这一批数据可能让参数向一个方向移动，下一批又把它推回来，把训练曲线画出来，局部常会出现

$$
\searrow\nearrow\searrow\nearrow
$$

一样的摆动。

它与我之前研究的 zigzag 偏序集看起来很像，但看起来像可能并不足以构成数学联系。真正的第一步，是承认神经网络参数位于高维空间，而偏序关系需要作用在标量上。

## 先选择一个可比较的观测量

令参数为 $\theta_t\in\mathbb R^d$，高维向量之间没有天然的大小次序，因此不能直接写 $\theta_1<\theta_2>\theta_3$。我们必须先选定一个观测方向或函数，例如

$$
x_t=\langle v,\theta_t-\bar\theta\rangle,
$$

其中 $v$ 可以是固定随机方向、某个 Hessian 特征方向或由验证样本定义的函数空间方向。然后上升—下降词

$$
x_1<x_2>x_3<x_4>\cdots
$$

才精确对应一条交替定向路径，也就是 zigzag / fence poset 的序关系事件。

简单检索了一下，发现这类只保留相对次序、忽略绝对幅度的方法，在时间序列研究中称为 ordinal pattern。Bandt 与 Pompe 在 permutation entropy 中系统使用相邻观测的排序模式。因而，用上升下降模式分析 SGD 本身也不算是全新概念。可能有价值的地方，是把随机优化特有的动力学参数，与 fence pattern 的完整分布联系起来。

## 从梯度符号到局部峰谷

普通 SGD 满足

$$
\theta_{t+1}=\theta_t-\eta g_{B_t}(\theta_t).
$$

投影到固定方向 $v$，令 $u_t=\langle v,g_{B_t}(\theta_t)\rangle$，就有

$$
x_{t+1}-x_t=-\eta u_t.
$$

因此，$x_t<x_{t+1}>x_{t+2}$ 等价于相邻两个投影梯度从负变正，轨迹的峰谷不是抽象装饰，而是在给定方向上记录梯度符号怎样翻转。

长度三的 turning rate 只能告诉我们反向有多频繁，而更长的 fence word 还能区分连续前进、短促摆动和多次刷新极值等不同结构，例如两个序列可能拥有相同的符号翻转次数，却具有完全不同的振幅衰减和 record 结构。

我此前关于 fence order polynomial 的工作给出了一个组合背景：对路径方向 $\varepsilon\in\{+,-\}^{n-1}$ 所定义的 fence $P_\varepsilon$，greedy record 的生成函数与序多项式存在精确关系

$$
\sum_{\pi\in S_n}t^{\operatorname{rec}_\varepsilon(\pi)}
=n!\,\Omega(P_\varepsilon;t).
$$

这项已公开结果讨论的是组合对象本身，因此把它用于训练轨迹，需要额外建立概率模型、统计估计和可验证的优化含义，不能仅凭符号相似就宣称迁移完成。

## 一个可以算清楚的局部模型

沿固定 Hessian 特征方向，在局部二次且噪声近似平稳的理想化条件下，普通 SGD 可写成

$$
X_{t+1}=(1-q)X_t+\varepsilon_{t+1},\qquad q=\eta\lambda.
$$

当创新噪声为独立 Gaussian 且 $0<q<2$ 时，这是平稳 AR(1) 模型，相邻增量的相关系数为 $-q/2$，Gaussian 符号的 arcsine 关系给出 turning probability

$$
p_{\mathrm{turn}}(q)
=\frac12+\frac1\pi\arcsin\left(\frac q2\right).
$$

于是可形式上反演

$$
q=2\sin\left[\pi\left(p_{\mathrm{turn}}-\frac12\right)\right].
$$

这个小计算说明了从轨迹形状估计局部动力学参数并非纯口嗨，但它远不等于在真实网络中估计 Hessian：方向 $v$ 是否固定、噪声是否 Gaussian、曲率是否缓慢变化、窗口是否近似平稳，都会影响结论。

对带 momentum 的二阶递推，三点窗口往往只暴露参数组合，而不足以分别识别学习率—曲率乘积与动量，而四点窗口提供更多符号相关信息，可能成为最小可识别窗口。这是正在发展的理论方向；在完成模型外鲁棒性和实验验证前，更适合把它看作精确简化模型中的线索，而不是对现代神经网络的普遍定理。

## 它可能带来什么

ordinal statistic 的吸引力在于它对单调重标定不敏感，也不需要精确比较不同层的绝对尺度，它可能用于：

- 区分某个方向上的持续漂移与频繁反向；
- 构造不依赖振幅的训练阶段变化检测；
- 以很小的在线状态估计局部相关结构；
- 比较不同学习率、batch size 和 momentum 下的轨迹模式。

但它主动丢弃了幅度信息，把整条轨迹乘以正数不会改变任何次序模式，因此仅靠 ordinal data 不可能恢复噪声尺度，进一步，有限窗口还会受到 ties、量化、重叠样本相关性以及方向选择偏差影响。

Edge of Stability 的实验研究已经表明，神经网络的 full-batch gradient descent 可能在短时间尺度呈现非单调损失，同时长期仍然下降，它说明振荡不等于训练立刻失败，却还没有证明 mini-batch SGD 的 fence pattern 由同一机制产生，真正可信的研究需要把曲率驱动、噪声驱动和动量驱动的模式放在同一套受控实验中比较。

对我而言，这个方向最有意思的地方是建立一条有明确失效条件的链：

$$
\text{局部优化动力学}
\longrightarrow
\text{ordinal pattern distribution}
\longrightarrow
\text{可识别参数与统计误差}.
$$

若这条链只能在 Gaussian 二次模型中成立，它仍是一项清楚的数学练习，但若它能在缓慢非平稳、非 Gaussian 和混合方向下给出稳定误差界，就有可能变成真正有用的训练诊断工具。

## 参考资料

- Christoph Bandt and Bernd Pompe, [Permutation Entropy: A Natural Complexity Measure for Time Series](https://doi.org/10.1103/PhysRevLett.88.174102), *Physical Review Letters* 88 (2002).
- Jeremy M. Cohen et al., [Gradient Descent on Neural Networks Typically Occurs at the Edge of Stability](https://arxiv.org/abs/2103.00065), ICLR 2021.
- Pyuyi Chufeng Huang, [Greedy Records and Bernstein Transfers for Fence and Circular-Fence Order Polynomials](https://arxiv.org/abs/2607.22767).
