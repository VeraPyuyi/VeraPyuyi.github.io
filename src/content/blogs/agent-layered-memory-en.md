---
title: Some Thoughts on Layered Memory Architectures for Agents
summary: A reflection on separating facts, experiences and procedures, then deciding what an agent should store, retrieve, revise or forget under a finite context budget.
publishedAt: "2026-10-22T10:36:51Z"
updatedAt: "2026-10-30T14:34:14Z"
language: en
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
coverAlt: The original researcher routes a memory from an archive drawer to a working table while her star cat watches the layered library.
order: 900
---

I increasingly think of an agent's long-term memory as a room that needs organizing, rather than a disk that merely needs expanding. Yesterday's decision, today's objective, a claim found online and a successful procedure can all be stored. They should not influence the next action in exactly the same way.

Reading [ZenBrain](https://arxiv.org/abs/2604.23878v3) provided an interesting starting point. It proposes seven memory layers and a shared coordinator. What interests me is less the number of layers than whether different kinds of information have explicit lifecycles and retrieval rules.

There is also an important reading boundary: the author's [technical page](https://zensation.ai/en/technologie) includes evaluation corrections and implementation-scope clarifications. I therefore do not treat a headline score as proof that seven layers must outperform other architectures. What follows is a personal research direction inspired by the organizational idea.

## Separate responsibilities first

I would begin with the questions memory must answer, not the number of databases.

| Memory responsibility | Question it should answer |
| --- | --- |
| Working state | What is the current task, and which constraints remain active? |
| Episodic records | What happened, and what evidence supported a decision? |
| Semantic knowledge | Which facts are currently believed, and where did they come from? |
| Procedural experience | Which steps worked, and under what conditions? |

One original record can support multiple indexes instead of being copied mechanically between layers. A failed experiment might be found by time, method, configuration or failure reason.

Core preferences and cross-task knowledge should not acquire unlimited authority either. They need to remain revisable, traceable and subject to project and user access boundaries. A layer organizes information; it does not certify its truth.

## Nonlinear memory is not nonlinear input

One question keeps returning when I look at agent trajectories. Tool use expands the history, but the history is often still appended into a long chronological chain. Could tasks, evidence and experience instead be organized hierarchically, or across parallel contexts?

External memory can be a graph, and separate workers can maintain local workspaces. Yet a conventional text-model call still needs selected material in a representation it can actually read. Reorganizing storage does not automatically change the model's internal computation.

[MemGPT](https://arxiv.org/abs/2310.08560) makes information movement a useful focus. A coordinator could preserve global objectives while local tasks exchange only necessary evidence summaries and references to originals, rather than importing one another's complete histories. This is a design for managing limits, not a claim to have removed them.

## Memory management is a decision

Let the current question be $q_t$, available memories be $\mathcal M_t$, and the selected set be $S_t$. A possible objective for a future system is

$$
S_t\in\operatorname*{arg\,max}_{S\subseteq\mathcal M_t}
\bigl[U(S,q_t)-\lambda C(S)\bigr],
\qquad C(S)\le B_t.
$$

Here $U$ expresses usefulness, $C$ reading cost and $B_t$ the budget. This defines a problem; it does not solve utility estimation, evidence duplication or omission risk.

The coordinator also needs more than retrieval:

$$
a_t=(\mathrm{read},\mathrm{write},\mathrm{revise},
\mathrm{consolidate},\mathrm{forget}).
$$

These are operation categories, not a requirement to perform every operation on every turn. Choosing when to retain a temporary observation, commit a durable fact or consolidate a procedure is itself a policy to evaluate.

Repeated retrieval establishes use, not correctness. Frequency, confidence, source quality and permissions need separate representations. A familiar memory can still be wrong.

## Updates are harder than appends

Consider a configuration that changes after a failure. “What is the current setting?” and “Why did the earlier run fail?” refer to different temporal states.

A record therefore needs provenance, recording time, validity time, version and status. A new decision can supersede an old decision's current authority without deleting its value as historical evidence.

[LongMemEval](https://arxiv.org/abs/2410.10813) includes temporal reasoning, knowledge updates and abstention. That is a reminder that finding a similar passage is not the whole task. A system must also recognize when its records do not support an answer.

## Begin with a small experiment

I would prefer a controlled comparison over a fixed corpus before building an elaborate brain-inspired system:

1. Keep the model, records and token budget fixed; compare flat retrieval with responsibility-aware routing.
2. Include configuration updates, project isolation, conflicting records and missing evidence.
3. Measure answers, evidence retrieval, stale-fact use, input volume and latency separately.
4. Add forgetting and consolidation one at a time, checking whether gains merely reflect more evidence or a larger budget.

These are proposed tests, not results I have obtained. Additional coordination should earn its complexity by addressing failures that simpler systems exhibit under comparable conditions.

The agent I want is not simply a more enthusiastic collector. It should know which page to open, when an old conclusion needs revision and when judgment should wait. Preventing harmful material from becoming lasting experience is a separate problem: [memory security](/en/blogs/agent-memory-security/).

## References

- Alexander Bering, [ZenBrain: A Neuroscience-Inspired 7-Layer Memory Architecture for Autonomous AI Systems, v3](https://arxiv.org/abs/2604.23878v3).
- ZenSation Research, [The science behind ZenBrain and evaluation clarifications](https://zensation.ai/en/technologie).
- Charles Packer et al., [MemGPT: Towards LLMs as Operating Systems](https://arxiv.org/abs/2310.08560).
- Di Wu et al., [LongMemEval](https://arxiv.org/abs/2410.10813).
