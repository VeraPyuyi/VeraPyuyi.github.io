export type BlogStatus = 'idea' | 'active' | 'maintained' | 'archived';
export type PaperFontProfile = 'latin-modern' | 'computer-modern';
export type PaperEquationVariant = 'desktop' | 'tablet' | 'mobile';
export type PaperWebEquationLayout = 'auto' | 'original' | 'compact';
export type PaperWebEquationLayoutConfig =
  | PaperWebEquationLayout
  | Partial<Record<PaperEquationVariant, PaperWebEquationLayout>>;

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
  fontProfile: PaperFontProfile;
  webOmitSections: string[];
  webEquationLayouts: Record<string, PaperWebEquationLayoutConfig>;
  cover?: string;
  coverAlt?: string;
  coverAltEn?: string;
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
