/**
 * The `booking` section of config/site.yaml: a Google Calendar appointment schedule that visitors
 * can book from the black hole stop on the homepage ("约一次会合").
 */

export interface BookingConfigInput {
  /** The booking page of a Google Calendar appointment schedule. */
  url?: string;
  /** IANA timezone of the owner, shown next to the visitor's own time. */
  timezone?: string;
}

export interface ResolvedBookingConfig {
  /** Opens the booking page in a new tab (also the no-JavaScript fallback). */
  url: string;
  /** The same page in Google's embeddable form, or null when the link cannot be embedded. */
  embedUrl: string | null;
  timezone: string;
}

export const DEFAULT_BOOKING_TIMEZONE = 'Asia/Taipei';

function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/**
 * Null when the section is absent or has no usable link, so the feature simply does not appear.
 * Full `calendar.google.com/calendar/appointments/…` links are embedded (Google's `gv=true` form);
 * short `calendar.app.google` links only redirect, so they open in a new tab instead.
 */
export function normalizeBookingConfig(raw: BookingConfigInput | null | undefined): ResolvedBookingConfig | null {
  const text = raw?.url?.trim();
  if (!text) return null;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new Error(`booking.url is not a valid URL: ${text}`);
  }
  if (url.protocol !== 'https:') throw new Error(`booking.url must use https: ${text}`);

  let embedUrl: string | null = null;
  if (url.hostname === 'calendar.google.com' && url.pathname.startsWith('/calendar/appointments/')) {
    const embed = new URL(url);
    embed.searchParams.set('gv', 'true');
    embedUrl = embed.toString();
  }

  const timezone = raw?.timezone?.trim() || DEFAULT_BOOKING_TIMEZONE;
  if (!isTimeZone(timezone)) throw new Error(`booking.timezone is not an IANA timezone: ${timezone}`);
  return { url: url.toString(), embedUrl, timezone };
}
