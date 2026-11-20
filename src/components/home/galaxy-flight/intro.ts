/** Fills in the first screen's time-of-day greeting and tonight's moon phase. */

import { dayPart, MOON_PHASE_NAMES, MOON_PHASE_NAMES_EN, moonPhase } from '@/lib/galaxy';

const GREETINGS = {
  zh: {
    morning: '早安，晨光照进小宇宙了',
    afternoon: '午后好，今天也在认真观测',
    evening: '晚上好，星星陆续亮起来了',
    night: '夜深了，宇宙只为你亮着一盏灯',
  },
  en: {
    morning: 'Good morning — first light in the microcosm',
    afternoon: 'Good afternoon — still observing',
    evening: 'Good evening — the stars are coming out',
    night: 'Late night — the universe keeps one light on for you',
  },
} as const;

export function paintIntro(root: HTMLElement) {
  const en = root.dataset.locale === 'en';
  const greeting = root.querySelector('[data-flight-greeting]');
  if (greeting) greeting.textContent = (en ? GREETINGS.en : GREETINGS.zh)[dayPart(new Date().getHours())];
  const moon = root.querySelector('[data-flight-moon]');
  if (moon) {
    const { index } = moonPhase(Date.now());
    moon.textContent = en ? `Tonight · ${MOON_PHASE_NAMES_EN[index]}` : `今晚 · ${MOON_PHASE_NAMES[index]}`;
  }
}
