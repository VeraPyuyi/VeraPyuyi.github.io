import { atom } from 'nanostores';

/**
 * BGM panel uses a separate store (not $activeModal) because music playback
 * should persist when other modals open — hiding the panel UI while keeping
 * audio playing is intentional.
 */
export const $bgmPanelOpen = atom(false);
export const $bgmAutoplayOptOut = atom(false);
export const BGM_AUTOPLAY_OPT_OUT_KEY = 'pyuyi-bgm-autoplay-opt-out';

function getStorage(): Storage | null {
  return typeof localStorage === 'undefined' ? null : localStorage;
}

export function initializeBgmPreference(rememberOptOut: boolean): boolean {
  const optedOut = rememberOptOut && getStorage()?.getItem(BGM_AUTOPLAY_OPT_OUT_KEY) === 'true';
  $bgmAutoplayOptOut.set(Boolean(optedOut));
  return Boolean(optedOut);
}

export function disableBgmAutoplay(rememberOptOut: boolean): void {
  $bgmAutoplayOptOut.set(true);
  if (rememberOptOut) getStorage()?.setItem(BGM_AUTOPLAY_OPT_OUT_KEY, 'true');
  closeBgmPanel();
}

export function enableBgmAutoplay(rememberOptOut: boolean): void {
  $bgmAutoplayOptOut.set(false);
  if (rememberOptOut) getStorage()?.removeItem(BGM_AUTOPLAY_OPT_OUT_KEY);
}

export function toggleBgmPanel() {
  $bgmPanelOpen.set(!$bgmPanelOpen.get());
}

export function closeBgmPanel() {
  $bgmPanelOpen.set(false);
}
