/**
 * Site statistics utilities
 */

import { getCollection } from 'astro:content';
import readingTime from 'reading-time';
import { defaultLocale } from '../i18n/config';
import { getPaperHtml, getPapers } from './papers';

/**
 * Calculate total word count and reading time for papers and independent blogs.
 * Only counts default-locale blogs to avoid inflating stats with translations.
 */
export async function getSiteStats() {
  const papers = getPapers();
  const blogs = (await getCollection('blogs')).filter((entry) => entry.data.language === defaultLocale);

  let totalWords = 0;
  let totalMinutes = 0;

  const sources = [
    ...papers.map((paper) => getPaperHtml(paper).replace(/<[^>]*>/g, ' ')),
    ...blogs.map((blog) => blog.body ?? ''),
  ];
  for (const source of sources) {
    const stats = readingTime(source);
    totalWords += stats.words;
    totalMinutes += Math.ceil(stats.minutes);
  }

  const formatWordCount = (count: number): string => {
    if (count >= 1000) {
      return `${Math.floor(count / 1000)}k`;
    }
    return count.toString();
  };

  const formatReadingTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}:${mins.toString().padStart(2, '0')}`;
  };

  return {
    totalWords,
    totalMinutes,
    formattedWords: formatWordCount(totalWords),
    formattedTime: formatReadingTime(totalMinutes),
    postCount: papers.length + blogs.length,
  };
}
