---
link: tech/site-capabilities
title: 这个站点能做什么？
description: 用一篇文章测试 Markdown、代码、Mermaid、目录与数学公式。
date: 2026-08-25 20:00:00
cover: /og.png
keywords:
  - Astro
  - Markdown
  - Mermaid
  - 技术
math: true
catalog: true
---

## Markdown 与数学

行内公式 $E = mc^2$，也可以写块级公式：

$$
\int_{-\infty}^{\infty} e^{-x^2}\,dx = \sqrt{\pi}.
$$

## 代码高亮

```ts title="hello.ts"
const greeting = '你好，小宇宙';
console.log(greeting);
```

## Mermaid

```mermaid
flowchart LR
  Write[写作] --> Build[静态构建]
  Build --> Search[Pagefind 索引]
  Search --> Pages[GitHub Pages]
```

页面会自动生成目录，并在阅读时显示进度。
