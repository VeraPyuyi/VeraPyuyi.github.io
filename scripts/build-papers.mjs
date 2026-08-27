import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, extname, join } from 'node:path';
import { parse } from 'yaml';
import { convertPandocHtml, parseAux, prepareWebTex, validateGeneratedHtml } from './paper-html.mjs';

const strict = process.argv.includes('--strict');
const requestedSlug = process.argv.find((argument) => argument.startsWith('--paper='))?.slice('--paper='.length);
const root = process.cwd();
const papersRoot = join(root, 'src/content/papers');
const outputRoot = join(root, 'public/papers');
const pandocBin = process.env.PANDOC_BIN || 'pandoc';
const tectonicBin = process.env.TECTONIC_BIN || 'tectonic';

function hasCommand(command, kind) {
  // Tectonic 0.16 removed the legacy --version flag; --help remains stable.
  const args = kind === 'tectonic' ? ['--help'] : ['--version'];
  return spawnSync(command, args, { stdio: 'ignore' }).status === 0;
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${basename(command)} failed with exit code ${result.status ?? 'unknown'}`);
}

function outputStem(filename) {
  return basename(filename, extname(filename));
}

const hasPandoc = hasCommand(pandocBin, 'pandoc');
const hasTectonic = hasCommand(tectonicBin, 'tectonic');
if (strict && (!hasPandoc || !hasTectonic)) {
  throw new Error('Strict paper build requires both pandoc and tectonic. Set PANDOC_BIN/TECTONIC_BIN if needed.');
}

const allPaperEntries = readdirSync(papersRoot, { withFileTypes: true }).filter((item) => item.isDirectory());
const paperEntries = requestedSlug ? allPaperEntries.filter((item) => item.name === requestedSlug) : allPaperEntries;
if (requestedSlug && paperEntries.length === 0) throw new Error(`Unknown paper slug: ${requestedSlug}`);
for (const entry of paperEntries) {
  const slug = entry.name;
  const paperDir = join(papersRoot, slug);
  const configPath = join(paperDir, 'paper.yml');
  if (!existsSync(configPath)) throw new Error(`${slug}: missing paper.yml`);
  const meta = parse(readFileSync(configPath, 'utf8'));
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

  const publicDir = join(outputRoot, slug);
  mkdirSync(publicDir, { recursive: true });

  if (hasPandoc && hasTectonic) {
    const workDir = mkdtempSync(join(tmpdir(), `pyuyi-paper-${slug}-`));
    run(tectonicBin, ['--keep-intermediates', '--keep-logs', '--outdir', workDir, texEntry], paperDir);

    const stem = outputStem(texEntry);
    const auxPath = join(workDir, `${stem}.aux`);
    const pdfPath = join(workDir, `${stem}.pdf`);
    if (!existsSync(auxPath)) throw new Error(`${slug}: Tectonic did not retain an AUX file`);
    if (!existsSync(pdfPath)) throw new Error(`${slug}: Tectonic did not create a PDF`);
    copyFileSync(pdfPath, join(publicDir, 'paper.pdf'));

    const aux = parseAux(readFileSync(auxPath, 'utf8'));
    const source = readFileSync(join(paperDir, htmlEntry), 'utf8');
    const web = prepareWebTex(source, aux, { pandocCitations: Boolean(meta.bibliography) });
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

    const html = convertPandocHtml({
      slug,
      standaloneHtml: readFileSync(pandocOutput, 'utf8'),
      aux,
      replacements: web.replacements,
    });
    writeFileSync(join(paperDir, 'generated.html'), html, 'utf8');
  } else if (existsSync(join(paperDir, 'generated.html')) && existsSync(join(publicDir, 'paper.pdf'))) {
    validateGeneratedHtml(slug, readFileSync(join(paperDir, 'generated.html'), 'utf8'));
  } else if (strict) {
    throw new Error(`${slug}: paper toolchain unavailable`);
  } else {
    console.warn(`[papers] ${slug}: HTML/PDF will be produced by the strict CI build.`);
  }
}

console.log(`[papers] validated ${paperEntries.length} paper(s)`);
