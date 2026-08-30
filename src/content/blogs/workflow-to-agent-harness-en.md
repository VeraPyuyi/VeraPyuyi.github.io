---
title: Some Thoughts on Workflows and Agent Harnesses
summary: As models learn to plan and use tools dynamically, workflows do not disappear; they become executable, recoverable, and verifiable control structures inside a harness.
publishedAt: "2026-08-30 12:00:00"
language: en
translationKey: workflow-to-agent-harness
routeSlug: workflow-to-agent-harness
keywords:
  - agent harness
  - workflow
  - orchestration
  - durable execution
  - agent trajectory
draft: false
featured: true
comments: true
order: 400
---

The last few years have produced many visual tools for agent workflows: drag an LLM, retrieval, branches, tools, and several agents onto a canvas, connect them, and obtain an executable process. These products solve real problems. They also raise a question for me: as models become better at planning for themselves, is “more nodes and nicer arrows” still a sufficiently strong technical contribution?

My provisional answer is: **hand-authored micro-orchestration is becoming a commodity, but workflows are not disappearing. They are moving from the top-level solution algorithm into the set of control primitives provided by an agent harness.**

## Separate the four layers first

Many disagreements come from calling several layers an “agent platform.” I find the following decomposition more useful:

```text
business process and institutional constraints
                    ↓
agent / workflow orchestration
                    ↓
harness / runtime
                    ↓
models, tools, and the external environment
```

The model supplies local reasoning and action proposals within one call. A workflow describes a comparatively explicit execution graph. The harness maintains state across calls: context, tools, permissions, retries, recovery, memory, verification, termination, and observations.

Anthropic's *Building Effective Agents* makes a useful distinction. Workflows orchestrate models and tools through predefined code paths, whereas agents let a model dynamically direct its process and tool use. This does not require a system to choose only one. Production systems often allow local autonomy inside fixed boundaries.

## Model CoT is not the same as an agent trajectory

Reasoning inside one model call can be sketched as

```text
context → reasoning → answer or action
```

A harness maintains a cross-call feedback loop:

```text
goal
  ↓
reason → act → observe
  ↑              ↓
  └── update state
  ↓
verify → stop or continue
```

A more precise statement is therefore: the model produces local reasoning; the harness organizes the global agent trajectory. Searching, reading a file, running a program, observing failure, compressing context, and planning again form an execution trace. That trace should not be collapsed into the model's internal Chain of Thought.

One rough abstraction is

$$
s_{t+1}=F(s_t,a_t,o_{t+1}),\qquad a_t\sim\pi_\theta(\cdot\mid s_t),
$$

where the model approximately plays the role of policy $\pi_\theta$, while the harness stores state $s_t$, executes $a_t$, and receives a new observation $o_{t+1}$. This does not claim that every agent system is already a well-specified MDP. It only emphasizes that the architecture resembles closed-loop control more than a static chain of prose reasoning.

## Workflows may move from “how” to “what must happen”

For “find sources, summarize them, and write an answer,” a stronger agent may generate a temporary plan without requiring a user to draw ten nodes. A bank approval, production release, data deletion, or security repair cannot be delegated in the same way. Such processes must state:

- which checks may never be skipped;
- which tools and data are forbidden;
- where human approval is mandatory;
- how failure triggers compensation, retry, or rollback;
- which evidence must be retained for audit.

The role of a workflow may therefore shift from

> describing the complete algorithm for solving the task

to

> declaring the institutional constraints and checkpoints that execution must satisfy.

This is why durable execution remains important. An agent running for minutes, hours, or days will encounter process restarts, network failures, tool timeouts, and waits for people. Temporal describes durable execution as recording progress so that an application can resume where it stopped after failure. A better planner does not automatically provide this runtime guarantee.

## Workflow as a pluggable harness capability

A harness might expose a structure like

```text
Harness
 ├─ tool registry
 ├─ memory
 ├─ sandbox and permissions
 ├─ evaluator
 ├─ scheduler
 └─ workflow engine
```

The workflow engine may execute a static DAG, a state machine, a durable process with human steps, or a temporary plan synthesized by an agent. The OpenAI Agents SDK likewise places tools, handoffs, guardrails, sessions, and orchestration inside a runtime framework rather than assuming that a visual graph alone carries every operational responsibility.

In this view, a workflow is no longer the whole system. It is a structured plan or execution graph that can be generated, inspected, run, paused, recovered, and discarded.

## The questions that still seem worth asking

If the visual editor is removed, what remains of a workflow project? That may be a better test of technical value than the number of node types. Several difficult problems remain:

1. **Workflow synthesis:** turn a goal, tool set, and constraints into an executable graph rather than a paragraph describing a plan.
2. **Verification:** establish before execution that dangerous paths are unreachable or that approval nodes cannot be bypassed.
3. **Recovery:** retry safely when model calls are nondeterministic and external APIs have side effects.
4. **Permission shaping:** grant the minimum capability needed for the current step instead of giving the agent every tool at startup.
5. **Trajectory learning:** learn from successful and failed runs when to expand a plan, invoke an existing workflow, or return control to a person.
6. **Evaluation:** assess not only the final answer but cost, risk, recoverability, and process evidence.

I therefore do not think that the age of workflows has ended. A more careful conclusion is that connecting fixed micro-steps is increasingly easy to reproduce, while treating workflows as generatable, verifiable, recoverable, and learnable structures inside a harness is only becoming a clearly stated problem.

## References

- Anthropic, [Building Effective Agents](https://www.anthropic.com/engineering/building-effective-agents).
- OpenAI, [Agents SDK documentation](https://openai.github.io/openai-agents-python/agents/) and [agent orchestration](https://openai.github.io/openai-agents-js/guides/multi-agent/).
- Temporal, [Durable Execution documentation](https://docs.temporal.io/).
