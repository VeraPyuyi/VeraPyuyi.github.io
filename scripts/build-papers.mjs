import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

const strict = process.argv.includes('--strict');
const root = process.cwd();
const papersRoot = join(root, 'src/content/papers');
const outputRoot = join(root, 'public/papers');

function hasCommand(command) {
  // Tectonic 0.16 removed the legacy --version flag; --help remains stable.
  const args = command === 'tectonic' ? ['--help'] : ['--version'];
  return spawnSync(command, args, { stdio: 'ignore' }).status === 0;
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`${command} failed with exit code ${result.status ?? 'unknown'}`);
}

const hasPandoc = hasCommand('pandoc');
const hasTectonic = hasCommand('tectonic');
if (strict && (!hasPandoc || !hasTectonic)) {
  throw new Error('Strict paper build requires both pandoc and tectonic.');
}

for (const entry of readdirSync(papersRoot, { withFileTypes: true }).filter((item) => item.isDirectory())) {
  const slug = entry.name;
  const paperDir = join(papersRoot, slug);
  const configPath = join(paperDir, 'paper.yml');
  if (!existsSync(configPath)) throw new Error(`${slug}: missing paper.yml`);
  const meta = parse(readFileSync(configPath, 'utf8'));
  const texEntry = meta.texEntry;
  if (!texEntry || !existsSync(join(paperDir, texEntry))) throw new Error(`${slug}: invalid texEntry`);
  if (meta.bibliography && !existsSync(join(paperDir, meta.bibliography))) {
    throw new Error(`${slug}: missing bibliography ${meta.bibliography}`);
  }

  const publicDir = join(outputRoot, slug);
  mkdirSync(publicDir, { recursive: true });

  if (hasPandoc) {
    const args = [texEntry, '--from=latex', '--to=html5', '--standalone', '--toc', '--mathml'];
    if (meta.bibliography) args.push('--citeproc', `--bibliography=${meta.bibliography}`);
    args.push('--output=generated.html');
    run('pandoc', args, paperDir);
    const generatedPath = join(paperDir, 'generated.html');
    const standalone = readFileSync(generatedPath, 'utf8');
    const body = standalone.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1]?.trim() ?? standalone;
    const normalized = body.replaceAll('../../../../public/og.png', '/og.png');
    writeFileSync(generatedPath, normalized);
  } else if (!existsSync(join(paperDir, 'generated.html'))) {
    throw new Error(`${slug}: pandoc unavailable and no checked-in generated.html fallback exists`);
  }

  if (hasTectonic) {
    run('tectonic', ['--outdir', publicDir, texEntry], paperDir);
    const generatedPdf = join(publicDir, texEntry.replace(/\.tex$/i, '.pdf'));
    const finalPdf = join(publicDir, 'paper.pdf');
    if (!existsSync(generatedPdf)) throw new Error(`${slug}: tectonic did not create a PDF`);
    if (generatedPdf !== finalPdf) renameSync(generatedPdf, finalPdf);
  } else if (strict || !existsSync(join(publicDir, 'paper.pdf'))) {
    if (strict) throw new Error(`${slug}: tectonic unavailable`);
    console.warn(`[papers] ${slug}: PDF will be produced by the strict CI build.`);
  }
}

console.log(
  `[papers] validated ${readdirSync(papersRoot, { withFileTypes: true }).filter((e) => e.isDirectory()).length} paper(s)`,
);
