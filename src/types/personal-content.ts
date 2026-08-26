export type ProjectStatus = 'idea' | 'active' | 'maintained' | 'archived';

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
  bibliography?: string;
  cover?: string;
  comments: boolean;
  htmlPath: string;
  pdfPath: string;
  generated: boolean;
}
