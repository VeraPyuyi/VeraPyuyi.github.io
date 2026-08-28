import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
export const paperToolchainLock = JSON.parse(readFileSync(join(root, 'paper-toolchain.lock.json'), 'utf8'));

function capture(command, argumentSets) {
  for (const args of argumentSets) {
    const result = spawnSync(command, args, { encoding: 'utf8' });
    if (result.status === 0) return `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim();
  }
  throw new Error(`Unable to read version from ${basename(command)}`);
}

function requireVersion(label, output, expected, pattern) {
  const match = output.match(pattern);
  if (!match) throw new Error(`${label}: unrecognized version output`);
  if (match[1] !== expected) throw new Error(`${label}: expected ${expected}, received ${match[1]}`);
  return match[1];
}

export function verifyPaperToolchain({
  tectonic = process.env.TECTONIC_BIN || 'tectonic',
  pandoc = process.env.PANDOC_BIN || 'pandoc',
  dvisvgm = process.env.DVISVGM_BIN || 'dvisvgm',
  tlmgr = process.env.TLMGR_BIN || 'tlmgr',
  requireTexLive = true,
} = {}) {
  const versions = {
    tectonic: requireVersion(
      'Tectonic',
      capture(tectonic, [['--version'], ['-V'], ['--help']]),
      paperToolchainLock.tectonic,
      /tectonic(?:\s+|\s+version\s+)(\d+\.\d+\.\d+)/i,
    ),
    pandoc: requireVersion('Pandoc', capture(pandoc, [['--version']]), paperToolchainLock.pandoc, /pandoc\s+(\d+\.\d+\.\d+)/i),
    dvisvgm: requireVersion(
      'dvisvgm',
      capture(dvisvgm, [['--version']]),
      paperToolchainLock.dvisvgm,
      /dvisvgm\s+(\d+\.\d+(?:\.\d+)?)/i,
    ),
  };
  if (requireTexLive) {
    versions.texlive = requireVersion(
      'TeX Live',
      capture(tlmgr, [['--version']]),
      paperToolchainLock.texlive,
      /TeX Live[^\n]*(20\d{2})/i,
    );
  }
  return versions;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const versions = verifyPaperToolchain();
  console.log(
    `[paper-toolchain] ${Object.entries(versions)
      .map(([name, version]) => `${name} ${version}`)
      .join(', ')}`,
  );
}
