import { parse, parseFragment, serialize } from 'parse5';
import temml from 'temml';

const REFERENCE_MARKER = 'PYUYIPAPERREF';
const CITATION_MARKER = 'PYUYIPAPERCITE';
const DEFAULT_MATH_MACROS = {
  '\\hfill': '\\qquad',
};
const FORBIDDEN_LATEX = /\\[A-Za-z@]+/;
const MOJIBAKE = /\uFFFD|Ã.|Â.|â(?:€|€™|€œ|€œ|€“|€”|€¦)|ï¿½/;

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
  let count = 0;
  const output = source.replace(pattern, (match, command, rawKeys) => {
    const keys = rawKeys
      .split(',')
      .map((key) => key.trim())
      .filter(Boolean);
    if (keys.length === 0) throw new Error(`Empty LaTeX command: ${match}`);
    const marker = `${markerPrefix}${String(count++).padStart(6, '0')}END`;
    replacements.set(marker, render(command, keys));
    return marker;
  });
  return { output, replacements };
}

function replaceCitations(source, citations) {
  const replacements = new Map();
  let count = 0;
  const output = source.replace(/\\(citep|citet|cite)(?:\[([^\]]*)\])?\{([^{}]+)\}/g, (match, command, rawNote, rawKeys) => {
    const keys = rawKeys
      .split(',')
      .map((key) => key.trim())
      .filter(Boolean);
    if (keys.length === 0) throw new Error(`Empty LaTeX command: ${match}`);
    const marker = `${CITATION_MARKER}${String(count++).padStart(6, '0')}END`;
    const note = latexText((rawNote ?? '').replace(/\\S\s*/g, '§'));
    replacements.set(marker, citationHtml(command, keys, citations, note));
    return marker;
  });
  return { output, replacements };
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

export function prepareWebTex(source, aux, { pandocCitations = false } = {}) {
  const refs = replaceCommands(source, /\\(eqref|ref|cref|Cref)\{([^{}]+)\}/g, REFERENCE_MARKER, (command, keys) =>
    referenceHtml(command, keys, aux.labels),
  );

  let output = refs.output;
  let citations = { replacements: new Map() };
  if (!pandocCitations) {
    citations = replaceCitations(output, aux.citations);
    output = convertInlineBibliography(citations.output);
  }

  output = normalizeWebTex(addNonMathAnchors(output));
  return {
    source: output,
    replacements: new Map([...refs.replacements, ...citations.replacements]),
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

function renderMath(tex, displayMode, labels, macros) {
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
  return `${anchors.join('')}${mathml}`;
}

function replaceMathNodes(parent, aux, macros) {
  const children = parent.childNodes ?? [];
  for (let index = 0; index < children.length; index++) {
    const node = children[index];
    const classes = attribute(node, 'class')?.split(/\s+/) ?? [];
    if (node.tagName === 'span' && classes.includes('math')) {
      const rendered = renderMath(mathTex(node), classes.includes('display'), aux.labels, macros);
      const replacements = parseFragment(rendered).childNodes;
      for (const replacement of replacements) replacement.parentNode = parent;
      children.splice(index, 1, ...replacements);
      index += replacements.length - 1;
      continue;
    }
    replaceMathNodes(node, aux, macros);
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

export function validateGeneratedHtml(slug, html) {
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
  if (/<span[^>]+class="[^"]*citation[^"]*"[^>]*>\s*<\/span>/i.test(html)) {
    throw new Error(`${slug}: empty citation remained after conversion`);
  }

  const facts = { ids: new Set(), links: new Set() };
  collectHtmlFacts(document, facts);
  const missing = [...facts.links].filter((target) => !facts.ids.has(target));
  if (missing.length > 0) throw new Error(`${slug}: missing internal link targets: ${missing.slice(0, 8).join(', ')}`);
}

export function convertPandocHtml({ slug, standaloneHtml, aux, replacements, macros = {} }) {
  const document = parse(standaloneHtml);
  const htmlNode = document.childNodes.find((node) => node.tagName === 'html');
  const body = htmlNode?.childNodes?.find((node) => node.tagName === 'body');
  if (!body) throw new Error(`${slug}: Pandoc output has no body`);
  replaceMathNodes(body, aux, macros);
  const converted = replaceMarkers(serialize(body), replacements).replaceAll('../../../../public/og.png', '/og.png').trim();
  validateGeneratedHtml(slug, converted);
  return converted;
}
