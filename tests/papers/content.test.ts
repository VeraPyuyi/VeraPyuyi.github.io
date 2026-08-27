import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { getPapers } from '../../src/lib/papers';

const root = process.cwd();
const papersRoot = join(root, 'src/content/papers');

const expected = {
  'horizon-uniform-sensitivity': {
    arxiv: '2606.17762v3',
    fontProfile: 'latin-modern',
    files: {
      '00README.json': 'ecd505b67892e00c8ed323f45949945abce4930e57888afe452ea0352cc6dd25',
      'Automatica_Bellman_Pontryagin.tex': '9d8bac66c9aeafba841b3b8d985ba820f4376481e47c487c2b0e13519d3ba3ba',
      'autart.cls': '61f728b276285f56433166ae9e22b7a2f3eba0bf6818a7724b4eeb4db8adaf07',
    },
  },
  'bernstein-transfers-greedy-records': {
    arxiv: '2607.22767v2',
    fontProfile: 'computer-modern',
    files: {
      '00README.json': 'c0a202a4a0265bbf104322b7c4c56607a874ce3825b0004f6fbfcb748ac49eeb',
      'Bernstein_Transfers_EJC__1_.tex': 'f1794bd7f2fb8a17975efff770ff8f5c48f1162458299bc8a9654b8e9a379f24',
    },
  },
  'cycle-decorated-ribbon-complexes': {
    arxiv: '2608.07599v2',
    fontProfile: 'latin-modern',
    files: {
      '00README.json': 'fac11ed6b675abaa4e3b095d78f51b949eab040706ec4aba28c6f700ee82c38b',
      'main_jca_focused.tex': '63e428796d6474fcf29d3a357f3835700cc031d496cba50aed6f8cac4e896eb6',
      'references_jca_focused.bib': '79f12caba8e7514e22aa07174c0a02bdaa12002b9a8767fc5c6fe602e8cb86ee',
    },
  },
} as const;

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

test('paper metadata is version-locked and complete', () => {
  const papers = getPapers();
  assert.deepEqual(papers.map((paper) => paper.id).sort(), Object.keys(expected).sort());

  for (const paper of papers) {
    const source = expected[paper.id as keyof typeof expected];
    assert.ok(source);
    assert.equal(`${paper.arxivId}${paper.arxivVersion}`, source.arxiv);
    assert.equal(paper.sourceUrl, `https://arxiv.org/src/${source.arxiv}`);
    assert.equal(paper.license, 'CC BY 4.0');
    assert.equal(paper.licenseUrl, 'https://creativecommons.org/licenses/by/4.0/');
    assert.equal(paper.fontProfile, source.fontProfile);
    assert.ok(paper.titleEn);
    assert.ok(paper.abstractEn);
  }
});

test('Scholar URL uses the exact lowercase profile id and required parameters', () => {
  const expectedUrl = 'https://scholar.google.com/citations?user=ld3xCE8AAAAJ&hl=zh-CN&oi=ao';
  const siteConfig = readFileSync(join(root, 'config/site.yaml'), 'utf8');
  const about = readFileSync(join(root, 'src/pages/about.md'), 'utf8');
  assert.match(siteConfig, new RegExp(expectedUrl.replace(/[?&]/g, '\\$&')));
  assert.ok(about.includes(expectedUrl));
  assert.doesNotMatch(siteConfig, /user=Id3xCE8AAAAJ/);
});

test('paper web fonts are self-hosted with license files', () => {
  const fontRoot = join(root, 'public/fonts/papers');
  for (const filename of [
    'latin-modern-regular.woff2',
    'latin-modern-math.woff2',
    'computer-modern-regular.woff2',
    'computer-modern-math.woff2',
    'licenses/latin-modern-GUST.txt',
    'licenses/computer-modern-OFL.txt',
  ]) {
    assert.ok(existsSync(join(fontRoot, filename)), filename);
  }

  const paperPage = readFileSync(join(root, 'src/pages/papers/[slug].astro'), 'utf8');
  assert.match(paperPage, /\[data-paper-font='latin-modern'\] \.paper-content math[^}]+Paper Latin Modern Math/);
  assert.match(paperPage, /\[data-paper-font='computer-modern'\] \.paper-content math[^}]+Paper Computer Modern Math/);
});

test('imported arXiv files remain byte-for-byte unchanged', () => {
  for (const [slug, source] of Object.entries(expected)) {
    for (const [filename, digest] of Object.entries(source.files)) {
      assert.equal(sha256(join(papersRoot, slug, filename)), digest, `${slug}/${filename}`);
    }
  }
});

test('sample paper is removed and licensing exceptions are documented', () => {
  assert.equal(existsSync(join(papersRoot, 'starlight-notes')), false);
  const license = readFileSync(join(papersRoot, 'LICENSE.md'), 'utf8');
  assert.match(license, /CC BY 4\.0/);
  assert.match(license, /LaTeX Project Public License/);
});
