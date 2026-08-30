---
title: 关于 SNN 中注意力与脉冲动力学的一些想法
summary: 区分注意力模块与注意力功能，并尝试用兴奋—抑制竞争、脉冲测度和因果算子描述一种受限的动力学替代路线。
publishedAt: "2026-08-30 12:00:00"
language: zh
translationKey: attention-as-spiking-dynamics
routeSlug: attention-as-spiking-dynamics
keywords:
  - spiking neural network
  - attention
  - causal operator
  - excitation inhibition
  - neuromorphic computing
draft: false
featured: true
comments: true
cover: /uploads/blogs/attention-as-spiking-dynamics/cover.png
coverAlt: 蓝粉长发的原创研究者调节暖色兴奋脉冲与冷色抑制波，星猫跟随被点亮的因果神经路径
order: 100
---

“能否从数学上证明 attention 在 SNN 中完全不需要？”这是一个很有吸引力、也很容易说得过头的问题。我的判断是：显式的 $QK^\top$、Softmax 和注意力矩阵不一定是脉冲网络实现内容选择的唯一形式；但 attention 作为“根据当前查询，从历史状态中选择和汇聚相关信息”的计算功能，并不会因为模块名称消失而自动消失。

更稳妥的研究命题是：

> 在明确的任务结构、时间尺度和资源约束下，注意力计算能否被编译为带反馈的兴奋—抑制脉冲动力学？编译误差、稳定性和容量代价分别是多少？

## 模块可以消失，功能仍需被实现

标准 causal attention 可以写成

$$
a_{t,s}=q_t^\top k_s,\qquad
p_{t,s}=\frac{\exp(a_{t,s}/\tau)}{\sum_{r\le t}\exp(a_{t,r}/\tau)},\qquad
y_t=\sum_{s\le t}p_{t,s}v_s.
$$

它至少完成三件事：计算查询相关性、让候选历史相互竞争、读取被加权的信息。SNN 可以不用显式矩阵乘法，也可以不调用 Softmax；只要它仍根据当前输入选择历史，它就在功能意义上实现某种 attention。

现有工作也支持这种谨慎区分。Spikformer 使用 spike-form query、key 和 value 构造不带 Softmax 的 spiking self-attention；Spike-driven Transformer 进一步把相关操作设计为 mask 与稀疏加法。它们说明 attention 的实现形式可以显著改变，却没有证明所有内容寻址任务都能由固定规模的循环 SNN 无损替代。

## Softmax 可以被看成竞争平衡点

对相关性驱动 $a=(a_1,\ldots,a_n)$，Softmax 是熵正则优化

$$
p^*=\operatorname*{argmax}_{p\in\Delta_n}
\left\{a^\top p+\tau H(p)\right\}
$$

的唯一解，其中

$$
H(p)=-\sum_i p_i\log p_i.
$$

这给兴奋—抑制解释留下了入口：局部兴奋维持与当前查询更匹配的候选，共享抑制限制总活动并产生归一化竞争。一个连续时间候选动力学是

$$
\dot p_i=p_i\left[g_i(p)-\sum_jp_jg_j(p)\right],
\qquad g_i(p)=a_i-\tau\log p_i.
$$

在理想条件下，它的平衡点是 Softmax；当 $\tau$ 变小，竞争趋向 winner-take-all。真正有分量的定理不能只证明平衡点相同，还需要给出动态跟踪误差，例如

$$
\|\widehat p(t)-p^*(a(t))\|
\le C_1e^{-\gamma t}
+C_2\frac{\|\dot a\|_\infty}{\gamma}
+C_3\varepsilon_{\mathrm{spike}}
+C_4\varepsilon_{\mathrm{delay}}.
$$

这些项分别代表收敛瞬态、查询变化、有限脉冲近似和突触延迟。上式是一种目标形式，而不是这里已经证明的结果。

## 用脉冲测度替代逐层逐时刻求和

SNN 论文常把每个时间步、每层和每次脉冲全部展开，符号很快变得难以阅读。一个更紧凑的起点，是把第 $j$ 个神经元的脉冲序列写成计数测度

$$
\mu_j(ds)=\sum_k\delta_{t_{j,k}}(ds).
$$

突触电流统一写为

$$
I_i(t)=I_i^{\mathrm{ext}}(t)
+\sum_jW_{ij}\int_{[0,t)}h_{ij}(t-s)\,\mu_j(ds).
$$

卷积 $(h_{ij}*\mu_j)(t)$ 把“遍历历史脉冲”的嵌套求和压缩为一个因果算子。单层网络可抽象成

$$
\mathcal S_{\theta,W}:\mu_{\mathrm{in}}\mapsto\mu_{\mathrm{out}},
$$

深层网络对应算子复合

$$
\mathcal S=\mathcal S_L\circ\cdots\circ\mathcal S_1.
$$

反馈则可以写成不动点问题

$$
x=\mathcal G[\mu_{\mathrm{in}}]+\mathcal K[\sigma(x)].
$$

若 $\operatorname{Lip}(\sigma)\|\mathcal K\|<1$，压缩映射给出唯一性。在线性化附近，预解算子

$$
(I-\mathcal K D\sigma)^{-1}
=\sum_{m=0}^{\infty}(\mathcal K D\sigma)^m
$$

把信号绕反馈回路传播多次的过程收进一个表达式。这套语言并非要取代具体神经元方程，而是为存在性、稳定性、逼近误差和组合提供统一接口。

Boerlin、Machens 与 Denève 的 balanced spiking network 已经展示了一个重要先例：脉冲网络可以从预测误差最小化原则导出，并实现线性动力系统。它证明“脉冲动力学可以对应优化问题”并不是新的猜想。新的工作必须进一步处理查询依赖的动态竞争，而不是仅仅重述 SNN 能做优化。

## 上下文、容量与持续学习的限制

逐层卷积可以扩大时间感受野，但更长的感受野不等于无损记忆。在线性系统

$$
\dot x=Ax+Bu
$$

中，历史输入的影响由 $e^{A(t-s)}B$ 决定。特征值远离虚轴时系统稳定却遗忘很快；接近临界时记忆变长，但噪声放大和稳定性风险也会增加。

更根本的问题是容量。标准 attention 保留了许多可分别查询的历史对象，而固定维度状态会把它们压缩。如果任务要求对任意长序列进行精确索引读取，有限精度、固定规模的 SNN 不可能免费保存全部历史；它必须增加神经元、突触状态、时间精度、外部记忆或允许误差。

上下文记忆和持续学习也不是同一件事。前者可以存在于快速膜电位和突触电流中，后者需要较慢的权重更新与旧知识保护。反馈和抑制可能帮助不同输入路由到不同神经元群，却不会自动消除灾难性遗忘。

## 一套可信理论应同时包含正面结果与不可能性

我希望看到的理论不是“attention 已经过时”的宣言，而是一组边界清楚的结果：

1. 哪类 E–I 脉冲网络能近似熵正则、稀疏或硬 attention？
2. 误差怎样依赖神经元数、放电率、延迟、噪声和查询变化速度？
3. 深度如何改变有效记忆核与时间感受野？
4. 稳定性与上下文长度之间有什么不可避免的权衡？
5. 哪些稀疏、低秩或有限窗口任务允许事件复杂度优势？
6. 哪些索引和关联回忆任务要求状态容量随序列长度增长？
7. 快状态的上下文与慢状态的持续学习怎样分离？

这条路线真正想“解绑”的不是所有既有结构，而是描述方式：把脉冲、反馈、竞争和记忆放进可以组合的因果算子语言，再诚实地说明 attention 何时能够被编译、何时只能被近似，以及何时根本不能被固定状态替代。

## 参考资料

- Zhaokun Zhou et al., [Spikformer: When Spiking Neural Network Meets Transformer](https://arxiv.org/abs/2209.15425).
- Man Yao et al., [Spike-driven Transformer](https://arxiv.org/abs/2307.01694).
- Martin Boerlin, Christian K. Machens, and Sophie Denève, [Predictive Coding of Dynamical Variables in Balanced Spiking Networks](https://doi.org/10.1371/journal.pcbi.1003258), *PLOS Computational Biology* 9 (2013).
