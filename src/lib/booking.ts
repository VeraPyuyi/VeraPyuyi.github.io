/**
 * "Two skies": the line at the top of the booking card that sets the visitor's time beside the
 * owner's, each with what the sky is doing there, so a time difference is seen before a slot is picked.
 */

export interface SkyAt {
  /** HH:mm in that place. */
  time: string;
  /** What the sky is doing there at that hour. */
  sky: string;
}

export interface TwoSkies {
  visitor: SkyAt;
  owner: SkyAt;
  /** Both clocks read the same: one sky, said once. */
  same: boolean;
}

/** The sky at a local hour (0–23). */
export function skyAt(hour: number, locale: string): string {
  const en = locale === 'en';
  if (hour >= 5 && hour < 7) return en ? 'dawn is coming' : '天快亮了';
  if (hour >= 7 && hour < 17) return en ? 'the sky is still light' : '天还亮着';
  if (hour >= 17 && hour < 19) return en ? 'dusk is falling' : '正是黄昏';
  return en ? 'night has fallen' : '已经入夜';
}

function clock(now: Date, timeZone: string): { time: string; hour: number } {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(now)
    .reduce<Record<string, string>>((all, part) => ({ ...all, [part.type]: part.value }), {});
  return { time: `${parts.hour}:${parts.minute}`, hour: Number(parts.hour) };
}

export function twoSkies(now: Date, visitorTimeZone: string, ownerTimeZone: string, locale: string): TwoSkies {
  const visitor = clock(now, visitorTimeZone);
  const owner = clock(now, ownerTimeZone);
  return {
    visitor: { time: visitor.time, sky: skyAt(visitor.hour, locale) },
    owner: { time: owner.time, sky: skyAt(owner.hour, locale) },
    same: visitor.time === owner.time,
  };
}

/** The whole line, e.g. "你那里 14:20，天还亮着；我这里 22:20，已经入夜。" */
export function twoSkiesLine(skies: TwoSkies, locale: string): string {
  const en = locale === 'en';
  if (skies.same) {
    return en
      ? `${skies.owner.time} here and there — we share one sky; ${skies.owner.sky}.`
      : `你我这里都是 ${skies.owner.time}，同一片天空下，${skies.owner.sky}。`;
  }
  return en
    ? `${skies.visitor.time} where you are, ${skies.visitor.sky}; ${skies.owner.time} where I am, ${skies.owner.sky}.`
    : `你那里 ${skies.visitor.time}，${skies.visitor.sky}；我这里 ${skies.owner.time}，${skies.owner.sky}。`;
}
