---
title: Some Thoughts on SGD Trajectories and Zigzag Posets
summary: Projecting stochastic-gradient trajectories into ordinal patterns, and examining what fence posets may reveal—and fail to reveal—about local optimization dynamics.
publishedAt: "2026-08-30 12:00:00"
language: en
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
order: 300
---

Mini-batch gradients are noisy. One batch may push parameters in one direction and the next may push them back. A local training trace can therefore resemble

$$
\searrow\nearrow\searrow\nearrow.
$$

This looks like a zigzag poset, but visual resemblance is not yet mathematics. The first necessary correction is that neural-network parameters live in a high-dimensional space, whereas an order relation requires scalar quantities.

## Choose a comparable observable first

Let $\theta_t\in\mathbb R^d$. There is no canonical order between high-dimensional parameter vectors, so expressions such as $\theta_1<\theta_2>\theta_3$ have no immediate meaning. We must first select an observable, for example

$$
x_t=\langle v,\theta_t-\bar\theta\rangle,
$$

where $v$ may be a fixed random direction, a Hessian eigendirection, or a function-space direction defined by validation examples. Only then does

$$
x_1<x_2>x_3<x_4>\cdots
$$

become exactly the order event associated with an alternating oriented path—a zigzag or fence poset.

Methods that retain relative order while discarding amplitude are known as ordinal-pattern methods in time-series analysis. Bandt and Pompe systematically used neighboring rank patterns to define permutation entropy. “Analyze SGD through rises and falls” is therefore not a new concept by itself. A potentially new contribution would have to connect optimization-specific parameters to the complete distribution of fence patterns.

## From gradient signs to local extrema

Ordinary SGD obeys

$$
\theta_{t+1}=\theta_t-\eta g_{B_t}(\theta_t).
$$

For a fixed direction $v$, define $u_t=\langle v,g_{B_t}(\theta_t)\rangle$. Then

$$
x_{t+1}-x_t=-\eta u_t.
$$

Consequently, $x_t<x_{t+1}>x_{t+2}$ is equivalent to two consecutive projected gradients switching from negative to positive. Local extrema in the projected trajectory record directional sign changes rather than serving as decorative zigzags.

A length-three turning rate tells us only how frequently direction reverses. Longer fence words can distinguish runs, short oscillations, and repeated record-setting patterns. Two trajectories may have the same number of sign changes while exhibiting very different decay and record structures.

My earlier work on fence order polynomials provides one combinatorial background. For the fence $P_\varepsilon$ defined by an orientation $\varepsilon\in\{+,-\}^{n-1}$, a greedy-record statistic satisfies

$$
\sum_{\pi\in S_n}t^{\operatorname{rec}_\varepsilon(\pi)}
=n!\,\Omega(P_\varepsilon;t).
$$

That public result concerns the combinatorial objects themselves. Applying it to training trajectories requires an additional probabilistic model, statistical estimators, and an optimization interpretation that can be tested. Symbolic similarity alone does not complete the transfer.

## A local model that can be calculated exactly

Along a fixed Hessian eigendirection, under an idealized locally quadratic and approximately stationary model, SGD takes the form

$$
X_{t+1}=(1-q)X_t+\varepsilon_{t+1},\qquad q=\eta\lambda.
$$

With independent Gaussian innovations and $0<q<2$, this is a stationary AR(1) process. Consecutive increments have correlation $-q/2$, and the Gaussian arcsine relation yields

$$
p_{\mathrm{turn}}(q)
=\frac12+\frac1\pi\arcsin\left(\frac q2\right).
$$

Formally, this can be inverted as

$$
q=2\sin\left[\pi\left(p_{\mathrm{turn}}-\frac12\right)\right].
$$

This small calculation shows that estimating local dynamics from trajectory shape is more than a metaphor. It does not, however, amount to estimating a real network's Hessian. Whether $v$ remains fixed, the noise is Gaussian, curvature changes slowly, and a window is approximately stationary all matter.

For a second-order recurrence with momentum, a three-point window often reveals only a combination of parameters and cannot separately identify the learning-rate–curvature product and momentum. Four points provide additional sign correlations and may be the smallest identifiable window in the exact model. This remains a developing theoretical direction. Before robustness outside the model and empirical checks are complete, it should be treated as a clue from a tractable model rather than a universal theorem about modern networks.

## What it might provide—and what it cannot replace

Ordinal statistics are attractive because they are invariant under monotone rescaling and do not require absolute scales to match across layers. They may help to:

- separate sustained drift from frequent directional reversal;
- detect changes in training regimes without relying on amplitude;
- estimate local correlation structure with very little online state;
- compare trajectory patterns across learning rates, batch sizes, and momentum values.

But ordinal data deliberately discard amplitude. Multiplying an entire trajectory by a positive constant changes no ordinal pattern, so noise scale cannot be recovered from ordinal observations alone. Finite windows also face ties, quantization, dependence between overlapping samples, and bias introduced by choosing directions after observing the trajectory.

Edge-of-Stability experiments have shown that full-batch gradient descent on neural networks can exhibit nonmonotone loss over short timescales while still decreasing over long ones. This establishes that oscillation is not identical to immediate failure. It does not prove that fence patterns in mini-batch SGD arise from the same mechanism. A credible study must compare curvature-driven, noise-driven, and momentum-driven patterns under controlled conditions.

For me, the interesting goal is not another zigzag score but a chain with explicit failure conditions:

$$
\text{local optimization dynamics}
\longrightarrow
\text{ordinal-pattern distribution}
\longrightarrow
\text{identifiable parameters and statistical error}.
$$

If this chain survives only in a quadratic Gaussian model, it is still a clean mathematical exercise. If it admits stable error bounds under slowly changing curvature, non-Gaussian noise, and mixed projections, it may become a useful diagnostic for training dynamics.

## References

- Christoph Bandt and Bernd Pompe, [Permutation Entropy: A Natural Complexity Measure for Time Series](https://doi.org/10.1103/PhysRevLett.88.174102), *Physical Review Letters* 88 (2002).
- Jeremy M. Cohen et al., [Gradient Descent on Neural Networks Typically Occurs at the Edge of Stability](https://arxiv.org/abs/2103.00065), ICLR 2021.
- Pyuyi Chufeng Huang, [Greedy Records and Bernstein Transfers for Fence and Circular-Fence Order Polynomials](https://arxiv.org/abs/2607.22767).
