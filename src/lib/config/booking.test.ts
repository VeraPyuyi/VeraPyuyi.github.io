import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_BOOKING_TIMEZONE, normalizeBookingConfig } from './booking';

const schedule = 'https://calendar.google.com/calendar/appointments/schedules/AcZssZ0abc';

test('no section or no link means no booking', () => {
  assert.equal(normalizeBookingConfig(undefined), null);
  assert.equal(normalizeBookingConfig(null), null);
  assert.equal(normalizeBookingConfig({ url: '  ' }), null);
});

test("a full appointment schedule link is embedded in Google's embeddable form", () => {
  const resolved = normalizeBookingConfig({ url: schedule });
  assert.equal(resolved?.url, schedule);
  assert.equal(resolved?.embedUrl, `${schedule}?gv=true`);
  assert.equal(resolved?.timezone, DEFAULT_BOOKING_TIMEZONE);
});

test('a short link only opens in a new tab', () => {
  const resolved = normalizeBookingConfig({ url: 'https://calendar.app.google/abc123', timezone: 'Europe/London' });
  assert.equal(resolved?.embedUrl, null);
  assert.equal(resolved?.timezone, 'Europe/London');
});

test('a bad link or timezone fails the build instead of shipping a broken button', () => {
  assert.throws(() => normalizeBookingConfig({ url: 'not a url' }));
  assert.throws(() => normalizeBookingConfig({ url: 'http://calendar.google.com/calendar/appointments/x' }));
  assert.throws(() => normalizeBookingConfig({ url: schedule, timezone: 'Mars/Olympus' }));
});
