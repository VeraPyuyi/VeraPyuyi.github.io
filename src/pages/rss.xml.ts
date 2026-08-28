// edit https://github.com/lawvs/lawvs.github.io/blob/dba2e51e312765f8322ee87755b4e9c22b520048/src/pages/rss.xml.ts
import rss from '@astrojs/rss';
import { siteConfig } from '@constants/site-config';
import { getPostSlug, getSortedPosts } from '@lib/content';
import { encodeSlug } from '@lib/route';
import { buildRssItemFields } from '@lib/rss-utils';
import type { APIContext } from 'astro';
import type { BlogPost } from 'types/blog';
import { defaultLocale } from '@/i18n';

export async function GET(context: APIContext) {
  const posts = await getSortedPosts(defaultLocale);
  const { site } = context;

  if (!site) {
    throw new Error('Missing site metadata');
  }

  const response = await rss({
    title: siteConfig.title,
    description: siteConfig.subtitle || 'No description',
    site,
    trailingSlash: false,
    stylesheet: '/rss/feed.xsl', // https://docs.astro.build/en/recipes/rss/#adding-a-stylesheet
    items: posts.slice(0, 20).map((post: BlogPost) => {
      const postSlug = getPostSlug(post);
      const postLink = `/post/${encodeSlug(postSlug)}`;
      const { title, description, content } = buildRssItemFields(post, defaultLocale);

      return {
        title,
        pubDate: post.data.date,
        description,
        link: postLink,
        content,
        // Add domain-independent GUID using customData
        // The slug-only GUID ensures stability across domain changes
        customData: `<guid isPermaLink="false">${postSlug}</guid>`,
      };
    }),
  });

  // 显式设置 Content-Type 包含 charset，解决中文乱码问题
  const headers = new Headers(response.headers);
  headers.set('Content-Type', 'application/xml; charset=utf-8');
  return new Response(response.body, {
    status: response.status,
    headers,
  });
}
