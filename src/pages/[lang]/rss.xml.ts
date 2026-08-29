import rss from '@astrojs/rss';
import { siteConfig } from '@constants/site-config';
import type { APIContext } from 'astro';
import { getHtmlLang } from '@/i18n';
import { getAggregateRssItems } from '@/lib/rss-items';
import { getLocaleStaticPaths } from '../_shared/utils';

export const getStaticPaths = getLocaleStaticPaths;

export async function GET(context: APIContext) {
  const lang = context.params.lang as string;
  const { site } = context;

  if (!site) {
    throw new Error('Missing site metadata');
  }

  const response = await rss({
    title: siteConfig.title,
    description: siteConfig.subtitle || 'No description',
    site,
    trailingSlash: false,
    customData: `<language>${getHtmlLang(lang)}</language>`,
    stylesheet: '/rss/feed.xsl',
    items: await getAggregateRssItems(lang),
  });

  const headers = new Headers(response.headers);
  headers.set('Content-Type', 'application/xml; charset=utf-8');
  return new Response(response.body, {
    status: response.status,
    headers,
  });
}
