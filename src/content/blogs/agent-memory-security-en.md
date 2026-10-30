---
title: Some Thoughts on Agent Memory Security
summary: Persistent memory can carry an untrusted observation into later tasks. Retrieval quality therefore needs to be considered alongside provenance, permissions, validity and revocation.
publishedAt: "2026-10-22T10:36:51Z"
updatedAt: "2026-10-30T14:34:14Z"
language: en
translationKey: agent-memory-security
routeSlug: agent-memory-security
category: inspirations
keywords:
  - agent memory security
  - memory poisoning
  - prompt injection
  - provenance
  - trust boundaries
draft: false
featured: true
comments: true
cover: /uploads/blogs/agent-memory-security/cover.png
coverAlt: The original researcher inspects a memory card while her star cat guards a transparent permission gate and a suspicious record remains quarantined.
order: 850
---

While thinking about [layered memory](/en/blogs/agent-layered-memory/), I became concerned about another possibility: an agent that learns to consolidate experience might also turn a single mistake into a lasting habit.

Without persistent memory, an untrusted observation may leave with the current context. Once a system extracts facts, consolidates experience and reuses procedures, that observation can influence later decisions. The important failure is not merely retaining a bad sentence. It is allowing information to acquire authority it never possessed.

## Remembering is not authorization

[AgentPoison](https://arxiv.org/abs/2407.12784) studies influence through poisoned long-term memories or knowledge bases. [From Untrusted Input to Trusted Memory](https://arxiv.org/abs/2606.04329) examines memory-writing channels and persistent effects. Together, they motivate looking beyond the safety of one answer to the process by which experience becomes durable.

Ordinary factual mistakes, outdated records and malicious instructions are nevertheless different problems. Facts need verification, versions need separation, and external instructions must not become user authorization simply because they were retained.

A webpage's suggestion to skip future checks remains webpage content. Summarizing it as experience, or moving it into procedural memory, should not upgrade its trust level.

## Specify who can write what

I would begin with a bounded defensive setting: an agent reads documents and tool results, and an adversary may influence some of those materials, but cannot edit system rules or the user's permissions. The protected assets are task objectives, private information, tool authority and recoverable normal operation.

At least three boundaries matter:

- whether an observation becomes a persistent record;
- whether a record becomes an actionable recommendation;
- whether that recommendation receives authority to change external state.

These should not collapse into “retrieve something relevant and execute it.” A procedure that once succeeded may be inappropriate in another project, for another user or under different permissions.

Provenance and authorization should be maintained reliably by the runtime, rather than existing only as prose that other prose can contradict.

## Make writes inspectable

I would stage new memories before committing them. Checks for provenance, conflicts, validity and permissions would determine whether a record is a fact, an unresolved claim or a procedural experience. Broad changes to enduring preferences or rules would require explicit user confirmation.

Retrieval also needs more than similarity. A minimal eligibility condition is

$$
\operatorname{eligible}(m,q)
=\operatorname{relevant}(m,q)
\land\operatorname{permitted}(m,q)
\land\operatorname{validAt}(m,\tau(q)).
$$

Here $\tau(q)$ is the time referred to by the question, not necessarily the present. This is an eligibility gate, not proof of truth or safety. Eligible records can still conflict or require checking against original evidence.

Compression deserves particular attention. A qualified observation can lose phrases such as “in one experiment,” “unverified” or “from an external source” during summarization. Consolidation should preserve provenance and uncertainty rather than washing them away.

## Isolation and revocation matter too

Layers create propagation paths. A problematic record can become a summary, then knowledge, then a reusable procedure. Revoking the original should make its derived records discoverable.

I would track those dependencies and distinguish disabling, revision, deletion and audit retention. Hiding a record from search does not establish its absence from caches, summaries, backups or other derivatives. Any statement about deletion should describe its verified scope.

Project isolation should also be enforced along actual retrieval, reading and tool-execution paths. It should not depend solely on a model remembering a confidentiality instruction. Semantic similarity does not grant access to a private record.

## How I would evaluate defenses

I have not yet obtained results for this design. A useful evaluation would cover several independent dimensions:

1. Separate ordinary errors, stale facts and conflicting decisions from adversarial material.
2. Check whether influence persists across sessions and reaches summaries or procedures.
3. Test recovery after isolation and revocation, not just whether one answer refuses.
4. Measure normal task completion, false blocks, review effort and additional reading cost.

Such tests belong in authorized environments with synthetic records or explicitly permitted data. Real users' private histories are not necessary attack material.

I do not expect an additional safety prompt to carry all these responsibilities. A more promising direction makes provenance, permissions and versions part of system state, with inspectable writes, transformations and uses. An agent with a rich memory should still know which experiences must never become commands.

## References

- Zhaorun Chen et al., [AgentPoison](https://arxiv.org/abs/2407.12784).
- Pritam Dash et al., [From Untrusted Input to Trusted Memory](https://arxiv.org/abs/2606.04329).
