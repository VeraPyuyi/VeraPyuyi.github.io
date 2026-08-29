import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

export const EQUATION_VARIANTS = Object.freeze([
  { name: 'desktop', widthEm: 36, containedWidthEm: 32 },
  { name: 'tablet', widthEm: 34, containedWidthEm: 30 },
  { name: 'mobile', widthEm: 20, containedWidthEm: 17.5 },
]);

export const FORMULA_DISPLAY_SCALE = 1.08;
export const SINGLE_LINE_MAX_FILL = 0.9;

const NUMBERED_ENVIRONMENTS = new Set(['equation', 'align', 'gather', 'multline']);
const MULTIROW_ENVIRONMENTS = new Set(['align', 'gather']);
const DISPLAY_ENVIRONMENTS = new Set(['align', 'alignat', 'displaymath', 'equation', 'flalign', 'gather', 'multline']);
const LINEARIZABLE_OUTER_ENVIRONMENTS = new Set(['align', 'gather', 'multline']);
const LINEARIZABLE_NESTED_ENVIRONMENTS = new Set(['aligned', 'gathered', 'split']);
const INTRINSIC_MULTILINE_ENVIRONMENT =
  /\\begin\{(?:array|cases|matrix|pmatrix|bmatrix|Bmatrix|vmatrix|Vmatrix|smallmatrix|subarray)\}/;
const UNSAFE_LINEARIZATION_COMMAND = /\\(?:intertext|shortintertext|displaybreak)\b|\\tag\*?(?=\s*\{)/;
const FIT_TOLERANCE_EM = 0.03;
const BUILD_MARKER = /PYUYIPAPER(?:REF|CITE)\d+END/;

/** @typedef {'standalone' | 'contained'} EquationContext */
/** @typedef {'original' | 'single-line' | 'compact'} EquationLayout */
/** @typedef {'auto' | 'original' | 'compact'} EquationLayoutPreference */
/** @typedef {{ tex: string, context?: EquationContext, layoutPreference?: EquationLayoutPreference | Record<string, EquationLayoutPreference>, sourceKey?: string, sourceHash?: string, labels?: string[] }} EquationRecord */
/**
 * @typedef {object} EquationRenderPage
 * @property {number} equationIndex
 * @property {EquationContext} context
 * @property {EquationLayout} layout
 * @property {number} targetWidthEm
 * @property {number} renderWidthEm
 * @property {string} tex
 * @property {string} [sourceKey]
 * @property {string} [sourceHash]
 * @property {string[]} labels
 * @property {string} layoutReason
 */

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

function stripTopLevelAlignmentMarkers(source) {
  const output = [];
  const stack = [];
  let braceDepth = 0;
  for (let index = 0; index < source.length; index++) {
    const tail = source.slice(index);
    const begin = tail.match(/^\\begin\{([^{}]+)\}/);
    if (begin) {
      stack.push(begin[1]);
      output.push(begin[0]);
      index += begin[0].length - 1;
      continue;
    }
    const end = tail.match(/^\\end\{([^{}]+)\}/);
    if (end) {
      if (stack.at(-1) !== end[1]) throw new Error(`Unbalanced nested ${end[1]} display environment`);
      stack.pop();
      output.push(end[0]);
      index += end[0].length - 1;
      continue;
    }

    const character = source[index];
    const escaped = source[index - 1] === '\\';
    if (!escaped && character === '{') braceDepth++;
    if (!escaped && character === '}') braceDepth--;
    if (!escaped && character === '&' && stack.length === 0 && braceDepth === 0) continue;
    output.push(character);
  }
  if (stack.length > 0 || braceDepth !== 0) throw new Error('Unbalanced formula while removing alignment markers');
  return output.join('');
}

function joinLinearizedRows(rows) {
  return rows
    .map((row) =>
      stripTopLevelAlignmentMarkers(row)
        .replace(/\\(?:notag|nonumber)\b/g, '')
        .trim(),
    )
    .filter(Boolean)
    .map((row, index) => {
      if (index === 0) return row;
      return /^(?:[=<>]|\\(?:le|leq|ge|geq|sim|simeq|approx|equiv|to|rightarrow|leftarrow|iff|implies)\b)/.test(row)
        ? `\\;${row}`
        : `\\qquad ${row}`;
    })
    .join(' ');
}

function formulaLabels(tex) {
  return [...tex.matchAll(/\\label(?:\[[^\]]*\])?\{([^{}]+)\}/g)].map((match) => match[1]);
}

function linearizeNestedEnvironment(body) {
  const pattern = /\\begin\{(aligned|gathered|split)\}([\s\S]*?)\\end\{\1\}/g;
  const matches = [...body.matchAll(pattern)];
  if (matches.length !== 1 || !LINEARIZABLE_NESTED_ENVIRONMENTS.has(matches[0][1])) return undefined;
  const rows = splitTopLevelRows(matches[0][2]);
  if (rows.length < 2) return undefined;
  const flattened = joinLinearizedRows(rows);
  if (!flattened) return undefined;
  return `${body.slice(0, matches[0].index)}${flattened}${body.slice((matches[0].index ?? 0) + matches[0][0].length)}`;
}

export function linearizeDisplayEquation(tex) {
  const normalized = tex.trim().normalize('NFC');
  if (
    BUILD_MARKER.test(normalized) ||
    INTRINSIC_MULTILINE_ENVIRONMENT.test(normalized) ||
    UNSAFE_LINEARIZATION_COMMAND.test(normalized)
  ) {
    return undefined;
  }
  const labels = formulaLabels(normalized);
  if (labels.length > 1) return undefined;

  const environment = outerEnvironment(normalized);
  if (environment && LINEARIZABLE_OUTER_ENVIRONMENTS.has(environment.name)) {
    const body = outerEnvironmentBody(normalized, environment);
    const rows = splitTopLevelRows(body);
    if (rows.length < 2) return undefined;
    if (!environment.starred && environment.name !== 'multline') {
      const numberedRows = rows.filter((row) => !/\\(?:notag|nonumber)\b/.test(row)).length;
      if (numberedRows > 1) return undefined;
    }
    if (!environment.starred && labels.length !== 1) return undefined;
    const flattened = joinLinearizedRows(rows);
    if (!flattened) return undefined;
    return environment.starred ? `\\[\n${flattened}\n\\]` : `\\begin{equation}\n${flattened}\n\\end{equation}`;
  }

  const body = environment ? outerEnvironmentBody(normalized, environment) : normalized;
  const flattenedBody = linearizeNestedEnvironment(body)?.trim();
  if (!flattenedBody) return undefined;
  if (environment && !environment.starred && NUMBERED_ENVIRONMENTS.has(environment.name) && labels.length !== 1) {
    return undefined;
  }
  if (!environment) return `\\[\n${flattenedBody}\n\\]`;
  const endToken = `\\end{${environment.name}${environment.starred ? '*' : ''}}`;
  return `${environment.token}\n${flattenedBody}\n${endToken}`;
}

export function compactDisplayEquation(tex) {
  return tex
    .trim()
    .normalize('NFC')
    .replace(/\\qquad\b/g, '\\quad{}')
    .replace(/\\hspace\*?\{([+]?(?:\d+(?:\.\d*)?|\.\d+))em\}/g, (match, rawWidth) =>
      Number.parseFloat(rawWidth) > 1 ? '\\hspace{1em}' : match,
    );
}

function layoutPreferenceForVariant(config, variantName) {
  if (typeof config === 'string') return config;
  return config?.[variantName] ?? 'auto';
}

/** @param {string | EquationRecord} equation */
function normalizeEquationRecord(equation) {
  if (typeof equation === 'string') {
    return { tex: equation, context: 'standalone', layoutPreference: 'auto', labels: [] };
  }
  return {
    tex: equation.tex,
    context: equation.context === 'contained' ? 'contained' : 'standalone',
    layoutPreference: equation.layoutPreference ?? 'auto',
    sourceKey: equation.sourceKey,
    sourceHash: equation.sourceHash,
    labels: equation.labels ?? [],
  };
}

/**
 * @param {Array<string | EquationRecord>} equations
 * @param {{ name: string, widthEm: number, containedWidthEm: number }} variant
 * @returns {EquationRenderPage[]}
 */
export function createEquationRenderPlan(equations, variant) {
  return equations.flatMap((value, equationIndex) => {
    const equation = normalizeEquationRecord(value);
    const targetWidthEm = equation.context === 'contained' ? variant.containedWidthEm : variant.widthEm;
    const layoutPreference = layoutPreferenceForVariant(equation.layoutPreference, variant.name);
    const original = {
      equationIndex,
      context: equation.context,
      layout: 'original',
      targetWidthEm,
      renderWidthEm: targetWidthEm / FORMULA_DISPLAY_SCALE,
      tex: equation.tex,
      sourceKey: equation.sourceKey,
      sourceHash: equation.sourceHash,
      labels: equation.labels,
      layoutReason: layoutPreference === 'original' ? 'override-original' : 'auto-original',
    };
    if (layoutPreference === 'original') return [original];
    if (layoutPreference === 'compact') {
      return [
        {
          ...original,
          layout: 'compact',
          tex: compactDisplayEquation(equation.tex),
          layoutReason: 'override-compact',
        },
      ];
    }
    const candidate = linearizeDisplayEquation(equation.tex);
    if (!candidate) return [original];
    return [
      original,
      {
        ...original,
        layout: 'single-line',
        renderWidthEm: Math.max(1, (targetWidthEm * SINGLE_LINE_MAX_FILL) / FORMULA_DISPLAY_SCALE),
        tex: candidate,
        layoutReason: 'auto-single-line',
      },
    ];
  });
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
  if (normalized.startsWith('\\[') && normalized.endsWith('\\]')) return normalized;
  const environment = outerEnvironment(normalized);
  return environment && DISPLAY_ENVIRONMENTS.has(environment.name) ? normalized : `\\[\n${normalized}\n\\]`;
}

/**
 * @param {{ slug: string, source: string, equations?: Array<string | EquationRecord>, labels: Map<string, string>, widthEm?: number, renderPlan?: EquationRenderPage[] }} options
 */
export function buildEquationBatchTex({ slug, source, equations = [], labels, widthEm = 0, renderPlan = undefined }) {
  const documentStart = source.indexOf('\\begin{document}');
  if (documentStart === -1) throw new Error(`${slug}: TeX source has no document body`);
  const preamble = source.slice(0, documentStart).trimEnd();
  const plan =
    renderPlan ??
    createEquationRenderPlan(equations, {
      name: 'legacy',
      widthEm,
      containedWidthEm: widthEm,
    }).filter((page) => page.layout === 'original');
  const pages = plan.map((page, index) => {
    const formula = formulaForDocument(page.tex);
    const directives = equationCounterDirectives(formula, labels);
    return [
      index === 0 ? '' : '\\clearpage',
      '\\thispagestyle{empty}',
      ...directives,
      `\\setlength{\\PyuyiEquationWidth}{${page.renderWidthEm}em}`,
      '\\setlength{\\textwidth}{\\PyuyiEquationWidth}',
      '\\setlength{\\columnwidth}{\\PyuyiEquationWidth}',
      '\\setlength{\\linewidth}{\\PyuyiEquationWidth}',
      '\\setlength{\\hsize}{\\PyuyiEquationWidth}',
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
    '\\makeatother',
    '\\begin{document}',
    '\\onecolumn',
    '\\pagestyle{empty}',
    '\\setlength{\\displayindent}{0pt}',
    '\\setlength{\\abovedisplayskip}{0pt}',
    '\\setlength{\\belowdisplayskip}{0pt}',
    '\\setlength{\\abovedisplayshortskip}{0pt}',
    '\\setlength{\\belowdisplayshortskip}{0pt}',
    '\\setlength{\\jot}{4pt}',
    '\\renewcommand{\\arraystretch}{1.05}',
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

function parseSvgPage(path) {
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
  const inner = root[2].trim();
  if (/#000(?:000)?\b/i.test(inner)) throw new Error(`${basename(path)}: black glyph color was not converted to currentColor`);
  return { viewBox, inner };
}

function median(values) {
  const sorted = values.toSorted((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

/**
 * @param {{ slug: string, variant: { name: string, widthEm: number, containedWidthEm: number }, svgDirectory: string, outputPath: string, equationCount: number, renderPlan?: EquationRenderPage[] }} options
 */
export function createEquationSprite({ slug, variant, svgDirectory, outputPath, equationCount, renderPlan = undefined }) {
  const files = readdirSync(svgDirectory)
    .filter((filename) => /^equation-\d+\.svg$/.test(filename))
    .toSorted((left, right) => left.localeCompare(right));
  const plan =
    renderPlan ??
    Array.from({ length: equationCount }, (_, equationIndex) => ({
      equationIndex,
      context: 'standalone',
      layout: 'original',
      targetWidthEm: variant.widthEm,
      renderWidthEm: variant.widthEm / FORMULA_DISPLAY_SCALE,
      labels: [],
      layoutReason: 'default-original',
    }));
  if (files.length !== plan.length) {
    throw new Error(`${slug}/${variant.name}: expected ${plan.length} SVG pages, received ${files.length}`);
  }

  const pages = files.map((filename, index) => ({ ...plan[index], ...parseSvgPage(join(svgDirectory, filename)) }));
  const unitWidth = median(pages.map((page) => page.viewBox[2] / page.renderWidthEm));
  const selected = Array.from({ length: equationCount }, (_, equationIndex) => {
    const candidates = pages.filter((page) => page.equationIndex === equationIndex);
    const original = candidates.find((page) => page.layout !== 'single-line');
    if (!original) throw new Error(`${slug}/${variant.name}: equation ${equationIndex + 1} has no base SVG`);
    const candidate = candidates.find((page) => page.layout === 'single-line');
    const candidateFits = candidate && candidate.viewBox[2] <= (candidate.renderWidthEm + FIT_TOLERANCE_EM) * unitWidth;
    const page = candidateFits ? candidate : original;
    const id = `eq-${String(equationIndex + 1).padStart(6, '0')}`;
    const widthEm = (page.viewBox[2] / unitWidth) * FORMULA_DISPLAY_SCALE;
    return {
      ...page,
      id,
      inner: prefixSvgIds(page.inner, `${id}-`),
      widthEm,
      overflow: widthEm > page.targetWidthEm + FIT_TOLERANCE_EM,
      layoutReason: candidateFits ? 'auto-single-line' : page.layoutReason,
    };
  });
  const symbols = selected.map((page) => `<symbol id="${page.id}" viewBox="${page.viewBox.join(' ')}">${page.inner}</symbol>`);
  const sprite = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">',
    ...symbols,
    '</svg>',
    '',
  ].join('\n');
  writeFileSync(outputPath, sprite, 'utf8');

  return selected.map((page) => ({
    // The sprite symbol keeps dvisvgm's original viewBox.  The referencing
    // document must use a zero-origin viewport, otherwise the symbol viewBox
    // is applied a second time and clips formulas whose source page starts at
    // a non-zero x/y coordinate.
    viewBox: `0 0 ${page.viewBox[2]} ${page.viewBox[3]}`,
    widthEm: page.widthEm,
    href: `/papers/${slug}/equations-${variant.name}.svg#${page.id}`,
    context: page.context,
    layout: page.layout,
    layoutReason: page.layoutReason,
    targetWidthEm: page.targetWidthEm,
    overflow: page.overflow,
    sourceKey: page.sourceKey,
    sourceHash: page.sourceHash,
    labels: page.labels ?? [],
  }));
}

export function equationAssetsFromVariants(slug, byVariant) {
  const equationCount = byVariant[EQUATION_VARIANTS[0].name]?.length ?? 0;
  for (const variant of EQUATION_VARIANTS) {
    if (byVariant[variant.name]?.length !== equationCount) {
      throw new Error(`${slug}: responsive equation variant count mismatch`);
    }
  }
  return Array.from({ length: equationCount }, (_, index) => {
    const context = byVariant[EQUATION_VARIANTS[0].name][index].context;
    const first = byVariant[EQUATION_VARIANTS[0].name][index];
    for (const variant of EQUATION_VARIANTS) {
      if (byVariant[variant.name][index].context !== context) {
        throw new Error(`${slug}: equation ${index + 1} context differs across responsive variants`);
      }
      if (byVariant[variant.name][index].sourceKey !== first.sourceKey) {
        throw new Error(`${slug}: equation ${index + 1} source identity differs across responsive variants`);
      }
    }
    return {
      id: `eq-${String(index + 1).padStart(6, '0')}`,
      context,
      sourceKey: first.sourceKey,
      sourceHash: first.sourceHash,
      labels: first.labels,
      variants: Object.fromEntries(EQUATION_VARIANTS.map((variant) => [variant.name, byVariant[variant.name][index]])),
    };
  });
}
