/**
 * "约一次会合": the booking satellite at the black hole stop opens a small observing-time request
 * card holding the Google Calendar appointment schedule. Google's page is only loaded on the first
 * open, and the card's first line keeps the visitor's and the owner's clocks side by side.
 */

import { twoSkies, twoSkiesLine } from '@/lib/booking';

export function createBooking(root: HTMLElement): () => void {
  // The card sits outside the flight, so clicks inside it never reach the flight's own handlers.
  const dialog = document.querySelector<HTMLDialogElement>('[data-booking-dialog]');
  if (!dialog || typeof dialog.showModal !== 'function') return () => {};
  const frame = dialog.querySelector<HTMLIFrameElement>('[data-booking-frame]');
  const skies = dialog.querySelector<HTMLElement>('[data-booking-skies]');
  const ownerZone = dialog.dataset.timezone ?? 'Asia/Taipei';
  const locale = document.documentElement.lang.startsWith('en') ? 'en' : 'zh';
  const visitorZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  let ticking = 0;

  const tell = () => {
    if (skies) skies.textContent = twoSkiesLine(twoSkies(new Date(), visitorZone, ownerZone, locale), locale);
  };

  const open = (event: MouseEvent) => {
    const trigger = (event.target as Element | null)?.closest('[data-booking]');
    if (!trigger || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
    event.preventDefault();
    if (frame && !frame.src && frame.dataset.src) frame.src = frame.dataset.src;
    tell();
    window.clearInterval(ticking);
    ticking = window.setInterval(tell, 20_000);
    dialog.showModal();
    root.classList.add('is-booking');
  };

  const onDialogClick = (event: MouseEvent) => {
    // A click on the backdrop (the dialog element itself, outside the card) closes it.
    if (event.target === dialog || (event.target as Element | null)?.closest('[data-booking-close]')) dialog.close();
  };
  const onClose = () => {
    window.clearInterval(ticking);
    root.classList.remove('is-booking');
  };

  root.addEventListener('click', open);
  dialog.addEventListener('click', onDialogClick);
  dialog.addEventListener('close', onClose);
  return () => {
    root.removeEventListener('click', open);
    dialog.removeEventListener('click', onDialogClick);
    dialog.removeEventListener('close', onClose);
    window.clearInterval(ticking);
    if (dialog.open) dialog.close();
  };
}
