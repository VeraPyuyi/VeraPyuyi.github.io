export type BlogStatus = 'idea' | 'active' | 'maintained' | 'archived';

export interface PaperMeta {
  id: string;
  title: string;
  titleEn?: string;
  abstract: string;
  abstractEn?: string;
  authors: string[];
  date: string;
  keywords: string[];
  texEntry: string;
  htmlEntry: string;
  bibliography?: string;
  cover?: string;
  comments: boolean;
  arxivId: string;
  arxivVersion: string;
  arxivUrl: string;
  sourceUrl: string;
  license: string;
  licenseUrl: string;
  htmlPath: string;
  pdfPath: string;
  generated: boolean;
}
