import { init, type WalineInstance } from '@waline/client';
import '@waline/client/style';
import '@/styles/components/waline.css';
import { useEffect, useRef } from 'react';
import { commentConfig } from '@/constants/site-config';
import { getHtmlLang, getLocaleFromUrl } from '@/i18n/utils';
import { createWalineImageUploader } from './walineImageUploader';
import { getWalineLocaleOverrides, resolveWalinePath, WALINE_EMOJI_PRESETS, WALINE_SITE_DEFAULTS } from './walineOptions';

// Config is module-level static data parsed from YAML at build time - won't change at runtime
const config = commentConfig.waline;

export default function Waline({ contentId }: { contentId?: string }) {
  const walineInstanceRef = useRef<WalineInstance | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!config || !containerRef.current) return;

    // Initialize Waline with locale-aware lang
    const currentLocale = getLocaleFromUrl(window.location.pathname);
    const lang = config.lang ?? getHtmlLang(currentLocale);
    walineInstanceRef.current = init({
      ...WALINE_SITE_DEFAULTS,
      ...config,
      el: containerRef.current,
      path: resolveWalinePath(contentId, window.location.pathname),
      lang,
      dark: config.dark ?? 'html.dark',
      emoji: config.emoji ?? WALINE_EMOJI_PRESETS,
      imageUploader: config.imageUploader === false ? false : createWalineImageUploader(lang),
      locale: {
        ...getWalineLocaleOverrides(lang),
        ...config.locale,
      },
    });

    // Handle Astro page transitions - update path when navigating
    const handlePageLoad = () => {
      const newLocale = getLocaleFromUrl(window.location.pathname);
      walineInstanceRef.current?.update({
        path: resolveWalinePath(contentId, window.location.pathname),
        lang: config.lang ?? getHtmlLang(newLocale),
      });
    };
    document.addEventListener('astro:page-load', handlePageLoad);

    return () => {
      walineInstanceRef.current?.destroy();
      document.removeEventListener('astro:page-load', handlePageLoad);
    };
  }, [contentId]);

  if (!config) return null;

  return <div ref={containerRef} />;
}
