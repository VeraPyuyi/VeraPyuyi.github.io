import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import type { PaperFontProfile, PaperMeta } from '@/types/personal-content';

const PAPER_ROOT = join(process.cwd(), 'src/content/papers');

interface PaperYaml {
  title?: string;
  titleEn?: string;
  abstract?: string;
  abstractEn?: string;
  authors?: string[];
  date?: string | Date;
  keywords?: string[];
  texEntry?: string;
  htmlEntry?: string;
  bibliography?: string;
  fontProfile?: PaperFontProfile;
  cover?: string;
  comments?: boolean;
  arxivId?: string;
  arxivVersion?: string;
  sourceUrl?: string;
  license?: string;
  licenseUrl?: string;
}

function required(value: unknown, field: string, id: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`[papers] ${id}: missing ${field}`);
  return value;
}

function requiredUrl(value: unknown, field: string, id: string): string {
  const url = required(value, field, id);
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') throw new Error('Only HTTPS URLs are allowed');
  } catch {
    throw new Error(`[papers] ${id}: invalid ${field}`);
  }
  return url;
}

export function getPapers(): PaperMeta[] {
  if (!existsSync(PAPER_ROOT)) return [];
  return readdirSync(PAPER_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const id = entry.name;
      const dir = join(PAPER_ROOT, id);
      const configPath = join(dir, 'paper.yml');
      if (!existsSync(configPath)) throw new Error(`[papers] ${id}: missing paper.yml`);
      const data = parse(readFileSync(configPath, 'utf8')) as PaperYaml;
      const texEntry = required(data.texEntry, 'texEntry', id);
      if (!existsSync(join(dir, texEntry))) throw new Error(`[papers] ${id}: missing ${texEntry}`);
      const htmlEntry = data.htmlEntry ?? texEntry;
      if (!existsSync(join(dir, htmlEntry))) throw new Error(`[papers] ${id}: missing ${htmlEntry}`);
      if (data.bibliography && !existsSync(join(dir, data.bibliography))) {
        throw new Error(`[papers] ${id}: missing ${data.bibliography}`);
      }
      if (!data.fontProfile || !['latin-modern', 'computer-modern'].includes(data.fontProfile)) {
        throw new Error(`[papers] ${id}: invalid fontProfile`);
      }
      const arxivId = required(data.arxivId, 'arxivId', id);
      if (!/^\d{4}\.\d{4,5}$/.test(arxivId)) throw new Error(`[papers] ${id}: invalid arxivId`);
      const arxivVersion = required(data.arxivVersion, 'arxivVersion', id);
      if (!/^v\d+$/.test(arxivVersion)) throw new Error(`[papers] ${id}: invalid arxivVersion`);
      const generatedPath = join(dir, 'generated.html');
      return {
        id,
        title: required(data.title, 'title', id),
        titleEn: data.titleEn,
        abstract: required(data.abstract, 'abstract', id),
        abstractEn: data.abstractEn,
        authors: data.authors?.length ? data.authors : ['Pyuyi'],
        date: data.date instanceof Date ? data.date.toISOString().slice(0, 10) : required(data.date, 'date', id),
        keywords: data.keywords ?? [],
        texEntry,
        htmlEntry,
        bibliography: data.bibliography,
        fontProfile: data.fontProfile,
        cover: data.cover,
        comments: data.comments ?? true,
        arxivId,
        arxivVersion,
        arxivUrl: `https://arxiv.org/abs/${arxivId}${arxivVersion}`,
        sourceUrl: requiredUrl(data.sourceUrl, 'sourceUrl', id),
        license: required(data.license, 'license', id),
        licenseUrl: requiredUrl(data.licenseUrl, 'licenseUrl', id),
        htmlPath: generatedPath,
        pdfPath: `/papers/${id}/paper.pdf`,
        generated: existsSync(generatedPath),
      } satisfies PaperMeta;
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function getPaper(id: string): PaperMeta | undefined {
  return getPapers().find((paper) => paper.id === id);
}

export function getPaperHtml(paper: PaperMeta): string {
  if (!paper.generated) return '<p>HTML 版本将在下一次构建时生成。</p>';
  return readFileSync(paper.htmlPath, 'utf8');
}
