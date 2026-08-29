import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  buildEquationBatchTex,
  createEquationRenderPlan,
  createEquationSprite,
  EQUATION_VARIANTS,
  equationAssetsFromVariants,
  linearizeDisplayEquation,
} from '../../scripts/paper-svg.mjs';

const preamble = String.raw`\documentclass{amsart}
\usepackage{amsmath}
\begin{document}
body
\end{document}`;

test('equation batch preserves TeX alignment and restores counters from labelled rows', () => {
  const tex = buildEquationBatchTex({
    slug: 'fixture',
    source: preamble,
    widthEm: 56,
    labels: new Map([
      ['eq:second', '2.4'],
      ['eq:last', '2.5'],
    ]),
    equations: [
      String.raw`\begin{align}
      a &= b \\
      c &= d \label{eq:second} \\
      e &= f \label{eq:last}
    \end{align}`,
    ],
  });

  assert.match(tex, /\\onecolumn/);
  assert.match(tex, /\\setlength\{\\PyuyiEquationWidth\}\{56em\}/);
  assert.match(tex, /\\setcounter\{section\}\{2\}/);
  assert.match(tex, /\\setcounter\{equation\}\{2\}/);
  assert.match(tex, /a &= b[\s\S]*c &= d[\s\S]*e &= f/);
});

test('safe multirow equations are linearized without changing labels or mathematical tokens', () => {
  const candidate = linearizeDisplayEquation(String.raw`\begin{align}
    A &= B \notag \\
      &= C \label{eq:chain}
  \end{align}`);

  assert.match(candidate ?? '', /\\begin\{equation\}/);
  assert.match(candidate ?? '', /A = B/);
  assert.match(candidate ?? '', /= C \\label\{eq:chain\}/);
  assert.doesNotMatch(candidate ?? '', /\\\\|&|\\notag/);
});

test('multi-number equations and intrinsic multiline structures keep their original layout', () => {
  assert.equal(linearizeDisplayEquation(String.raw`\begin{align}a&=b\label{eq:a}\\c&=d\label{eq:b}\end{align}`), undefined);
  assert.equal(linearizeDisplayEquation(String.raw`\[f(x)=\begin{cases}x,&x>0\\0,&x\le0\end{cases}\]`), undefined);
});

test('render plans use constrained widths and keep one-line candidates breakpoint-specific', () => {
  const plan = createEquationRenderPlan(
    [
      {
        context: 'contained',
        tex: String.raw`\begin{align*}a&=b\\c&=d\end{align*}`,
      },
    ],
    EQUATION_VARIANTS[0],
  );

  assert.deepEqual(
    plan.map(
      ({
        context,
        layout,
        targetWidthEm,
        renderWidthEm,
      }: {
        context: string;
        layout: string;
        targetWidthEm: number;
        renderWidthEm: number;
      }) => ({
        context,
        layout,
        targetWidthEm,
        renderWidthEm,
      }),
    ),
    [
      { context: 'contained', layout: 'original', targetWidthEm: 46, renderWidthEm: 46 },
      { context: 'contained', layout: 'single-line', targetWidthEm: 46, renderWidthEm: 45 },
    ],
  );
});

test('equation sprite contains path-only symbols and responsive metadata', () => {
  const root = mkdtempSync(join(tmpdir(), 'pyuyi-equation-sprite-'));
  const byVariant: Record<string, ReturnType<typeof createEquationSprite>> = {};
  for (const variant of EQUATION_VARIANTS) {
    const svgDirectory = join(root, variant.name);
    mkdirSync(svgDirectory);
    writeFileSync(
      join(svgDirectory, 'equation-0001.svg'),
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="12 34 100 20"><defs><path id="g0" d="M12 34h1v1z"/></defs><use href="#g0" fill="currentColor"/></svg>',
    );
    const outputPath = join(root, `equations-${variant.name}.svg`);
    byVariant[variant.name] = createEquationSprite({
      slug: 'fixture',
      variant,
      svgDirectory,
      outputPath,
      equationCount: 1,
    });
    const sprite = readFileSync(outputPath, 'utf8');
    assert.match(sprite, /<symbol id="eq-000001" viewBox="12 34 100 20"/);
    assert.match(sprite, /id="eq-000001-g0"/);
    assert.match(sprite, /href="#eq-000001-g0"/);
    assert.doesNotMatch(sprite, /<text[\s>]/);
  }

  const assets = equationAssetsFromVariants('fixture', byVariant);
  assert.equal(assets.length, 1);
  assert.deepEqual(Object.keys(assets[0].variants), ['desktop', 'tablet', 'mobile']);
  assert.equal(assets[0].variants.desktop.viewBox, '0 0 100 20');
});

test('equation sprite rejects browser-font text nodes', () => {
  const root = mkdtempSync(join(tmpdir(), 'pyuyi-equation-text-'));
  writeFileSync(join(root, 'equation-0001.svg'), '<svg viewBox="0 0 10 10"><text>x</text></svg>');
  assert.throws(
    () =>
      createEquationSprite({
        slug: 'fixture',
        variant: EQUATION_VARIANTS[0],
        svgDirectory: root,
        outputPath: join(root, 'sprite.svg'),
        equationCount: 1,
      }),
    /forbidden text/,
  );
});

test('equation sprite selects a fitting single-line candidate and records the decision', () => {
  const root = mkdtempSync(join(tmpdir(), 'pyuyi-equation-choice-'));
  writeFileSync(join(root, 'equation-0001.svg'), '<svg viewBox="0 0 560 20"><path fill="currentColor" d="M0 0h1v1z"/></svg>');
  writeFileSync(join(root, 'equation-0002.svg'), '<svg viewBox="0 0 550 12"><path fill="currentColor" d="M0 0h1v1z"/></svg>');
  const variant = EQUATION_VARIANTS[0];
  const assets = createEquationSprite({
    slug: 'fixture',
    variant,
    svgDirectory: root,
    outputPath: join(root, 'sprite.svg'),
    equationCount: 1,
    renderPlan: [
      {
        equationIndex: 0,
        context: 'standalone',
        layout: 'original',
        targetWidthEm: 56,
        renderWidthEm: 56,
        tex: 'original',
      },
      {
        equationIndex: 0,
        context: 'standalone',
        layout: 'single-line',
        targetWidthEm: 56,
        renderWidthEm: 55,
        tex: 'candidate',
      },
    ],
  });

  assert.equal(assets[0].layout, 'single-line');
  assert.equal(assets[0].overflow, false);
  assert.equal(assets[0].targetWidthEm, 56);
});
