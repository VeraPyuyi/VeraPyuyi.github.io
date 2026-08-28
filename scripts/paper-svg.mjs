import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

export const EQUATION_VARIANTS = Object.freeze([
  { name: 'desktop', widthEm: 56 },
  { name: 'tablet', widthEm: 40 },
  { name: 'mobile', widthEm: 22 },
]);

const NUMBERED_ENVIRONMENTS = new Set(['equation', 'align', 'gather', 'multline']);
const MULTIROW_ENVIRONMENTS = new Set(['align', 'gather']);
const DISPLAY_ENVIRONMENTS = new Set(['align', 'alignat', 'displaymath', 'equation', 'flalign', 'gather', 'multline']);
const BUILD_MARKER = /PYUYIPAPER(?:REF|CITE)\d+END/;

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function outerEnvironment(tex) {
  const match = tex.trim().match(/^\\begin\{([A-Za-z]+)(\*)?\}/);
  if (!match) return undefined;
  return { name: match[1], starred: Boolean(match[2]), token: match[0] };
}

function outerEnvironmentBody(tex, environment) {
  const source = tex.trim();
  const endToken = `\\end{${environment.name}${environment.starred ? '*' : ''}}`;
  const end = source.lastIndexOf(endToken);
  if (end === -1) throw new Error(`Unclosed ${environment.name} display environment`);
  return source.slice(environment.token.length, end);
}

function splitTopLevelRows(body) {
  const rows = [];
  const stack = [];
  const tokenPattern = /\\begin\{([^{}]+)\}|\\end\{([^{}]+)\}|(?<!\\)([{}])|\\\\(?:\[[^\]]*\])?/g;
  let start = 0;
  let braceDepth = 0;
  for (let match = tokenPattern.exec(body); match; match = tokenPattern.exec(body)) {
    if (match[1]) {
      stack.push(match[1]);
      continue;
    }
    if (match[2]) {
      if (stack.at(-1) !== match[2]) throw new Error(`Unbalanced nested ${match[2]} display environment`);
      stack.pop();
      continue;
    }
    if (match[3]) {
      braceDepth += match[3] === '{' ? 1 : -1;
      if (braceDepth < 0) throw new Error('Unbalanced braces in display environment');
      continue;
    }
    if (stack.length === 0 && braceDepth === 0) {
      rows.push(body.slice(start, match.index));
      start = match.index + match[0].length;
    }
  }
  if (stack.length > 0) throw new Error(`Unclosed nested ${stack.at(-1)} display environment`);
  if (braceDepth !== 0) throw new Error('Unclosed brace group in display environment');
  rows.push(body.slice(start));
  return rows;
}

function parseEquationNumber(value) {
  const normalized = value.trim().replace(/^\((.*)\)$/, '$1');
  const match = normalized.match(/^(?:(\d+)\.)?(\d+)$/);
  if (!match) throw new Error(`Unsupported equation number format: ${value}`);
  return {
    prefix: match[1] === undefined ? undefined : Number.parseInt(match[1], 10),
    suffix: Number.parseInt(match[2], 10),
  };
}

function equationCounterDirectives(tex, labels) {
  const environment = outerEnvironment(tex);
  if (!environment || environment.starred || !NUMBERED_ENVIRONMENTS.has(environment.name)) return [];

  const body = outerEnvironmentBody(tex, environment);
  const rows = MULTIROW_ENVIRONMENTS.has(environment.name) ? splitTopLevelRows(body) : [body];
  const rowFacts = [];
  let numberedIndex = 0;
  for (const row of rows) {
    const numbered = !/\\(?:notag|nonumber)\b/.test(row);
    if (numbered) numberedIndex++;
    const keys = [...row.matchAll(/\\label(?:\[[^\]]*\])?\{([^{}]+)\}/g)].map((match) => match[1]);
    rowFacts.push({ numbered, numberedIndex: numbered ? numberedIndex : undefined, keys });
  }

  const labelledRows = rowFacts.flatMap((row) =>
    row.keys.map((key) => {
      const number = labels.get(key);
      if (!number) throw new Error(`Unresolved equation label while building SVG: ${key}`);
      if (!row.numbered || row.numberedIndex === undefined) {
        throw new Error(`Numbered equation label ${key} is on a suppressed row`);
      }
      return { key, rowIndex: row.numberedIndex, number: parseEquationNumber(number) };
    }),
  );
  if (labelledRows.length === 0) {
    throw new Error(`Numbered ${environment.name} display has no AUX-backed label`);
  }

  const first = labelledRows[0];
  const counterBefore = first.number.suffix - first.rowIndex;
  if (counterBefore < 0) throw new Error(`Invalid equation counter before ${first.key}`);
  for (const item of labelledRows) {
    if (item.number.prefix !== first.number.prefix || item.number.suffix !== counterBefore + item.rowIndex) {
      throw new Error(`Inconsistent equation numbering near ${item.key}`);
    }
  }

  const directives = [];
  if (first.number.prefix !== undefined) directives.push(`\\setcounter{section}{${first.number.prefix}}`);
  directives.push(`\\setcounter{equation}{${counterBefore}}`);
  return directives;
}

function formulaForDocument(tex) {
  const normalized = tex.trim().normalize('NFC');
  if (BUILD_MARKER.test(normalized)) throw new Error('An unresolved paper build marker leaked into a display equation');
  const environment = outerEnvironment(normalized);
  return environment && DISPLAY_ENVIRONMENTS.has(environment.name) ? normalized : `\\[\n${normalized}\n\\]`;
}

export function buildEquationBatchTex({ slug, source, equations, labels, widthEm }) {
  const documentStart = source.indexOf('\\begin{document}');
  if (documentStart === -1) throw new Error(`${slug}: TeX source has no document body`);
  const preamble = source.slice(0, documentStart).trimEnd();
  const pages = equations.map((tex, index) => {
    const formula = formulaForDocument(tex);
    const directives = equationCounterDirectives(formula, labels);
    return [
      index === 0 ? '' : '\\clearpage',
      '\\thispagestyle{empty}',
      ...directives,
      '\\noindent',
      '\\special{dvisvgm:currentcolor on}%',
      '\\special{dvisvgm:bbox \\the\\PyuyiEquationWidth\\space 0pt 0pt}%',
      '\\begin{minipage}{\\PyuyiEquationWidth}',
      formula,
      '\\end{minipage}',
      '\\par',
    ].join('\n');
  });

  return [
    preamble,
    '\\makeatletter',
    '\\newlength{\\PyuyiEquationWidth}',
    `\\setlength{\\PyuyiEquationWidth}{${widthEm}em}`,
    '\\makeatother',
    '\\begin{document}',
    '\\onecolumn',
    '\\pagestyle{empty}',
    '\\setlength{\\textwidth}{\\PyuyiEquationWidth}',
    '\\setlength{\\columnwidth}{\\PyuyiEquationWidth}',
    '\\setlength{\\linewidth}{\\PyuyiEquationWidth}',
    '\\setlength{\\hsize}{\\PyuyiEquationWidth}',
    '\\setlength{\\displayindent}{0pt}',
    '\\setlength{\\abovedisplayskip}{0pt}',
    '\\setlength{\\belowdisplayskip}{0pt}',
    '\\setlength{\\abovedisplayshortskip}{0pt}',
    '\\setlength{\\belowdisplayshortskip}{0pt}',
    '\\setlength{\\parindent}{0pt}',
    '\\hbadness=10000',
    '\\vbadness=10000',
    ...pages,
    '\\end{document}',
    '',
  ].join('\n');
}

function parseViewBox(value, filename) {
  const numbers = value
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (numbers.length !== 4 || numbers.some((number) => !Number.isFinite(number))) {
    throw new Error(`${filename}: invalid SVG viewBox`);
  }
  if (numbers[2] <= 0 || numbers[3] <= 0) throw new Error(`${filename}: empty SVG viewBox`);
  return numbers;
}

function prefixSvgIds(inner, prefix) {
  const ids = [...inner.matchAll(/\bid=(['"])([^'"]+)\1/g)].map((match) => match[2]);
  let output = inner;
  for (const id of ids) {
    const escaped = escapeRegExp(id);
    output = output
      .replace(new RegExp(`(\\bid=(['"]))${escaped}\\2`, 'g'), `$1${prefix}${id}$2`)
      .replace(new RegExp(`((?:href|xlink:href)=(['"])#)${escaped}\\2`, 'g'), `$1${prefix}${id}$2`)
      .replace(new RegExp(`url\\(#${escaped}\\)`, 'g'), `url(#${prefix}${id})`);
  }
  return output;
}

function parseSvgPage(path, symbolId) {
  const source = readFileSync(path, 'utf8').normalize('NFC');
  if (/<(?:text|script|foreignObject|image)[\s>]/i.test(source)) {
    throw new Error(`${basename(path)}: SVG contains forbidden text, script, foreign content, or image nodes`);
  }
  if (/(?:href|xlink:href)=(['"])(?!#)[^'"]+\1/i.test(source)) {
    throw new Error(`${basename(path)}: SVG contains an external reference`);
  }
  const root = source.match(/<svg\b([^>]*)>([\s\S]*)<\/svg>\s*$/i);
  if (!root) throw new Error(`${basename(path)}: malformed SVG root`);
  const viewBoxMatch = root[1].match(/\bviewBox=(['"])([^'"]+)\1/i);
  if (!viewBoxMatch) throw new Error(`${basename(path)}: SVG has no viewBox`);
  const viewBox = parseViewBox(viewBoxMatch[2], basename(path));
  const inner = prefixSvgIds(root[2].trim(), `${symbolId}-`);
  if (/#000(?:000)?\b/i.test(inner)) throw new Error(`${basename(path)}: black glyph color was not converted to currentColor`);
  return { viewBox, inner };
}

function median(values) {
  const sorted = values.toSorted((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

export function createEquationSprite({ slug, variant, svgDirectory, outputPath, equationCount }) {
  const files = readdirSync(svgDirectory)
    .filter((filename) => /^equation-\d+\.svg$/.test(filename))
    .toSorted((left, right) => left.localeCompare(right));
  if (files.length !== equationCount) {
    throw new Error(`${slug}/${variant.name}: expected ${equationCount} SVG pages, received ${files.length}`);
  }

  const pages = files.map((filename, index) => {
    const id = `eq-${String(index + 1).padStart(6, '0')}`;
    return { id, ...parseSvgPage(join(svgDirectory, filename), id) };
  });
  const baseWidth = median(pages.map((page) => page.viewBox[2]));
  const symbols = pages.map((page) => `<symbol id="${page.id}" viewBox="${page.viewBox.join(' ')}">${page.inner}</symbol>`);
  const sprite = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">',
    ...symbols,
    '</svg>',
    '',
  ].join('\n');
  writeFileSync(outputPath, sprite, 'utf8');

  return pages.map((page) => ({
    // The sprite symbol keeps dvisvgm's original viewBox.  The referencing
    // document must use a zero-origin viewport, otherwise the symbol viewBox
    // is applied a second time and clips formulas whose source page starts at
    // a non-zero x/y coordinate.
    viewBox: `0 0 ${page.viewBox[2]} ${page.viewBox[3]}`,
    widthEm: variant.widthEm * (page.viewBox[2] / baseWidth),
    href: `/papers/${slug}/equations-${variant.name}.svg#${page.id}`,
  }));
}

export function equationAssetsFromVariants(slug, byVariant) {
  const equationCount = byVariant[EQUATION_VARIANTS[0].name]?.length ?? 0;
  for (const variant of EQUATION_VARIANTS) {
    if (byVariant[variant.name]?.length !== equationCount) {
      throw new Error(`${slug}: responsive equation variant count mismatch`);
    }
  }
  return Array.from({ length: equationCount }, (_, index) => ({
    id: `eq-${String(index + 1).padStart(6, '0')}`,
    variants: Object.fromEntries(EQUATION_VARIANTS.map((variant) => [variant.name, byVariant[variant.name][index]])),
  }));
}
