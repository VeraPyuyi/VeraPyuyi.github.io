---
title: Some Thoughts on Irrational Encodings and Agent Memory
summary: Encoding finite information in an irrational number is possible; the harder questions concern storage, selective retrieval, and what an agent can actually read.
publishedAt: "2026-10-29T18:18:30Z"
updatedAt: "2026-10-30T14:34:14Z"
language: en
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
coverAlt: The original blue-and-pink-haired researcher and star cat examine reversible encoding and a selectively opened memory drawer.
order: 1000
---

I once wondered whether a piece of information could be compressed into bits and then placed inside the fractional part of an irrational number. Could a whole history become “one number”? Could that number serve as a lighter memory for an agent?

There is a precise construction behind this intuition. What it does not provide automatically is a reduction in storage or reading cost. I find it more useful to separate those questions before deciding what to build.

## A reversible construction

Let a compressed finite bit string have length $\ell$ and integer value $N$. Its length must be retained, including any leading zeros. Choose a fixed irrational offset and define

$$
0\le N<2^\ell,\qquad \beta=\sqrt2-1,\qquad x=\frac{N+\beta}{2^\ell}.
$$

The number $x$ is irrational and belongs to $(0,1)$. Given $\ell$ and the exact value of $x$, recovery is straightforward:

$$
N=\left\lfloor 2^\ell x\right\rfloor.
$$

Pad $N$ back to $\ell$ bits and apply the original decompressor. The offset ensures irrationality; it does not remove redundancy.

A computer need not store infinitely many decimal digits. It can retain a finite description: the length, integer, agreed offset and codec. A finitely describable irrational number is not an archive whose contents no longer need to be stored.

## One number still needs precision

If an approximation $\widehat x$ replaces the exact value of $x$, recovery depends on its error. A sufficient condition is

$$
\lvert\widehat x-x\rvert
<2^{-\ell}\min\{\beta,1-\beta\}.
$$

After scaling, the error must not cross an integer boundary. Larger values of $\ell$ demand greater precision. An arbitrary history cannot be packed into a fixed-precision floating-point value and always recovered intact.

Nor does a shorter decimal string establish a compression gain. Changing bases changes the number of states represented by each character. [Shannon's original paper](https://people.math.harvard.edu/~ctm/home/text/others/shannon/entropy/entropy.pdf) supplies the information-theoretic foundation, but a basic counting argument already exposes the limit: binary strings of length $n$ offer $2^n$ possibilities, whereas strings of all lengths shorter than $n$ offer only $2^n-1$ possibilities combined.

Actual compression still exploits repetition, structure or predictability. Any comparison must also account for the decoder and other shared information.

## What kind of memory does an agent need?

In an agent system, “compression” can refer to several different objectives.

| Objective | What should actually be measured |
| --- | --- |
| Smaller external storage | Total bytes for records, indexes, summaries and versions |
| Shorter context | Tokens actually supplied to the model per task |
| Cheaper reading | Retrieval, decoding, reranking and reading latency |
| Better long-term memory | Correct recall, handling updates and downstream task performance |

A small compressed archive does not shorten the model's input if the entire archive is unpacked into every prompt. Conversely, selective retrieval can reduce current input even when the external records are uncompressed.

[MemGPT](https://arxiv.org/abs/2310.08560) separates limited main context from external memory. That suggests a practical question: which records must be brought into the model's readable context for this decision? It does not make the physical context window infinite.

Giving a model the decimal expansion of an irrational number does not automatically teach it a reliable decoder. A short memory identifier can be useful, but it is generally an address: the contents and retrieval mechanism must still exist elsewhere.

## Separate archives from retrieval

The structure I would currently explore gives each memory block three parts: retrieval information, a readable summary and an exactly recoverable original record. Irrational encoding, if included, belongs naturally in the third part.

For a record $H_i$ and compressor $C$, extract a length and integer from its code:

$$
w_i=C(H_i),\qquad
x_i=\frac{N_i+\beta}{2^{\ell_i}}.
$$

Entities, keywords, time filters or vectors first locate the block. A reader then chooses a summary, a local evidence span or the original. Small numerical distance $\lvert x_i-x_j\rvert$ does not imply semantic similarity: reversibility alone supplies no such geometric guarantee.

Compressing retrieval vectors is a different objective. The [official Faiss documentation](https://github.com/facebookresearch/faiss/wiki/Faiss-indexes) describes vector encodings such as product quantization. These concern search representations and distance calculations, not lossless preservation of the original prose.

Block size also requires measurement. Large blocks can exploit repetition across passages; smaller ones permit more selective reads and updates. Indexes, checksums and version records introduce overhead. The relevant total is

$$
B_{\mathrm{total}}
=B_{\mathrm{payload}}+B_{\mathrm{index}}
+B_{\mathrm{summary}}+B_{\mathrm{metadata}}.
$$

Reporting only payload compression can hide much of the system's actual cost.

## What I would test next

This is not a demonstrated improvement over existing memory systems. I would first compare plain record blocks, conventionally compressed blocks and an irrational representation of the same compressed codes, while keeping the corpus and retrieval system fixed.

Exact recovery, local-read latency, total storage, input tokens, factual updates and downstream performance should be measured separately. If the irrational representation adds no measurable benefit, it remains an interesting, rigorous encoding wrapper—not a performance improvement merely because the mathematical object is unusual.

The question I want to retain is how to preserve a complete history without requiring an agent to read it all again. That leads naturally to [layered memory architectures](/en/blogs/agent-layered-memory/).

## References

- Claude E. Shannon, [A Mathematical Theory of Communication](https://people.math.harvard.edu/~ctm/home/text/others/shannon/entropy/entropy.pdf).
- Charles Packer et al., [MemGPT: Towards LLMs as Operating Systems](https://arxiv.org/abs/2310.08560).
- Faiss maintainers, [Faiss indexes](https://github.com/facebookresearch/faiss/wiki/Faiss-indexes).
