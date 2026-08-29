import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, extname, join } from 'node:path';
import { parse } from 'yaml';
import { verifyPaperToolchain } from './check-paper-toolchain.mjs';
import { collectDisplayEquations, convertPandocHtml, normalizeGeneratedHtml, parseAux, prepareWebTex } from './paper-html.mjs';
import {
  buildEquationBatchTex,
  createEquationRenderPlan,
  createEquationSprite,
  EQUATION_VARIANTS,
  equationAssetsFromVariants,
} from './paper-svg.mjs';

const strict = process.argv.includes('--strict');
const requestedSlug = process.argv.find((argument) => argument.startsWith('--paper='))?.slice('--paper='.length);
const root = process.cwd();
const papersRoot = join(root, 'src/content/papers');
const outputRoot = join(root, 'public/papers');
const pandocBin = process.env.PANDOC_BIN || 'pandoc';
const tectonicBin = process.env.TECTONIC_BIN || 'tectonic';
const dvisvgmBin = process.env.DVISVGM_BIN || 'dvisvgm';
const localTexEngine = process.env.PAPER_TEX_ENGINE === 'texlive';
const latexmkBin = process.env.LATEXMK_BIN || 'latexmk';
const xelatexBin = process.env.XELATEX_BIN || 'xelatex';
const kpsewhichBin = process.env.KPSEWHICH_BIN || 'kpsewhich';
const expectedDisplayEquations = new Map([
  ['horizon-uniform-sensitivity', 126],
  ['bernstein-transfers-greedy-records', 193],
  ['cycle-decorated-ribbon-complexes', 175],
]);
const paperEquationVariants = new Set(EQUATION_VARIANTS.map((variant) => variant.name));
const paperEquationLayouts = new Set(['auto', 'original', 'compact']);

function paperWebOptions(meta, slug) {
  const omitSections = meta.webOmitSections ?? [];
  if (
    !Array.isArray(omitSections) ||
    omitSections.some((item) => typeof item !== 'string' || item.trim() === '') ||
    new Set(omitSections).size !== omitSections.length
  ) {
    throw new Error(`${slug}: invalid webOmitSections`);
  }

  const rawLayouts = meta.webEquationLayouts ?? {};
  if (!rawLayouts || typeof rawLayouts !== 'object' || Array.isArray(rawLayouts)) {
    throw new Error(`${slug}: invalid webEquationLayouts`);
  }
  const equationLayouts = {};
  for (const [key, config] of Object.entries(rawLayouts)) {
    if (!/^(?:label:[^\s]+|sha256:[a-f0-9]{64})$/.test(key)) {
      throw new Error(`${slug}: invalid webEquationLayouts key ${key}`);
    }
    if (typeof config === 'string') {
      if (!paperEquationLayouts.has(config)) throw new Error(`${slug}: invalid equation layout for ${key}`);
      equationLayouts[key] = config;
      continue;
    }
    if (!config || typeof config !== 'object' || Array.isArray(config) || Object.keys(config).length === 0) {
      throw new Error(`${slug}: invalid responsive equation layout for ${key}`);
    }
    for (const [variant, layout] of Object.entries(config)) {
      if (!paperEquationVariants.has(variant) || !paperEquationLayouts.has(layout)) {
        throw new Error(`${slug}: invalid ${variant} equation layout for ${key}`);
      }
    }
    equationLayouts[key] = config;
  }
  return { omitSections: omitSections.map((item) => item.trim()), equationLayouts };
}

function applyEquationLayouts(slug, equations, layouts) {
  const used = new Set();
  const configured = equations.map((equation) => {
    const matches = equation.sourceKeys.filter((key) => Object.hasOwn(layouts, key));
    if (matches.length === 0) return { ...equation, layoutPreference: 'auto' };
    const first = layouts[matches[0]];
    for (const key of matches) {
      used.add(key);
      if (JSON.stringify(layouts[key]) !== JSON.stringify(first)) {
        throw new Error(`${slug}: conflicting equation layout overrides for ${equation.sourceKey}`);
      }
    }
    return { ...equation, layoutPreference: first };
  });
  const unused = Object.keys(layouts).filter((key) => !used.has(key));
  if (unused.length > 0) throw new Error(`${slug}: unused equation layout overrides: ${unused.join(', ')}`);
  return configured;
}

function readUtf8(path) {
  const bytes = readFileSync(path);
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes).normalize('NFC');
}

function hasCommand(command, kind) {
  // Tectonic 0.16 removed the legacy --version flag; --help remains stable.
  const args = kind === 'tectonic' ? ['--help'] : ['--version'];
  return spawnSync(command, args, { stdio: 'ignore' }).status === 0;
}

function run(command, args, cwd, { env = process.env, rejectOutput = [] } = {}) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', env });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${basename(command)} failed with exit code ${result.status ?? 'unknown'}`);
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  for (const pattern of rejectOutput) {
    if (pattern.test(output)) throw new Error(`${basename(command)} reported an unsafe font or TeX configuration warning`);
  }
}

function resolveDvisvgmEnvironment() {
  const env = { ...process.env };
  for (const variable of ['TEXMFCNF', 'TEXMFROOT']) {
    if (env[variable]) continue;
    const result = spawnSync(kpsewhichBin, [`-var-value=${variable}`], { encoding: 'utf8' });
    const value = result.status === 0 ? result.stdout.trim() : '';
    if (value) env[variable] = value;
  }
  return env;
}

const dvisvgmEnvironment = resolveDvisvgmEnvironment();
const unsafeDvisvgmWarnings = [
  /configuration file texmf\.cnf not found/i,
  /none of the default map files could be found/i,
  /no font file found for/i,
  /can't embed font/i,
];

function compilePaper({ cwd, input, outputDirectory }) {
  if (!localTexEngine) {
    run(tectonicBin, ['--keep-intermediates', '--keep-logs', '--outdir', outputDirectory, input], cwd);
    return;
  }
  run(
    latexmkBin,
    ['-xelatex', '-interaction=nonstopmode', '-halt-on-error', '-file-line-error', `-outdir=${outputDirectory}`, input],
    cwd,
  );
}

function compileEquationBatch({ cwd, input, outputDirectory }) {
  if (!localTexEngine) {
    run(tectonicBin, ['--keep-logs', '--outfmt=xdv', '--outdir', outputDirectory, input], cwd);
    return;
  }
  run(
    xelatexBin,
    [
      '-no-pdf',
      '-interaction=nonstopmode',
      '-halt-on-error',
      '-file-line-error',
      `-output-directory=${outputDirectory}`,
      input,
    ],
    cwd,
  );
}

function outputStem(filename) {
  return basename(filename, extname(filename));
}

function copyPaperInputs(sourceDirectory, destinationDirectory) {
  for (const entry of readdirSync(sourceDirectory, { withFileTypes: true })) {
    if (entry.name === 'generated.html') continue;
    const source = join(sourceDirectory, entry.name);
    const destination = join(destinationDirectory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Paper input must not be a symbolic link: ${source}`);
    if (entry.isDirectory()) {
      mkdirSync(destination, { recursive: true });
      copyPaperInputs(source, destination);
    } else if (entry.isFile()) {
      copyFileSync(source, destination);
    }
  }
}

const hasPandoc = hasCommand(pandocBin, 'pandoc');
const hasTectonic = hasCommand(tectonicBin, 'tectonic');
const hasDvisvgm = hasCommand(dvisvgmBin, 'dvisvgm');
const hasLocalTexEngine = localTexEngine && hasCommand(latexmkBin, 'latexmk') && hasCommand(xelatexBin, 'xelatex');
if (strict && (!hasPandoc || !hasTectonic || !hasDvisvgm)) {
  throw new Error(
    'Strict paper build requires pandoc, tectonic, and dvisvgm. Set PANDOC_BIN/TECTONIC_BIN/DVISVGM_BIN if needed.',
  );
}
if (strict && localTexEngine) throw new Error('Strict paper builds cannot use the local TeX Live debugging fallback.');
if (strict) {
  verifyPaperToolchain({ tectonic: tectonicBin, pandoc: pandocBin, dvisvgm: dvisvgmBin });
}

const allPaperEntries = readdirSync(papersRoot, { withFileTypes: true }).filter((item) => item.isDirectory());
const paperEntries = requestedSlug ? allPaperEntries.filter((item) => item.name === requestedSlug) : allPaperEntries;
if (requestedSlug && paperEntries.length === 0) throw new Error(`Unknown paper slug: ${requestedSlug}`);
for (const entry of paperEntries) {
  const slug = entry.name;
  const paperDir = join(papersRoot, slug);
  const configPath = join(paperDir, 'paper.yml');
  if (!existsSync(configPath)) throw new Error(`${slug}: missing paper.yml`);
  const meta = parse(readUtf8(configPath));
  const texEntry = meta.texEntry;
  if (!texEntry || !existsSync(join(paperDir, texEntry))) throw new Error(`${slug}: invalid texEntry`);
  const htmlEntry = meta.htmlEntry ?? texEntry;
  if (!existsSync(join(paperDir, htmlEntry))) throw new Error(`${slug}: invalid htmlEntry`);
  if (!['latin-modern', 'computer-modern'].includes(meta.fontProfile)) {
    throw new Error(`${slug}: invalid fontProfile`);
  }
  if (meta.bibliography && !existsSync(join(paperDir, meta.bibliography))) {
    throw new Error(`${slug}: missing bibliography ${meta.bibliography}`);
  }
  const webOptions = paperWebOptions(meta, slug);

  const publicDir = join(outputRoot, slug);
  mkdirSync(publicDir, { recursive: true });

  if (hasPandoc && (hasTectonic || hasLocalTexEngine) && hasDvisvgm) {
    const workDir = mkdtempSync(join(tmpdir(), `pyuyi-paper-${slug}-`));
    copyPaperInputs(paperDir, workDir);
    compilePaper({ cwd: workDir, input: texEntry, outputDirectory: workDir });

    const stem = outputStem(texEntry);
    const auxPath = join(workDir, `${stem}.aux`);
    const pdfPath = join(workDir, `${stem}.pdf`);
    if (!existsSync(auxPath)) throw new Error(`${slug}: Tectonic did not retain an AUX file`);
    if (!existsSync(pdfPath)) throw new Error(`${slug}: Tectonic did not create a PDF`);
    copyFileSync(pdfPath, join(publicDir, 'paper.pdf'));

    const aux = parseAux(readUtf8(auxPath));
    const source = readUtf8(join(paperDir, htmlEntry));
    const web = prepareWebTex(source, aux, {
      pandocCitations: Boolean(meta.bibliography),
      omitSections: webOptions.omitSections,
    });
    const webTexPath = join(workDir, 'web.tex');
    const pandocOutput = join(workDir, 'pandoc.html');
    writeFileSync(webTexPath, web.source, 'utf8');

    const args = [
      webTexPath,
      '--from=latex+raw_tex',
      '--to=html5',
      '--standalone',
      '--toc',
      '--mathjax',
      `--resource-path=${paperDir}`,
    ];
    if (meta.bibliography) {
      args.push('--citeproc', '--metadata=link-citations:true', `--bibliography=${join(paperDir, meta.bibliography)}`);
    }
    args.push(`--output=${pandocOutput}`);
    run(pandocBin, args, paperDir);

    const standaloneHtml = readUtf8(pandocOutput);
    const equations = applyEquationLayouts(
      slug,
      collectDisplayEquations(slug, standaloneHtml, web.formulaReplacements),
      webOptions.equationLayouts,
    );
    const expectedEquationCount = expectedDisplayEquations.get(slug);
    if (expectedEquationCount !== undefined && equations.length !== expectedEquationCount) {
      throw new Error(`${slug}: expected ${expectedEquationCount} display equations, received ${equations.length}`);
    }
    const variantAssets = {};
    for (const variant of EQUATION_VARIANTS) {
      const renderPlan = createEquationRenderPlan(equations, variant);
      const variantWorkDir = join(workDir, `equations-${variant.name}`);
      const svgDirectory = join(variantWorkDir, 'svg');
      mkdirSync(svgDirectory, { recursive: true });
      const batchName = `equations-${variant.name}.tex`;
      const batchPath = join(workDir, batchName);
      const batchSource = buildEquationBatchTex({
        slug,
        source,
        equations,
        labels: aux.labels,
        renderPlan,
      });
      writeFileSync(batchPath, batchSource, 'utf8');
      compileEquationBatch({ cwd: workDir, input: batchPath, outputDirectory: variantWorkDir });
      const xdvPath = join(variantWorkDir, `${outputStem(batchName)}.xdv`);
      if (!existsSync(xdvPath)) throw new Error(`${slug}: Tectonic did not create ${variant.name} equation XDV`);
      run(
        dvisvgmBin,
        [
          '--page=1-',
          '--no-specials=pdf',
          '--no-fonts=0',
          '--currentcolor',
          '--exact-bbox',
          '--verbosity=2',
          `--output=${join(svgDirectory, 'equation-%4p.svg')}`,
          xdvPath,
        ],
        variantWorkDir,
        { env: dvisvgmEnvironment, rejectOutput: unsafeDvisvgmWarnings },
      );
      variantAssets[variant.name] = createEquationSprite({
        slug,
        variant,
        svgDirectory,
        outputPath: join(publicDir, `equations-${variant.name}.svg`),
        equationCount: equations.length,
        renderPlan,
      });
    }
    const displayAssets = equationAssetsFromVariants(slug, variantAssets);
    writeFileSync(
      join(publicDir, 'equations-manifest.json'),
      `${JSON.stringify({ slug, count: equations.length, equations: displayAssets }, null, 2)}\n`,
      'utf8',
    );

    const html = convertPandocHtml({
      slug,
      standaloneHtml,
      aux,
      replacements: web.replacements,
      displayAssets,
    });
    for (const section of web.omittedSections) {
      if (html.includes(section)) throw new Error(`${slug}: omitted web section remains in generated HTML: ${section}`);
    }
    writeFileSync(join(paperDir, 'generated.html'), html, 'utf8');
  } else if (existsSync(join(paperDir, 'generated.html')) && existsSync(join(publicDir, 'paper.pdf'))) {
    const generatedPath = join(paperDir, 'generated.html');
    const normalized = normalizeGeneratedHtml(slug, readUtf8(generatedPath));
    writeFileSync(generatedPath, normalized, 'utf8');
  } else if (strict) {
    throw new Error(`${slug}: paper toolchain unavailable`);
  } else {
    console.warn(`[papers] ${slug}: HTML/PDF will be produced by the strict CI build.`);
  }
}

console.log(`[papers] validated ${paperEntries.length} paper(s)`);
