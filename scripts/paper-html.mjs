import { createHash } from 'node:crypto';
import { parse, parseFragment, serialize } from 'parse5';
import temml from 'temml';

const REFERENCE_MARKER = 'PYUYIPAPERREF';
const CITATION_MARKER = 'PYUYIPAPERCITE';
const DEFAULT_MATH_MACROS = {
  '\\hfill': '\\qquad',
};
const FORBIDDEN_LATEX = /\\[A-Za-z@]+/;
const MOJIBAKE = /\uFFFD|Ã.|Â.|â(?:€|€™|€œ|€œ|€“|€”|€¦)|ï¿½/;
const EQUATION_VARIANTS = ['desktop', 'tablet', 'mobile'];
const CONTAINED_EQUATION_CLASSES = new Set([
  'theorem',
  'lemma',
  'proposition',
  'corollary',
  'definition',
  'condition',
  'proof',
  'remark',
  'example',
]);

function containsForbiddenControlCharacter(value) {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint === 0x7f || (codePoint < 0x20 && codePoint !== 0x09 && codePoint !== 0x0a && codePoint !== 0x0d);
  });
}

function readDelimited(source, start, open = '{', close = '}') {
  if (source[start] !== open) throw new Error(`Expected ${open} at offset ${start}`);
  let depth = 0;
  for (let index = start; index < source.length; index++) {
    const character = source[index];
    if (character === open && source[index - 1] !== '\\') depth++;
    if (character === close && source[index - 1] !== '\\') {
      depth--;
      if (depth === 0) return { value: source.slice(start + 1, index), end: index + 1 };
    }
  }
  throw new Error(`Unclosed ${open} at offset ${start}`);
}

function topLevelGroups(source) {
  const groups = [];
  let index = 0;
  while (index < source.length) {
    if (source[index] !== '{') {
      index++;
      continue;
    }
    const group = readDelimited(source, index);
    groups.push(group.value);
    index = group.end;
  }
  return groups;
}

function stripOuterGroups(value) {
  let current = value.trim();
  while (current.startsWith('{')) {
    const group = readDelimited(current, 0);
    if (group.end !== current.length) break;
    current = group.value.trim();
  }
  return current;
}

function latexText(value) {
  return stripOuterGroups(value)
    .replaceAll('~', ' ')
    .replace(/\\(?:textnormal|mathrm|mathbf|emph)\s*\{([^{}]*)\}/g, '$1')
    .replace(/\\["']\{?([A-Za-z])\}?/g, (_, letter) => {
      const accents = {
        a: 'ä',
        A: 'Ä',
        e: 'ë',
        E: 'Ë',
        i: 'ï',
        I: 'Ï',
        o: 'ö',
        O: 'Ö',
        u: 'ü',
        U: 'Ü',
      };
      return accents[letter] ?? letter;
    })
    .replace(/\\(?:v|u)\s*\{?([A-Za-z])\}?/g, '$1')
    .replace(/\\[a-zA-Z@]+\s*/g, '')
    .replace(/[{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function scanAuxCommand(aux, command, callback) {
  const needle = `\\${command}`;
  let offset = 0;
  while (true) {
    const start = aux.indexOf(needle, offset);
    if (start === -1) break;
    let cursor = start + needle.length;
    while (/\s/.test(aux[cursor] ?? '')) cursor++;
    if (aux[cursor] !== '{') {
      offset = cursor;
      continue;
    }
    const key = readDelimited(aux, cursor);
    cursor = key.end;
    while (/\s/.test(aux[cursor] ?? '')) cursor++;
    if (aux[cursor] !== '{') {
      offset = cursor;
      continue;
    }
    const value = readDelimited(aux, cursor);
    callback(key.value, value.value);
    offset = value.end;
  }
}

export function parseAux(aux) {
  const labels = new Map();
  const citations = new Map();

  scanAuxCommand(aux, 'newlabel', (key, value) => {
    if (key.endsWith('@cref')) return;
    const groups = topLevelGroups(value);
    const number = latexText(groups[0] ?? value);
    if (number) labels.set(key, number);
  });

  scanAuxCommand(aux, 'bibcite', (key, value) => {
    const groups = topLevelGroups(value);
    const number = latexText(groups[0] ?? value);
    const year = latexText(groups[1] ?? '');
    const authorGroups = topLevelGroups(groups[2] ?? '');
    const author = latexText(authorGroups[0] ?? groups[2] ?? '');
    citations.set(key, {
      number,
      year: /^\d{4}[a-z]?$/.test(year) ? year : undefined,
      author: author || undefined,
    });
  });

  return { labels, citations };
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function labelKind(label) {
  const prefix = label.split(':', 1)[0];
  return (
    {
      cond: 'condition',
      cor: 'corollary',
      def: 'definition',
      eq: 'equation',
      ex: 'example',
      fig: 'figure',
      lem: 'lemma',
      prop: 'proposition',
      rem: 'remark',
      sec: 'section',
      subsec: 'section',
      tab: 'table',
      thm: 'theorem',
    }[prefix] ?? 'item'
  );
}

function joinHtml(items) {
  if (items.length < 2) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items.at(-1)}`;
}

function referenceHtml(command, keys, labels) {
  const links = keys.map((key, index) => {
    const number = labels.get(key);
    if (!number) throw new Error(`Unresolved LaTeX reference: ${key}`);
    let text = number;
    if (command === 'eqref') text = `(${number})`;
    if (command === 'cref' || command === 'Cref') {
      const kind = labelKind(key);
      const prefix = command === 'Cref' && index === 0 ? `${kind[0].toUpperCase()}${kind.slice(1)}` : kind;
      text = `${prefix} ${number}`;
    }
    return `<a class="paper-reference" href="#${escapeHtml(key)}">${escapeHtml(text)}</a>`;
  });
  return joinHtml(links);
}

function citationHtml(command, keys, citations, note = '') {
  const records = keys.map((key) => {
    const record = citations.get(key);
    if (!record) throw new Error(`Unresolved LaTeX citation: ${key}`);
    return { key, ...record };
  });
  const authorYear = records.every((record) => record.author && record.year);

  if (authorYear) {
    if (command === 'citet') {
      return joinHtml(
        records.map(
          (record) =>
            `<a class="paper-citation" href="#ref-${escapeHtml(record.key)}">${escapeHtml(record.author)} (${escapeHtml(record.year)})</a>`,
        ),
      );
    }
    const body = records
      .map(
        (record) =>
          `<a class="paper-citation" href="#ref-${escapeHtml(record.key)}">${escapeHtml(record.author)}, ${escapeHtml(record.year)}</a>`,
      )
      .join('; ');
    return `(${body}${note ? `, ${escapeHtml(note)}` : ''})`;
  }

  const body = records
    .map((record) => `<a class="paper-citation" href="#ref-${escapeHtml(record.key)}">${escapeHtml(record.number)}</a>`)
    .join(', ');
  return `[${body}${note ? `, ${escapeHtml(note)}` : ''}]`;
}

function replaceCommands(source, pattern, markerPrefix, render) {
  const replacements = new Map();
  const formulaReplacements = new Map();
  let count = 0;
  const output = source.replace(pattern, (match, command, rawKeys) => {
    const keys = rawKeys
      .split(',')
      .map((key) => key.trim())
      .filter(Boolean);
    if (keys.length === 0) throw new Error(`Empty LaTeX command: ${match}`);
    const marker = `${markerPrefix}${String(count++).padStart(6, '0')}END`;
    const rendered = render(command, keys);
    replacements.set(marker, rendered);
    formulaReplacements.set(marker, htmlAsFormulaText(rendered));
    return marker;
  });
  return { output, replacements, formulaReplacements };
}

function replaceCitations(source, citations) {
  const replacements = new Map();
  const formulaReplacements = new Map();
  let count = 0;
  const output = source.replace(/\\(citep|citet|cite)(?:\[([^\]]*)\])?\{([^{}]+)\}/g, (match, command, rawNote, rawKeys) => {
    const keys = rawKeys
      .split(',')
      .map((key) => key.trim())
      .filter(Boolean);
    if (keys.length === 0) throw new Error(`Empty LaTeX command: ${match}`);
    const marker = `${CITATION_MARKER}${String(count++).padStart(6, '0')}END`;
    const note = latexText((rawNote ?? '').replace(/\\S\s*/g, '§'));
    const rendered = citationHtml(command, keys, citations, note);
    replacements.set(marker, rendered);
    formulaReplacements.set(marker, htmlAsFormulaText(rendered));
    return marker;
  });
  return { output, replacements, formulaReplacements };
}

function htmlAsFormulaText(html) {
  const escapes = {
    '\\': '\\textbackslash{}',
    '{': '\\{',
    '}': '\\}',
    '#': '\\#',
    $: '\\$',
    '%': '\\%',
    '&': '\\&',
    _: '\\_',
    '^': '\\textasciicircum{}',
    '~': '\\textasciitilde{}',
  };
  const value = [...textContent(parseFragment(html))].map((character) => escapes[character] ?? character).join('');
  return `\\textup{${value}}`;
}

function parseBibliographyItems(block) {
  const starts = [];
  const pattern = /\\bibitem\b/g;
  for (let match = pattern.exec(block); match; match = pattern.exec(block)) starts.push(match.index);
  if (starts.length === 0) throw new Error('Inline bibliography contains no \\bibitem entries');

  return starts.map((start, index) => {
    let cursor = start + '\\bibitem'.length;
    while (/\s/.test(block[cursor] ?? '')) cursor++;
    if (block[cursor] === '[') cursor = readDelimited(block, cursor, '[', ']').end;
    while (/\s/.test(block[cursor] ?? '')) cursor++;
    const key = readDelimited(block, cursor);
    const end = starts[index + 1] ?? block.length;
    return { key: key.value, body: block.slice(key.end, end).trim() };
  });
}

function convertInlineBibliography(source) {
  const beginPattern = /\\begin\{thebibliography\}\{[^{}]*\}/;
  const begin = beginPattern.exec(source);
  if (!begin) return source;
  const endToken = '\\end{thebibliography}';
  const end = source.indexOf(endToken, begin.index + begin[0].length);
  if (end === -1) throw new Error('Inline bibliography has no closing environment');
  const block = source.slice(begin.index + begin[0].length, end);
  const items = parseBibliographyItems(block);
  const replacement = [
    '\\section*{References}',
    '\\begin{enumerate}',
    ...items.map(({ key, body }) => `\\item \\hypertarget{ref-${key}}{} ${body}`),
    '\\end{enumerate}',
  ].join('\n\n');
  return `${source.slice(0, begin.index)}${replacement}${source.slice(end + endToken.length)}`;
}

function addNonMathAnchors(source) {
  const floated = source.replace(/\\begin\{(table|figure)\*?\}[\s\S]*?\\end\{\1\*?\}/g, (block) => {
    const labels = [...block.matchAll(/\\label(?:\[[^\]]*\])?\{((?:tab|fig):[^{}]+)\}/g)].map((match) => match[1]);
    if (labels.length === 0) return block;
    const withoutLabels = block.replace(/\\label(?:\[[^\]]*\])?\{(?:tab|fig):[^{}]+\}/g, '');
    return `${labels.map((label) => `\\hypertarget{${label}}{}`).join('\n')}\n${withoutLabels}`;
  });
  return floated.replace(/\\label(?:\[[^\]]*\])?\{([^{}]+)\}/g, (match, label) => {
    if (/^(?:eq|sec|subsec):/.test(label)) return match;
    return `\\hypertarget{${label}}{}`;
  });
}

function normalizeWebTex(source) {
  return source
    .replace(/\\doi\{([^{}]+)\}/g, '\\href{https://doi.org/$1}{doi:$1}')
    .replace(/\\newblock\b/g, '\n')
    .replace(/\\penalty\s*\d+/g, '')
    .replace(/\\allowdisplaybreaks(?:\[[^\]]*\])?/g, '');
}

const SECTION_LEVEL = new Map([
  ['part', 0],
  ['chapter', 1],
  ['section', 2],
  ['subsection', 3],
  ['subsubsection', 4],
]);

function normalizedHeading(value) {
  return latexText(value).replace(/\s+/g, ' ').trim().normalize('NFC');
}

export function omitWebSections(source, requestedSections = []) {
  if (requestedSections.length === 0) return { source, omittedSections: [] };
  const targets = requestedSections.map(normalizedHeading);
  if (targets.some((target) => !target) || new Set(targets).size !== targets.length) {
    throw new Error('webOmitSections must contain unique non-empty headings');
  }

  const headings = [
    ...source.matchAll(/\\(part|chapter|section|subsection|subsubsection)\*?\s*(?:\[[^\]]*\]\s*)?\{([^{}]*)\}/g),
  ].map((match) => ({
    start: match.index ?? 0,
    command: match[1],
    level: SECTION_LEVEL.get(match[1]) ?? Number.POSITIVE_INFINITY,
    title: normalizedHeading(match[2]),
  }));
  const terminalStarts = [
    source.search(/\\bibliography\s*\{/),
    source.search(/\\begin\{thebibliography\}/),
    source.search(/\\end\{document\}/),
  ].filter((index) => index >= 0);
  const documentEnd = terminalStarts.length > 0 ? Math.min(...terminalStarts) : source.length;
  const intervals = targets.map((target) => {
    const matches = headings.filter((heading) => heading.title === target);
    if (matches.length !== 1) {
      throw new Error(`Expected exactly one web section named "${target}", found ${matches.length}`);
    }
    const heading = matches[0];
    const next = headings.find((candidate) => candidate.start > heading.start && candidate.level <= heading.level);
    return { start: heading.start, end: next?.start ?? documentEnd, title: target };
  });
  const ordered = intervals.toSorted((left, right) => right.start - left.start);
  let output = source;
  for (const interval of ordered) output = `${output.slice(0, interval.start)}${output.slice(interval.end)}`;
  const remainingHeadings = [
    ...output.matchAll(/\\(?:part|chapter|section|subsection|subsubsection)\*?\s*(?:\[[^\]]*\]\s*)?\{([^{}]*)\}/g),
  ].map((match) => normalizedHeading(match[1]));
  for (const target of targets) {
    if (remainingHeadings.includes(target)) throw new Error(`Unable to omit web section "${target}"`);
  }
  return { source: output, omittedSections: targets };
}

export function prepareWebTex(source, aux, { pandocCitations = false, omitSections = [] } = {}) {
  const omitted = omitWebSections(source, omitSections);
  const refs = replaceCommands(omitted.source, /\\(eqref|ref|cref|Cref)\{([^{}]+)\}/g, REFERENCE_MARKER, (command, keys) =>
    referenceHtml(command, keys, aux.labels),
  );

  let output = refs.output;
  let citations = { replacements: new Map(), formulaReplacements: new Map() };
  if (!pandocCitations) {
    citations = replaceCitations(output, aux.citations);
    output = convertInlineBibliography(citations.output);
  }

  output = normalizeWebTex(addNonMathAnchors(output));
  return {
    source: output,
    replacements: new Map([...refs.replacements, ...citations.replacements]),
    formulaReplacements: new Map([...refs.formulaReplacements, ...citations.formulaReplacements]),
    omittedSections: omitted.omittedSections,
  };
}

function textContent(node) {
  if (node.nodeName === '#text') return node.value ?? '';
  return (node.childNodes ?? []).map(textContent).join('');
}

function visibleTextContent(node) {
  if (node.nodeName === '#text') return node.value ?? '';
  if (['annotation', 'noscript', 'script', 'style'].includes(node.tagName)) return '';
  return (node.childNodes ?? []).map(visibleTextContent).join('');
}

function attribute(node, name) {
  return node.attrs?.find((item) => item.name === name)?.value;
}

function mathTex(node) {
  const content = textContent(node).trim();
  if (content.startsWith('\\(') && content.endsWith('\\)')) return content.slice(2, -2);
  if (content.startsWith('\\[') && content.endsWith('\\]')) return content.slice(2, -2);
  return content;
}

export function equationSourceIdentity(tex) {
  const normalized = tex.normalize('NFC').replace(/\s+/g, ' ').trim();
  const labels = [...normalized.matchAll(/\\label(?:\[[^\]]*\])?\{([^{}]+)\}/g)].map((match) => match[1]);
  const sourceHash = createHash('sha256').update(normalized).digest('hex');
  const sourceKeys = [...labels.map((label) => `label:${label}`), `sha256:${sourceHash}`];
  return {
    labels,
    sourceHash,
    sourceKeys,
    sourceKey: sourceKeys[0],
  };
}

function collectMathNodes(node, output, insideContainedEnvironment = false) {
  const classes = attribute(node, 'class')?.split(/\s+/) ?? [];
  const contained = insideContainedEnvironment || classes.some((name) => CONTAINED_EQUATION_CLASSES.has(name));
  if (node.tagName === 'span' && classes.includes('math') && classes.includes('display')) {
    output.push({ tex: mathTex(node).normalize('NFC'), context: contained ? 'contained' : 'standalone' });
  }
  for (const child of node.childNodes ?? []) collectMathNodes(child, output, contained);
}

export function collectDisplayEquations(slug, standaloneHtml, formulaReplacements = new Map()) {
  const document = parse(standaloneHtml.normalize('NFC'));
  const htmlNode = document.childNodes.find((node) => node.tagName === 'html');
  const body = htmlNode?.childNodes?.find((node) => node.tagName === 'body');
  if (!body) throw new Error(`${slug}: Pandoc output has no body`);
  const equations = [];
  collectMathNodes(body, equations);
  return equations.map((equation) => {
    const restored = replaceMarkers(equation.tex, formulaReplacements);
    if (restored.includes(REFERENCE_MARKER) || restored.includes(CITATION_MARKER)) {
      throw new Error(`${slug}: unresolved build marker remains in a display equation`);
    }
    return { tex: restored, context: equation.context, ...equationSourceIdentity(restored) };
  });
}

function displaySvgHtml(asset) {
  if (!asset) return '';
  return EQUATION_VARIANTS.map((variant) => {
    const value = asset.variants?.[variant];
    if (!value) throw new Error(`Missing ${variant} SVG for ${asset.id}`);
    if (!/^-?\d+(?:\.\d+)?(?:\s+-?\d+(?:\.\d+)?){3}$/.test(value.viewBox)) {
      throw new Error(`Invalid ${variant} SVG viewBox for ${asset.id}`);
    }
    if (!Number.isFinite(value.widthEm) || value.widthEm <= 0) {
      throw new Error(`Invalid ${variant} SVG width for ${asset.id}`);
    }
    if (!['original', 'single-line', 'compact'].includes(value.layout)) {
      throw new Error(`Invalid ${variant} SVG layout for ${asset.id}`);
    }
    return [
      `<svg class="paper-equation-svg paper-equation-svg--${variant}"`,
      ` viewBox="${escapeHtml(value.viewBox)}"`,
      ` style="--paper-equation-svg-width:${value.widthEm.toFixed(4)}em"`,
      ` data-equation-layout="${value.layout}"`,
      ` data-equation-overflow="${value.overflow ? 'true' : 'false'}"`,
      ' preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">',
      `<use href="${escapeHtml(value.href)}" width="100%" height="100%"></use>`,
      '</svg>',
    ].join('');
  }).join('');
}

function renderMath(tex, displayMode, labels, macros, displayAsset) {
  const anchors = [];
  const compatibleTex = tex.replaceAll('\\lhook\\joinrel\\longrightarrow', '\\hookrightarrow');
  const hasExplicitTag = /\\tag\*?\s*\{/.test(compatibleTex);
  const normalized = compatibleTex.replace(/\\label(?:\[[^\]]*\])?\{([^{}]+)\}/g, (_, key) => {
    const number = labels.get(key);
    if (!number) throw new Error(`Unresolved equation label: ${key}`);
    anchors.push(`<span class="paper-anchor" id="${escapeHtml(key)}" aria-hidden="true"></span>`);
    return hasExplicitTag ? '' : `\\tag{${number}}`;
  });
  const mathml = temml.renderToString(normalized, {
    displayMode,
    macros: { ...DEFAULT_MATH_MACROS, ...macros },
    throwOnError: true,
    trust: false,
  });
  const anchorHtml = anchors.join('');
  if (!displayMode) return `${anchorHtml}${mathml}`;
  const svg = displaySvgHtml(displayAsset);
  const context = displayAsset?.context === 'contained' ? 'contained' : 'standalone';
  const shellClass = context === 'contained' ? 'paper-equation paper-equation--contained' : 'paper-equation';

  return [
    `<span class="${shellClass}" data-equation-context="${context}">`,
    anchorHtml,
    '<span class="paper-equation-scroll">',
    svg,
    displayAsset ? `<span class="paper-equation-semantic">${mathml}</span>` : mathml,
    '</span>',
    '<span class="paper-equation-hint" aria-hidden="true"></span>',
    '</span>',
  ].join('');
}

function replaceMathNodes(parent, aux, macros, displayAssets, state) {
  const children = parent.childNodes ?? [];
  for (let index = 0; index < children.length; index++) {
    const node = children[index];
    const classes = attribute(node, 'class')?.split(/\s+/) ?? [];
    if (node.tagName === 'span' && classes.includes('math')) {
      const displayMode = classes.includes('display');
      const asset = displayMode ? displayAssets[state.displayIndex++] : undefined;
      const rendered = renderMath(mathTex(node), displayMode, aux.labels, macros, asset);
      const replacements = parseFragment(rendered).childNodes;
      for (const replacement of replacements) replacement.parentNode = parent;
      children.splice(index, 1, ...replacements);
      index += replacements.length - 1;
      continue;
    }
    replaceMathNodes(node, aux, macros, displayAssets, state);
  }
}

function wrapDisplayMathNodes(parent) {
  const children = parent.childNodes ?? [];
  for (let index = 0; index < children.length; index++) {
    const node = children[index];
    if (
      node.tagName === 'math' &&
      attribute(node, 'display') === 'block' &&
      !hasClass(parent, 'paper-equation-scroll') &&
      !hasAncestorClass(node, 'paper-equation')
    ) {
      let start = index;
      while (start > 0 && hasClass(children[start - 1], 'paper-anchor')) start--;

      const shell = parseFragment(
        '<span class="paper-equation"><span class="paper-equation-scroll"></span><span class="paper-equation-hint" aria-hidden="true"></span></span>',
      ).childNodes[0];
      const scroller = shell.childNodes.find((child) => hasClass(child, 'paper-equation-scroll'));
      const anchors = children.slice(start, index);
      for (const anchor of anchors) anchor.parentNode = shell;
      node.parentNode = scroller;
      scroller.childNodes = [node];
      shell.childNodes = [...anchors, ...shell.childNodes];
      shell.parentNode = parent;
      children.splice(start, index - start + 1, shell);
      index = start;
      continue;
    }
    wrapDisplayMathNodes(node);
  }
}

function replaceMarkers(html, replacements) {
  let output = html;
  for (const [marker, replacement] of replacements) output = output.replaceAll(marker, replacement);
  return output;
}

function collectHtmlFacts(node, facts) {
  if (node.attrs) {
    const id = attribute(node, 'id');
    if (id) facts.ids.add(id);
    const href = attribute(node, 'href');
    if (href?.startsWith('#') && href.length > 1) facts.links.add(decodeURIComponent(href.slice(1)));
  }
  for (const child of node.childNodes ?? []) collectHtmlFacts(child, facts);
}

function hasClass(node, name) {
  return (attribute(node, 'class')?.split(/\s+/) ?? []).includes(name);
}

function setAttribute(node, name, value) {
  node.attrs ??= [];
  const existing = node.attrs.find((item) => item.name === name);
  if (existing) existing.value = value;
  else node.attrs.push({ name, value });
}

function hasContainedEnvironmentAncestor(node) {
  let current = node.parentNode;
  while (current) {
    const classes = attribute(current, 'class')?.split(/\s+/) ?? [];
    if (classes.some((name) => CONTAINED_EQUATION_CLASSES.has(name))) return true;
    current = current.parentNode;
  }
  return false;
}

function markEquationContexts(node) {
  if (hasClass(node, 'paper-equation')) {
    const contained = hasContainedEnvironmentAncestor(node);
    const classes = new Set(attribute(node, 'class')?.split(/\s+/).filter(Boolean) ?? []);
    if (contained) classes.add('paper-equation--contained');
    else classes.delete('paper-equation--contained');
    setAttribute(node, 'class', [...classes].join(' '));
    setAttribute(node, 'data-equation-context', contained ? 'contained' : 'standalone');
  }
  for (const child of node.childNodes ?? []) markEquationContexts(child);
}

function hasAncestorClass(node, name) {
  let current = node.parentNode;
  while (current) {
    if (hasClass(current, name)) return true;
    current = current.parentNode;
  }
  return false;
}

function closestAncestorWithClass(node, name) {
  let current = node.parentNode;
  while (current) {
    if (hasClass(current, name)) return current;
    current = current.parentNode;
  }
  return undefined;
}

function collectEquationFacts(node, facts) {
  if (node.tagName === 'math' && attribute(node, 'display') === 'block') facts.displayMath.push(node);
  if (hasClass(node, 'paper-equation')) facts.equations.push(node);
  if (hasClass(node, 'paper-equation-scroll')) facts.scrollers.push(node);
  if (hasClass(node, 'paper-equation-semantic')) facts.semantic.push(node);
  if (hasClass(node, 'paper-equation-svg')) facts.svgs.push(node);
  if (node.tagName === 'use' && hasClass(node.parentNode, 'paper-equation-svg')) facts.uses.push(node);
  if (hasClass(node, 'paper-anchor')) facts.anchors.push(node);
  for (const child of node.childNodes ?? []) collectEquationFacts(child, facts);
}

function displayMathDescendants(node) {
  const facts = { displayMath: [], equations: [], scrollers: [], semantic: [], svgs: [], uses: [], anchors: [] };
  collectEquationFacts(node, facts);
  return facts.displayMath;
}

export function validateGeneratedHtml(slug, html, { requireSvg = false, expectedDisplayCount } = {}) {
  if (!/<h[1-6][\s>]/i.test(html)) throw new Error(`${slug}: generated HTML has no headings`);
  if (!/<math[\s>]/i.test(html)) throw new Error(`${slug}: generated HTML has no MathML`);
  if (/<span[^>]+class="[^"]*\bmath\b/i.test(html)) throw new Error(`${slug}: unconverted math span remains`);
  if (html.includes(REFERENCE_MARKER) || html.includes(CITATION_MARKER)) {
    throw new Error(`${slug}: unresolved build marker remains`);
  }
  const document = parseFragment(html);
  const visibleText = visibleTextContent(document);
  if (FORBIDDEN_LATEX.test(visibleText)) throw new Error(`${slug}: raw LaTeX command leaked into the page`);
  if (MOJIBAKE.test(visibleText)) throw new Error(`${slug}: suspected mojibake or replacement character`);
  if (containsForbiddenControlCharacter(visibleText)) throw new Error(`${slug}: forbidden control character in page text`);
  if (visibleText !== visibleText.normalize('NFC')) throw new Error(`${slug}: page text is not Unicode NFC`);
  if (/<merror[\s>]/i.test(html)) throw new Error(`${slug}: MathML contains a rendering error`);
  if (/<span[^>]+class="[^"]*citation[^"]*"[^>]*>\s*<\/span>/i.test(html)) {
    throw new Error(`${slug}: empty citation remained after conversion`);
  }

  const facts = { ids: new Set(), links: new Set() };
  collectHtmlFacts(document, facts);
  const missing = [...facts.links].filter((target) => !facts.ids.has(target));
  if (missing.length > 0) throw new Error(`${slug}: missing internal link targets: ${missing.slice(0, 8).join(', ')}`);

  const equations = { displayMath: [], equations: [], scrollers: [], semantic: [], svgs: [], uses: [], anchors: [] };
  collectEquationFacts(document, equations);
  if (
    equations.displayMath.length !== equations.equations.length ||
    equations.displayMath.length !== equations.scrollers.length
  ) {
    throw new Error(
      `${slug}: display MathML wrapper mismatch (${equations.displayMath.length} math, ${equations.equations.length} containers, ${equations.scrollers.length} scrollers)`,
    );
  }
  for (const math of equations.displayMath) {
    const scroller = closestAncestorWithClass(math, 'paper-equation-scroll');
    const shell = scroller?.parentNode;
    if (!hasClass(scroller, 'paper-equation-scroll') || !hasClass(shell, 'paper-equation')) {
      throw new Error(`${slug}: display MathML is not inside the required equation container`);
    }
  }
  for (const shell of equations.equations) {
    if (displayMathDescendants(shell).length !== 1) {
      throw new Error(`${slug}: each equation container must contain exactly one display MathML node`);
    }
    const contained = hasContainedEnvironmentAncestor(shell);
    if (contained !== hasClass(shell, 'paper-equation--contained')) {
      throw new Error(`${slug}: equation context class does not match its surrounding environment`);
    }
    if (attribute(shell, 'data-equation-context') !== (contained ? 'contained' : 'standalone')) {
      throw new Error(`${slug}: equation context metadata does not match its surrounding environment`);
    }
  }
  if (expectedDisplayCount !== undefined && equations.displayMath.length !== expectedDisplayCount) {
    throw new Error(`${slug}: expected ${expectedDisplayCount} display equations, received ${equations.displayMath.length}`);
  }
  if (requireSvg) {
    if (equations.semantic.length !== equations.displayMath.length) {
      throw new Error(`${slug}: each display equation must retain one semantic MathML fallback`);
    }
    if (equations.svgs.length !== equations.displayMath.length * EQUATION_VARIANTS.length) {
      throw new Error(
        `${slug}: expected ${equations.displayMath.length * EQUATION_VARIANTS.length} responsive SVG uses, received ${equations.svgs.length}`,
      );
    }
    if (equations.uses.length !== equations.svgs.length) {
      throw new Error(`${slug}: each responsive equation SVG must contain one external sprite use`);
    }
    for (const svg of equations.svgs) {
      const variantCount = EQUATION_VARIANTS.filter((variant) => hasClass(svg, `paper-equation-svg--${variant}`)).length;
      const viewBox = attribute(svg, 'viewBox')?.trim().split(/\s+/).map(Number);
      if (
        variantCount !== 1 ||
        viewBox?.length !== 4 ||
        viewBox.some((value) => !Number.isFinite(value)) ||
        viewBox[0] !== 0 ||
        viewBox[1] !== 0 ||
        !attribute(svg, 'style') ||
        !['original', 'single-line', 'compact'].includes(attribute(svg, 'data-equation-layout')) ||
        !['true', 'false'].includes(attribute(svg, 'data-equation-overflow'))
      ) {
        throw new Error(`${slug}: malformed responsive equation SVG`);
      }
    }
    for (const use of equations.uses) {
      const href = attribute(use, 'href');
      if (
        !href?.startsWith(`/papers/${slug}/equations-`) ||
        !href.includes('.svg#eq-') ||
        attribute(use, 'width') !== '100%' ||
        attribute(use, 'height') !== '100%'
      ) {
        throw new Error(`${slug}: invalid equation sprite reference: ${href ?? 'missing'}`);
      }
    }
  }
  for (const anchor of equations.anchors) {
    if (!hasClass(anchor.parentNode, 'paper-equation')) {
      throw new Error(`${slug}: equation anchor is outside its container`);
    }
  }
}

export function normalizeGeneratedHtml(slug, html) {
  const document = parseFragment(html.normalize('NFC'));
  wrapDisplayMathNodes(document);
  markEquationContexts(document);
  const normalized = serialize(document).trim().normalize('NFC');
  validateGeneratedHtml(slug, normalized);
  return normalized;
}

export function convertPandocHtml({
  slug,
  standaloneHtml,
  aux,
  replacements,
  macros = {},
  displayAssets = /** @type {Array<{ id: string, context: 'standalone' | 'contained', variants: Record<string, { href: string, viewBox: string, widthEm: number, layout: 'original' | 'single-line', overflow: boolean }> }>} */ ([]),
}) {
  const document = parse(standaloneHtml.normalize('NFC'));
  const htmlNode = document.childNodes.find((node) => node.tagName === 'html');
  const body = htmlNode?.childNodes?.find((node) => node.tagName === 'body');
  if (!body) throw new Error(`${slug}: Pandoc output has no body`);
  const state = { displayIndex: 0 };
  replaceMathNodes(body, aux, macros, displayAssets, state);
  if (displayAssets.length > 0 && state.displayIndex !== displayAssets.length) {
    throw new Error(`${slug}: display equation asset mismatch (${state.displayIndex} HTML, ${displayAssets.length} SVG)`);
  }
  const converted = replaceMarkers(serialize(body), replacements)
    .replaceAll('../../../../public/og.png', '/og.png')
    .trim()
    .normalize('NFC');
  const normalized = normalizeGeneratedHtml(slug, converted);
  validateGeneratedHtml(slug, normalized, {
    requireSvg: displayAssets.length > 0,
    expectedDisplayCount: state.displayIndex,
  });
  return normalized;
}
