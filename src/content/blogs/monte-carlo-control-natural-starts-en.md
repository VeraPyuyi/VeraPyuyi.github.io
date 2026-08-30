---
title: Some Thoughts on Monte Carlo Control and Natural Starts
summary: A route from Basic MC, Exploring Starts, and ε-greedy control to initial distributions, biased random walks, hitting probabilities, and natural starts.
publishedAt: "2026-08-30 12:00:00"
language: en
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
order: 500
---

When I first encountered Monte Carlo control, Basic MC, Exploring Starts, and $\epsilon$-greedy control looked like three unrelated algorithms to memorize. I now find it more useful to see them as three answers to one question: when the environment model is unknown and returns are observed only after an episode, how can we make sure that the state–action pairs worth evaluating are actually visited?

## One backbone, three exploration mechanisms

Write an episode as

$$
S_0,A_0,R_1,S_1,A_1,\ldots,S_T,
$$

with discounted return

$$
G_t=R_{t+1}+\gamma R_{t+2}+\gamma^2R_{t+3}+\cdots.
$$

Monte Carlo methods use realized complete-trajectory returns to estimate $q_\pi(s,a)$ and then improve the policy. All three variants share this sampling–evaluation–improvement backbone. They differ mainly in where exploration enters.

| Method | How exploration happens | Main limitation |
| --- | --- | --- |
| Basic MC | Start separately from state–action pairs to be evaluated | Requires strong reset access and wastes many trajectories |
| MC Exploring Starts | Randomize the initial state–action pair, giving every pair a chance to start an episode | Arbitrary initialization is rarely available in the physical world |
| MC $\epsilon$-greedy | Keep the task's ordinary initialization and randomize actions along the trajectory | Random exploration can be slow, and fixed $\epsilon$ keeps choosing inferior actions forever |

“Basic MC” is not a universally standardized algorithm name. It is best understood as a teaching abstraction that exposes policy evaluation and policy improvement. Sutton and Barto instead organize the classical treatment around Monte Carlo prediction, Exploring Starts, and on-policy control. The durable lesson is not the naming convention but the three different sources of coverage.

## What counts as a natural start?

An “ordinary entrance” is not a technical term. The precise object is the initial-state distribution supplied by the task:

$$
S_0\sim\rho_0.
$$

A maze may always begin in one corner, a card game may generate its initial hand through shuffling and dealing, and a robot may normally wake near a charging station. These are natural task initializations, not states selected freely by the learning algorithm.

Exploring Starts changes initialization and asks that

$$
\Pr(S_0=s,A_0=a)>0
$$

for every state–action pair of interest. $\epsilon$-greedy control normally keeps $\rho_0$ and changes what happens afterwards. Under a fixed policy, the state process is a Markov chain with kernel

$$
P_\pi(s'\mid s)=\sum_a\pi(a\mid s)P(s'\mid s,a).
$$

This makes one limitation explicit: starting naturally does not imply global coverage. If a state is unreachable from the support of $\rho_0$, no amount of $\epsilon$-greedy exploration can cross an edge that the environment does not have.

## $\epsilon$-greedy control as a biased random walk

Consider positions $0,1,\ldots,N$ with actions left and right. If right is currently greedy, the standard two-action rule gives

$$
\Pr(\text{right})=1-\frac{\epsilon}{2},\qquad
\Pr(\text{left})=\frac{\epsilon}{2}.
$$

For increments $\Delta S_t\in\{-1,1\}$,

$$
\mathbb E[\Delta S_t]=1-\epsilon.
$$

The resulting process is not an unbiased simple random walk. It combines a policy-induced drift with exploration-induced diffusion. Reducing $\epsilon$ concentrates motion in the currently preferred direction; increasing it broadens coverage but may also increase hitting times and return variance.

If $0$ and $N$ are absorbing boundaries, the probability of reaching $N$ first from $i$ obeys the discrete harmonic equation

$$
h(i)=p\,h(i+1)+(1-p)h(i-1),\qquad h(0)=0,\quad h(N)=1,
$$

where $p=1-\epsilon/2$. A reinforcement-learning exploration question has become a classical hitting-probability problem. Hitting times, cover times, and occupation counts offer further Markov-chain descriptions of the same trajectory.

## What might “natural starts” mean as a research direction?

Exploring Starts buys clean coverage assumptions by outsourcing the difficulty to environment reset. $\epsilon$-greedy avoids arbitrary resets but can spend most of an episode merely travelling toward informative regions. There may be a useful middle ground: choose among a set of starts that the environment genuinely permits, while adapting that distribution toward reachable regions that remain poorly evaluated.

One could write

$$
(S_0,A_0)\sim\mu_k,
$$

where $\mu_k$ at iteration $k$ is restricted to valid starts but reacts to current visitation deficits. This is a research proposal, not an established convergence result. Turning it into a method would require at least four answers:

1. Which reachability assumptions can replace the full-support Exploring Starts condition?
2. Does adapting the starting distribution introduce a value-estimation bias that cannot be controlled?
3. Should the objective target state–action coverage, effective updates, or hitting times of strategically important sets?
4. For long episodes, must resetting be combined with importance weighting or another off-policy correction?

I like this question because it turns exploration from a fixed random switch into a relation among initial distributions, transition geometry, and visitation objectives. Tabular Monte Carlo control may no longer be the main actor in large systems, but it remains a small and unusually clear laboratory in which these questions can be written down without hiding them behind scale.

## References

- Richard S. Sutton and Andrew G. Barto, [*Reinforcement Learning: An Introduction*, second edition](https://incompleteideas.net/book/RLbook2020.pdf), Chapter 5.
- MIT Press, [book information for *Reinforcement Learning: An Introduction*](https://mitpress.mit.edu/9780262039246/reinforcement-learning/).
