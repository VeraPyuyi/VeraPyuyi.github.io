---
title: 关于势函数与潜在空间拓扑的一些想法
summary: 从反复编码—解码产生的潜在动力学出发，区分局部旋转与全局拓扑障碍，思考势函数、万有覆叠和 Hodge 分解各自能解释什么。
publishedAt: "2026-08-31T14:04:43Z"
updatedAt: "2026-10-30T14:34:14Z"
language: zh
translationKey: potential-functions-latent-topology
routeSlug: potential-functions-latent-topology
category: inspirations
keywords:
  - latent dynamics
  - potential functions
  - universal cover
  - Hodge decomposition
  - attractors
draft: false
featured: true
comments: true
cover: /uploads/blogs/potential-functions-latent-topology/cover.png
coverAlt: 蓝粉长发的原创研究者与星猫观察带孔圆盘上的环路及其提升后的螺旋轨迹，旁边保留独立的旋转流模型
order: 700
---

势函数是一个很有吸引力的语言：如果复杂变化能够被画成一片地形，我们似乎就能通过山谷、坡度和吸引子理解模型在做什么。但我越来越在意，这幅地形究竟是从哪里来的，以及什么情况下根本不存在一张全局一致的地形。

[关于神经模型潜在动力学的这项工作](https://arxiv.org/abs/2505.22785v4)，从反复编码与解码的映射研究潜在轨迹，给了我继续追问的起点。这里讨论的是状态怎样演化，和另一篇[采样与能量视角](/blogs/llm-sampling-energy-view/)中的概率分布问题并不相同。

## 先把迭代定义清楚

对一个编码器和解码器，可以考虑

$$
F(z)=E_{\mathrm{enc}}(D(z)),\qquad v(z)=F(z)-z.
$$

随后观察 $z_{t+1}=F(z_t)$。固定点与轨迹都依赖于这个具体映射：改变模型、归一化、输入方式或迭代规则，就可能改变研究对象。

尤其对语言模型，把隐藏表示反复送回某个网络模块，是人为选定的一种探测实验，不能直接等同于模型原本的自回归生成。即使相邻状态越来越接近，也还不能据此断言语义越来越正确、所有初值都会收敛，或者终点就是一个已经验证过的稳定吸引子。

## 什么时候存在势函数

如果在指定度量下，连续近似满足 $v=-\nabla E$，那么沿着相应连续轨迹有

$$
\frac{d}{dt}E(z(t))=-\|\nabla E(z(t))\|^2.
$$

但这需要梯度结构，而不是对任意网络都成立。离散迭代即使具有梯度形式，也还需要检查步长和稳定性，才能讨论能量是否下降。

用微分形式可以更清楚地区分障碍。设潜在状态位于光滑黎曼流形 $M$，令 $\alpha=v^\flat$。全局势函数要求

$$
\alpha=-dE\ \Longrightarrow\ d\alpha=0.
$$

反方向在一般空间上未必成立。局部闭性与全局恰当性不是同一件事：既可能局部已经存在旋转，也可能局部没有旋转，却因为空间拓扑而无法定义单值的全局势。

## 万有覆叠能改变什么

考虑去掉原点的平面上的一形式

$$
\alpha=\frac{-y\,dx+x\,dy}{x^2+y^2},
\qquad
\oint_{S^1}\alpha=2\pi.
$$

它是闭的，但不是全局恰当的。把角度展开到万有覆叠上，原本只能模 $2\pi$ 观察的绕行可以被连续记录，此时拉回的一形式成为 $d\theta$，按上面的负梯度约定，可取势函数 $\widetilde E=-\theta$。

这说明覆叠可以处理一类全局拓扑障碍，不说明它能够消除所有非保守性。对覆叠映射 $p:\widetilde M\to M$，有

$$
d(p^*\alpha)=p^*(d\alpha).
$$

覆盖映射局部是微分同胚，因此原本非零的局部旋转不会因为提升而消失。例如在平面上取

$$
\alpha_0=-y\,dx+x\,dy,\qquad
d\alpha_0=2\,dx\wedge dy\ne0.
$$

这与前一个角度形式完全不同。不能把它们都叫作“非保守场”，再期待同一种拓扑操作解决全部问题。

这里使用的是光滑流形上的一形式与通常的光滑万有覆叠。单连通性对闭一形式的恰当性有作用，并不意味着所有阶数的闭形式都自动恰当。

## 先分解，再谈解释

在紧致、无边界、定向的光滑黎曼流形上，Hodge 分解提供了一种标准框架：

$$
\alpha=d\phi+\delta\psi+h,\qquad \Delta h=0.
$$

其中三部分分别是恰当、余恰当与调和分量。[Tong 的讲义](https://www.damtp.cam.ac.uk/user/tong/gr/grhtml/S3.html)给出了相关几何背景。若把梯度部分写成负梯度，令 $E=-\phi$ 即可；另外两部分并不会因此自动消失。

对实际模型，这首先是一种待检验的分析框架。数据采样形成的有效空间可能带边界、噪声与不完整覆盖；采用其他度量或边界条件，也会影响分解。不能直接把闭流形上的定理当成某个隐藏状态点云已经满足的结论。

神经网络的外部隐藏状态空间通常还是欧氏空间。我们想研究的“洞”可能来自数据形成的有效结构，而不是参数维数本身；是否稳定存在，需要随样本、尺度与扰动检查。

## 一个更谨慎的研究入口

我想先研究可操作的诊断，而不是声称已经找到提高语言模型能力的新算法。可以在固定模型和固定迭代定义下，记录不同来源的初值轨迹，考察终点、残差、环流与扰动后的变化。

在选定的欧氏坐标中，Jacobian 的非对称部分可以作为局部非梯度性的线索；环路积分与跨尺度稳定的结构，才可能帮助区分更全局的障碍。估计误差、坐标选择和维度约简都需要控制。

随后才值得问：这些量能否在严格的留出测试上，与记忆、泛化或异常轨迹建立稳定联系？与简单的距离、残差和置信度基线相比，有没有额外价值？目前这些仍是我的研究问题，不是已经验证的检测能力。

我喜欢拓扑在这里提供的一种提醒：两条路即使抵达相近的位置，也未必有相同的历史。但要让这个提醒变成有用的模型诊断，还需要一步步证明，我们看到的究竟是结构，还是表示与测量留下的影子。

## 参考资料

- Marco Fumero et al., [Navigating Latent Space Dynamics, v4](https://arxiv.org/abs/2505.22785v4).
- David Tong, [Introducing Riemannian Geometry](https://www.damtp.cam.ac.uk/user/tong/gr/grhtml/S3.html).
- Vladimir G. Ivancevic and Tijana T. Ivancevic, [Undergraduate Lecture Notes in De Rham-Hodge Theory](https://arxiv.org/abs/0807.4991).
