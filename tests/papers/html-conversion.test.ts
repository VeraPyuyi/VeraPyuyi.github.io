import assert from 'node:assert/strict';
import test from 'node:test';
import {
  collectDisplayEquations,
  convertPandocHtml,
  parseAux,
  prepareWebTex,
  validateGeneratedHtml,
} from '../../scripts/paper-html.mjs';

const aux = parseAux(String.raw`
\newlabel{sec:test}{{1}{1}}
\newlabel{eq:test}{{1.1}{1}}
\newlabel{thm:test}{{1.2}{1}}
\bibcite{source}{{1}{2026}{{Huang}}{{}}}
`);

test('AUX parsing restores equation and author-year citation data', () => {
  assert.equal(aux.labels.get('eq:test'), '1.1');
  assert.deepEqual(aux.citations.get('source'), {
    number: '1',
    year: '2026',
    author: 'Huang',
  });
});

test('web adapter emits static MathML, linked references, citations, and bibliography anchors', () => {
  const web = prepareWebTex(
    String.raw`See \eqref{eq:test}, \Cref{thm:test}, and \citep[Section~2]{source}.
\begin{thebibliography}{1}
\bibitem[Huang(2026)]{source} P. Huang. \emph{A paper}.
\end{thebibliography}`,
    aux,
  );
  const markers = [...web.replacements.keys()];
  assert.equal(markers.length, 3);
  assert.match(web.source, /\\hypertarget\{ref-source\}/);

  const html = convertPandocHtml({
    slug: 'fixture',
    aux,
    replacements: web.replacements,
    displayAssets: [
      {
        id: 'eq-000001',
        context: 'standalone',
        variants: Object.fromEntries(
          ['desktop', 'tablet', 'mobile'].map((variant, index) => [
            variant,
            {
              href: `/papers/fixture/equations-${variant}.svg#eq-000001`,
              viewBox: `0 0 ${560 - index * 100} 40`,
              widthEm: [56, 40, 22][index],
              layout: 'original',
              overflow: false,
            },
          ]),
        ),
      },
    ],
    standaloneHtml: `<html><body><h1 id="sec:test">Test</h1><p>${markers.join(' ')}</p><p><span class="math display">\\[\\begin{equation}\\label{eq:test}x_{\\rm in}=1\\end{equation}\\]</span></p><span id="thm:test"></span><span id="ref-source"></span></body></html>`,
  });

  assert.match(html, /<math[^>]+display="block"/);
  assert.match(html, /class="paper-equation"/);
  assert.match(html, /class="paper-equation-scroll"/);
  assert.equal((html.match(/class="paper-equation-svg /g) ?? []).length, 3);
  assert.match(html, /class="paper-equation-semantic"/);
  assert.match(html, /equations-desktop\.svg#eq-000001/);
  assert.match(html, /<use href="\/papers\/fixture\/equations-desktop\.svg#eq-000001" width="100%" height="100%"><\/use>/);
  assert.match(html, /class="paper-equation-hint" aria-hidden="true"/);
  assert.match(html, /id="eq:test"/);
  assert.match(html, /href="#eq:test">\(1\.1\)<\/a>/);
  assert.match(html, /href="#thm:test">Theorem 1\.2<\/a>/);
  assert.match(html, /href="#ref-source">Huang, 2026<\/a>, Section 2/);
  assert.doesNotMatch(html, /\\begin|\\label|class="math/);
});

test('strict HTML validation rejects leaked LaTeX and mojibake', () => {
  assert.throws(
    () => validateGeneratedHtml('bad-latex', '<h1 id="x">X</h1><math><mi>x</mi></math><p>\\eqref{eq:x}</p>'),
    /raw LaTeX/,
  );
  assert.throws(
    () => validateGeneratedHtml('bad-macro', '<h1 id="x">X</h1><math><mi>x</mi></math><p>\\unknownmacro{x}</p>'),
    /raw LaTeX/,
  );
  assert.throws(
    () => validateGeneratedHtml('bad-encoding', '<h1 id="x">X</h1><math><mi>x</mi></math><p>FranÃ§ais</p>'),
    /mojibake/,
  );
  assert.throws(
    () => validateGeneratedHtml('bare-display', '<h1 id="x">X</h1><math display="block"><mi>x</mi></math>'),
    /wrapper mismatch/,
  );
});

test('display equation collection records theorem-like layout constraints', () => {
  const equations = collectDisplayEquations(
    'fixture',
    '<html><body><div class="theorem"><p><span class="math display">\\[a=b\\]</span></p></div><p><span class="math display">\\[c=d\\]</span></p></body></html>',
  );

  assert.deepEqual(
    equations.map(({ context }) => context),
    ['contained', 'standalone'],
  );
});
