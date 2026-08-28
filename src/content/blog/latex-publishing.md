---
link: research/latex-publishing
title: 从 LaTeX 到 HTML 与 PDF
description: 论文源文件如何经过 Tectonic 与 Pandoc 发布。
date: 2026-08-24 20:00:00
cover: /og.png
keywords:
  - LaTeX
  - Pandoc
  - Tectonic
  - 研究
math: true
---

完整的论文放在 `src/content/papers/<slug>/`，以 `paper.yml` 描述元数据，以 `main.tex` 作为入口。

构建时：

1. Tectonic 编译可下载 PDF；
2. Pandoc 转换为语义化 HTML/MathML；
3. 任一步失败都会阻止新版本发布。

[查看已发布的论文](/papers/horizon-uniform-sensitivity/)。
