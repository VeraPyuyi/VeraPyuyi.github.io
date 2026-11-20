/**
 * FloatingLanguage Component
 *
 * The other-language button in the floating toolbar: "EN" on Chinese pages, "中" on English
 * ones, linking to the same page in that language. The side rail that also holds a language
 * menu is tucked away on wide screens, so this is the switch visitors actually see.
 *
 * Visitors whose browser languages do not include the page's language get a one-time bubble
 * beside it, written in the other language, saying the site exists in that language too.
 */

import { Icon } from '@iconify/react';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { getAlternateUrl, getLocaleFromUrl, type Locale, localeEntries, t } from '@/i18n';

const HINT_KEY = 'pyuyi-language-hint';
/** The bubble leaves on its own after this long. */
const HINT_MS = 9000;

function subscribePathname(callback: () => void) {
  document.addEventListener('astro:page-load', callback);
  return () => document.removeEventListener('astro:page-load', callback);
}
const getPathname = () => window.location.pathname;

/** Short mark for a locale on a round button. */
const markOf = (code: string) => (code === 'zh' ? '中' : code.toUpperCase());

/** Whether the visitor's browser lists `locale` among its languages. */
function browserReads(locale: string): boolean {
  const languages = navigator.languages?.length ? navigator.languages : [navigator.language];
  return languages.some((language) => language.toLowerCase().split('-')[0] === locale);
}

function hintSeen(): boolean {
  try {
    return window.localStorage.getItem(HINT_KEY) === '1';
  } catch {
    return true;
  }
}

function rememberHint() {
  try {
    window.localStorage.setItem(HINT_KEY, '1');
  } catch {
    // Storage can be unavailable (private mode); the bubble may then show again next visit.
  }
}

export default function FloatingLanguage() {
  const pathname = useSyncExternalStore(subscribePathname, getPathname, getPathname);
  const locale = getLocaleFromUrl(pathname);
  const target = localeEntries.find((entry) => entry.code !== locale);
  const [hint, setHint] = useState(false);

  useEffect(() => {
    if (!target || hintSeen() || browserReads(locale)) return;
    rememberHint();
    setHint(true);
    const timer = window.setTimeout(() => setHint(false), HINT_MS);
    return () => window.clearTimeout(timer);
  }, [locale, target]);

  if (!target) return null;
  const targetLocale = target.code as Locale;
  const href = getAlternateUrl(pathname, targetLocale);
  const label = t(locale, 'floating.switchLanguage', { label: target.label });

  return (
    <div className="relative">
      {hint && (
        <div
          className="absolute top-1/2 right-full mr-3 flex -translate-y-1/2 items-center gap-1 whitespace-nowrap rounded-full bg-background/90 py-1.5 pr-1.5 pl-3.5 text-foreground text-sm shadow-lg backdrop-blur-sm"
          lang={targetLocale}
        >
          <a href={href} className="hover:underline">
            {t(targetLocale, 'floating.languageHint')} →
          </a>
          <button
            type="button"
            onClick={() => setHint(false)}
            className="flex-center rounded-full p-1 opacity-60 transition-opacity hover:opacity-100"
            aria-label={t(targetLocale, 'floating.dismiss')}
          >
            <Icon icon="ri:close-line" className="size-3.5" />
          </button>
        </div>
      )}
      <a
        href={href}
        hrefLang={targetLocale}
        className="flex-center size-9 rounded-full bg-background/80 font-semibold text-sm opacity-80 shadow-lg backdrop-blur-sm transition-all duration-200 hover:bg-background hover:opacity-100"
        aria-label={label}
        title={label}
      >
        {markOf(target.code)}
      </a>
    </div>
  );
}
