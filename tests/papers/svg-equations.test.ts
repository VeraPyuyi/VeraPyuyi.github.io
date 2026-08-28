import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  buildEquationBatchTex,
  createEquationSprite,
  EQUATION_VARIANTS,
  equationAssetsFromVariants,
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
