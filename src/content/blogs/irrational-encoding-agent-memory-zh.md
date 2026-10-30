---
title: 关于无理数编码与 Agent 记忆的一些想法
summary: 把有限信息放进一个无理数并不困难；真正值得区分的是可逆编码、存储压缩，以及 Agent 能否按需读到正确的记忆。
publishedAt: "2026-10-29T18:18:30Z"
updatedAt: "2026-10-30T14:34:14Z"
language: zh
translationKey: irrational-encoding-agent-memory
routeSlug: irrational-encoding-agent-memory
category: inspirations
keywords:
  - irrational encoding
  - information theory
  - agent memory
  - lossless compression
  - RAG
draft: false
featured: true
comments: true
cover: /uploads/blogs/irrational-encoding-agent-memory/cover.png
coverAlt: 蓝粉长发的原创研究者与星猫在晨光档案室观察可逆编码装置和按需开启的记忆抽屉
order: 1000
---

我有过一个有点绕远路的想法：先把一段信息压成二进制，再把这些位安排进某个无理数的小数部分。这样，一整段历史是不是就能被收进“一个数”里？如果把它交给 Agent，又能不能成为一种更轻巧的长期记忆？

这个想法可以变成严格的数学构造，但“可逆地表示出来”和“真正节省资源”是两件不同的事。我更愿意先把它们拆开，再看哪些部分值得继续做。

## 一个可逆的构造

设压缩后的有限位串长度为 $\ell$，对应整数为 $N$，并保留它的长度，包括可能的前导零。取一个固定的无理数偏移，就可以定义

$$
0\le N<2^\ell,\qquad \beta=\sqrt2-1,\qquad x=\frac{N+\beta}{2^\ell}.
$$

这里 $x$ 是无理数，而且落在 $(0,1)$ 内。给定 $\ell$ 和精确的 $x$，可以恢复

$$
N=\left\lfloor 2^\ell x\right\rfloor.
$$

之后把 $N$ 补回 $\ell$ 位，再调用原来的解压器，就能回到最初的信息。无理数偏移的作用，是让这个对象确实具有无理性；它没有额外承担消除冗余的工作。

计算机也不必真的保存无限多位小数。可以保存定义它的有限描述：长度、整数、固定偏移的约定，以及压缩格式。这个区别很重要：一个可以被有限描述的无理数，不等于一份无需存储内容的档案。

## 一个数仍然需要精度

如果用近似值 $\widehat x$ 代替精确的 $x$，恢复结果就依赖误差。一个充分条件是

$$
\lvert\widehat x-x\rvert
<2^{-\ell}\min\{\beta,1-\beta\}.
$$

因为放大后的误差不能跨过相邻整数边界。$\ell$ 越大，所需精度就越高；不能把任意长的信息装进一个固定精度的浮点数，再期待它总能完整回来。

同样，“十进制字符更少”不能直接当作压缩率。进制改变了每个字符能区分的状态数，并没有自动减少信息。Shannon 的[原始论文](https://people.math.harvard.edu/~ctm/home/text/others/shannon/entropy/entropy.pdf)提供了信息度量的基础，而这里最简单的边界甚至只需要计数：所有 $n$ 位串有 $2^n$ 种，长度小于 $n$ 的二进制串加起来只有 $2^n-1$ 种，不可能一一容纳前者。

真正的压缩收益仍然来自重复、结构或可预测性，也需要把解码器与其他共享信息的成本计入比较。

## Agent 要的是什么记忆

把这个构造放进 Agent 系统后，我发现“压缩”这个词至少覆盖了四个不同目标。

| 目标 | 应该实际测量什么 |
| --- | --- |
| 节省外部存储 | 正文、索引、摘要、版本信息的总字节数 |
| 节省上下文 | 每次任务真正送进模型的 token 数 |
| 降低读取成本 | 检索、解码、重排和模型读取的时间 |
| 改善长期记忆 | 找回正确事实、识别更新与完成后续任务的能力 |

一个无损压缩包可以很小，但每次全部解压后重新放回 Prompt，并没有减少模型需要读的历史。反过来，外部档案没有压缩，只要每次取回少量相关证据，也可能显著缩短当前输入。

[MemGPT](https://arxiv.org/abs/2310.08560)把有限的主上下文与外部记忆分开管理，给了我一个更贴近工程的观察角度：不只问“历史放在哪里”，还要问“本次决策需要搬进来哪些内容”。这不意味着把上下文在物理上变成无限长。

把无理数的小数表示直接交给模型，也不会自动赋予模型可靠的解码能力。短小的记忆编号可以很有用，但它通常是一个访问地址，完整内容和读取程序依然需要存在。

## 把档案与检索分开

我目前更愿意尝试一种分块结构：每块记忆同时拥有检索信息、可读摘要，以及能够精确恢复的原始记录。无理数编码如果要加入，比较自然的位置是最后这一层。

设原始记忆块为 $H_i$，压缩器为 $C$，从码字中取得长度与整数：

$$
w_i=C(H_i),\qquad
x_i=\frac{N_i+\beta}{2^{\ell_i}}.
$$

检索先通过实体、关键词、时间或向量找到块的编号，再决定读取摘要、局部证据还是原文。不能仅凭 $\lvert x_i-x_j\rvert$ 很小，就认为两条记忆语义相近：可逆编码没有提供这样的几何保证。

压缩检索向量又是另一个问题。[Faiss 的官方文档](https://github.com/facebookresearch/faiss/wiki/Faiss-indexes)列出了乘积量化等向量编码方式。它们针对的是检索表示及其距离计算，不能与原始正文的无损保存混为一谈。

分块大小同样需要实验。大块比较容易利用跨段重复，小块更方便随机读取和局部更新；索引、校验和版本信息也会占空间。应该统计的是

$$
B_{\mathrm{total}}
=B_{\mathrm{payload}}+B_{\mathrm{index}}
+B_{\mathrm{summary}}+B_{\mathrm{metadata}}.
$$

只报告正文压缩率，很容易把真正的系统成本藏起来。

## 下一步该验证什么

这还不是一个已经证明优于现有记忆系统的方法。我想先比较相同资料、相同检索器下的几种存储和读取方式：原文分块、普通无损压缩分块，以及带有无理数表示的同一码字。

需要分别检查逐字恢复、局部读取延迟、总存储、输入 token、事实更新与后续任务表现。若无理数表示没有带来可测量的额外价值，也应该接受它只是一个有趣、严格的编码外壳，而不是把数学对象的新鲜感当作性能收益。

对我来说，更值得留下的问题是：如何既不丢掉完整历史，又不让 Agent 每一次都重新读完它。这也连接到另一篇[关于分层记忆架构的想法](/blogs/agent-layered-memory/)。

## 参考资料

- Claude E. Shannon, [A Mathematical Theory of Communication](https://people.math.harvard.edu/~ctm/home/text/others/shannon/entropy/entropy.pdf).
- Charles Packer et al., [MemGPT: Towards LLMs as Operating Systems](https://arxiv.org/abs/2310.08560).
- Faiss maintainers, [Faiss indexes](https://github.com/facebookresearch/faiss/wiki/Faiss-indexes).
