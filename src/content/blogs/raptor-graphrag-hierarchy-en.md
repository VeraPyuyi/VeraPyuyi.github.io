---
title: Some Thoughts on Combining RAPTOR and GraphRAG
summary: Could graph structure guide hierarchical summaries? A proposal that distinguishes central entities from summary nodes and preserves relational evidence alongside a traceable abstraction layer.
publishedAt: "2026-10-10T12:54:35Z"
updatedAt: "2026-10-30T14:34:14Z"
language: en
translationKey: raptor-graphrag-hierarchy
routeSlug: raptor-graphrag-hierarchy
category: inspirations
keywords:
  - RAPTOR
  - GraphRAG
  - hierarchical retrieval
  - knowledge graph
  - query-focused summarization
draft: false
featured: true
comments: true
cover: /uploads/blogs/raptor-graphrag-hierarchy/cover.png
coverAlt: The original researcher and her star cat connect relational graph clusters to a layered paper summary tree in a sunny conservatory.
order: 800
---

Reading RAPTOR and GraphRAG prompted a straightforward idea: if one recursively groups text into summaries, and the other organizes entities and relations, could highly connected entities become “parents” in a document tree?

There is something useful in that intuition, but central entities and summary nodes have different jobs. Arranging a graph into a tree does not create hierarchical summaries. GraphRAG already has higher-level abstractions as well. The more precise question is whether graph structure can guide a better summary hierarchy.

## A central node is not a summary

[RAPTOR](https://arxiv.org/abs/2401.18059) builds multilevel representations through recursive embedding, clustering and summarization. [GraphRAG](https://arxiv.org/abs/2404.16130) organizes source-derived entities and relations into a graph and uses community summaries for more global questions. The distinction is not simply hierarchy versus no hierarchy; it concerns the objects being grouped and how abstractions are produced.

A highly connected entity might identify a corpus-wide theme, or merely an organization mentioned everywhere. It can be a navigation hub without representing the main conclusions of nearby material.

Edge direction is another complication. Equivalent facts can be expressed with different relation orientations. Outdegree alone may reflect extraction conventions rather than importance. Centrality is a clue, not a summarization capability.

## Keep both representations

I would retain text chunks $D=\{d_1,\ldots,d_n\}$, an entity-relation graph $G=(V,E)$ and a provenance correspondence:

$$
B\in\{0,1\}^{n\times |V|}.
$$

Here $B_{iv}=1$ means chunk $d_i$ supplies original evidence concerning entity $v$. Extraction can be wrong, so relations should point to specific source spans rather than surviving only as unsupported triples.

For a candidate entity group $C\subseteq V$, collect the associated evidence and create an abstraction:

$$
D_C=\{d_i:\exists v\in C,\;B_{iv}=1\},
\qquad s_C=\operatorname{Summarize}(D_C).
$$

The node $s_C$ is a newly generated summary, not a high-degree entity renamed as a parent. Further levels can group summaries and their evidence coverage while retaining links to the supporting material.

The relational graph and summary hierarchy can then coexist. One preserves cross-topic connections; the other controls reading granularity. Producing a tree should not require discarding every cycle and cross-link in the original graph.

## Let structure guide grouping

To retain the original centrality intuition, I would use it to generate candidates, then apply semantic and evidence constraints. A tentative score might be

$$
\operatorname{score}(v,C)
=\lambda_1 c(v)+\lambda_2 a(v,C)
+\lambda_3 e(v,C)-\lambda_4 r(v,C).
$$

Here $c$ is a normalized centrality signal, $a$ semantic fit, $e$ evidence coverage and $r$ redundancy. This is a design sketch. Definitions, weights and stability remain open; a weighted sum alone is not a theoretical contribution.

The comparison I want is between semantic grouping, structural grouping and their combination. Cross-document references, extraction noise and overly generic hubs should be explicit test conditions.

Parent-child structure also needs constraints: abstractions must retain provenance, recursion needs stopping rules, and source updates must reveal affected summaries. Additional levels can accumulate summarization errors and maintenance costs.

## Test a small module

I would begin with an interchangeable hierarchy-construction component, not a claim to a new superior retrieval system.

Keep documents, chunking, embeddings, generation model and context budget fixed. Compare vector retrieval, RAPTOR, GraphRAG and the graph-guided candidate. Distinguish local factual, multi-hop relational and global summarization questions: gains on one category do not establish value everywhere.

Alongside answer quality, report evidence traceability, retrieval coverage, construction and update costs, input tokens and latency. Entity extraction and summary generation remain real costs even when performed offline.

Two useful ablations would remove centrality and semantic constraints separately. If a proposed component has no measurable effect, it should not continue to be presented as the core contribution.

## No need to name it yet

I have not obtained experimental results for this proposal. It may become a useful engineering combination, a more specific methodological question, or an experiment showing that a simpler approach is enough.

The question that interests me is not whether two familiar names can be joined. It is whether a tree can provide better abstraction while a graph preserves relations—and whether every abstraction keeps a path back to its evidence. That also connects to [layered agent memory](/en/blogs/agent-layered-memory/): organization should earn its place through better reading and use.

## References

- Parth Sarthi et al., [RAPTOR](https://arxiv.org/abs/2401.18059).
- Darren Edge et al., [GraphRAG: From Local to Global](https://arxiv.org/abs/2404.16130).
