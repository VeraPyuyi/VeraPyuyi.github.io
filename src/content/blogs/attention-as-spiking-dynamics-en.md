---
title: Some Thoughts on Attention and Spiking Dynamics in SNNs
summary: Separating attention modules from attention functions, then exploring a constrained route through excitatory–inhibitory competition, spike measures, and causal operators.
publishedAt: "2026-08-30 12:00:00"
language: en
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
coverAlt: The original blue-and-pink-haired researcher balances warm excitatory spikes and cool inhibitory waves as her star cat follows the selected causal path.
order: 100
---

“Can mathematics prove that attention is completely unnecessary in an SNN?” is an attractive question that is easy to overstate. My view is that explicit $QK^\top$, Softmax, and attention matrices need not be the only way for a spiking network to perform content selection. Yet attention as a computational function—selecting and aggregating relevant history in response to the current query—does not disappear merely because the named module is removed.

A more defensible research question is:

> Under explicit assumptions on tasks, timescales, and resources, can attention computations be compiled into recurrent excitatory–inhibitory spiking dynamics? What are the approximation error, stability cost, and capacity cost?

## A module may disappear while its function remains

Standard causal attention can be written as

$$
a_{t,s}=q_t^\top k_s,\qquad
p_{t,s}=\frac{\exp(a_{t,s}/\tau)}{\sum_{r\le t}\exp(a_{t,r}/\tau)},\qquad
y_t=\sum_{s\le t}p_{t,s}v_s.
$$

It performs at least three operations: compute query relevance, make historical candidates compete, and read their weighted information. An SNN may avoid an explicit matrix product and an explicit Softmax. If it still selects history according to the current input, it implements some form of attention in the functional sense.

Existing work supports this cautious distinction. Spikformer builds a spiking self-attention mechanism from spike-form queries, keys, and values without Softmax. Spike-driven Transformer further reformulates relevant operations as masks and sparse additions. These results show that the implementation can change substantially; they do not prove that a fixed-size recurrent SNN can losslessly replace attention for every content-addressing task.

## Softmax as a competitive equilibrium

For relevance drives $a=(a_1,\ldots,a_n)$, Softmax is the unique solution of

$$
p^*=\operatorname*{argmax}_{p\in\Delta_n}
\left\{a^\top p+\tau H(p)\right\},
$$

where

$$
H(p)=-\sum_i p_i\log p_i.
$$

This creates an entry point for an excitatory–inhibitory interpretation. Local excitation maintains candidates that match the current query; shared inhibition limits total activity and induces normalized competition. One continuous-time candidate is

$$
\dot p_i=p_i\left[g_i(p)-\sum_jp_jg_j(p)\right],
\qquad g_i(p)=a_i-\tau\log p_i.
$$

Under ideal conditions, its equilibrium is Softmax; as $\tau$ decreases, competition approaches winner-take-all behavior. A meaningful theorem would need more than equality at equilibrium. It should provide a tracking error of the form

$$
\|\widehat p(t)-p^*(a(t))\|
\le C_1e^{-\gamma t}
+C_2\frac{\|\dot a\|_\infty}{\gamma}
+C_3\varepsilon_{\mathrm{spike}}
+C_4\varepsilon_{\mathrm{delay}}.
$$

The terms represent transient convergence, query variation, finite-spike approximation, and synaptic delay. This inequality is a target form for a theory, not a result proved in this essay.

## Replace nested spike sums with spike measures

SNN descriptions often expand every layer, time step, and past spike, quickly producing unreadable nested sums. A more compact starting point is to represent neuron $j$'s spike train as a counting measure

$$
\mu_j(ds)=\sum_k\delta_{t_{j,k}}(ds).
$$

Synaptic current becomes

$$
I_i(t)=I_i^{\mathrm{ext}}(t)
+\sum_jW_{ij}\int_{[0,t)}h_{ij}(t-s)\,\mu_j(ds).
$$

The convolution $(h_{ij}*\mu_j)(t)$ compresses “iterate over every historical spike” into a causal operator. A layer may be abstracted as

$$
\mathcal S_{\theta,W}:\mu_{\mathrm{in}}\mapsto\mu_{\mathrm{out}},
$$

and depth becomes operator composition:

$$
\mathcal S=\mathcal S_L\circ\cdots\circ\mathcal S_1.
$$

Feedback can be written as a fixed-point problem

$$
x=\mathcal G[\mu_{\mathrm{in}}]+\mathcal K[\sigma(x)].
$$

If $\operatorname{Lip}(\sigma)\|\mathcal K\|<1$, the contraction theorem gives uniqueness. Near a linearization, the resolvent

$$
(I-\mathcal K D\sigma)^{-1}
=\sum_{m=0}^{\infty}(\mathcal K D\sigma)^m
$$

collects repeated trips through the feedback loop into one expression. This language is not intended to erase concrete neuron equations. It supplies a compositional interface for existence, stability, approximation error, and depth.

Boerlin, Machens, and Denève's balanced spiking network offers an important precedent: a spiking network can be derived from a prediction-error objective and made to implement a linear dynamical system. Thus, “spiking dynamics can correspond to optimization” is not a new conjecture. New work must address query-dependent dynamic competition rather than merely restating that SNNs can optimize.

## Context, capacity, and continual-learning limits

Composing temporal kernels may enlarge a receptive field, but a longer receptive field is not lossless memory. In

$$
\dot x=Ax+Bu,
$$

the effect of past input is controlled by $e^{A(t-s)}B$. Eigenvalues far from the imaginary axis give stability but rapid forgetting; near-critical dynamics retain memory longer while increasing noise amplification and stability risk.

There is also a capacity problem. Standard attention preserves many historical objects that can be queried separately, whereas a fixed-dimensional state compresses them. If a task requires exact indexed retrieval over arbitrarily long sequences, a finite-precision, fixed-size SNN cannot store all history for free. It must add neurons, synaptic state, timing precision, external memory, or approximation error.

Context and continual learning should also be separated. Fast membrane potentials and synaptic currents may hold context; continual learning changes slower weights while protecting old knowledge. Feedback and inhibition may route inputs into different neural populations, but they do not automatically eliminate catastrophic forgetting.

## A credible theory needs positive and negative results

The useful destination is not a declaration that attention is obsolete. It is a set of results with visible boundaries:

1. Which E–I spiking networks approximate entropy-regularized, sparse, or hard attention?
2. How does error depend on neuron count, firing rate, delay, noise, and query speed?
3. How does depth alter the effective memory kernel and temporal receptive field?
4. What trade-off between stability and context length is unavoidable?
5. Which sparse, low-rank, or finite-window tasks permit an event-complexity advantage?
6. Which indexed or associative-recall tasks force state capacity to grow with sequence length?
7. How should fast context state be separated from slow continual learning?

The desired “conceptual unbinding” is therefore not the rejection of every existing structure. It is a better descriptive language: place spikes, feedback, competition, and memory inside composable causal operators, then state honestly when attention can be compiled, when it can only be approximated, and when fixed state cannot replace it at all.

## References

- Zhaokun Zhou et al., [Spikformer: When Spiking Neural Network Meets Transformer](https://arxiv.org/abs/2209.15425).
- Man Yao et al., [Spike-driven Transformer](https://arxiv.org/abs/2307.01694).
- Martin Boerlin, Christian K. Machens, and Sophie Denève, [Predictive Coding of Dynamical Variables in Balanced Spiking Networks](https://doi.org/10.1371/journal.pcbi.1003258), *PLOS Computational Biology* 9 (2013).
