/**
 * Owner mode (decision 76): the owner can change what ships with the app (Core items in the
 * Designer, the built-in English in Translations). The choice is kept on this device; without one,
 * the development build is in owner mode.
 */
const OWNER_KEY = 'soloquest-owner-mode';

export function ownerModeOn(): boolean {
  try {
    const v = localStorage.getItem(OWNER_KEY);
    if (v === '1') return true;
    if (v === '0') return false;
  } catch {
    /* storage unavailable: fall through */
  }
  return import.meta.env.DEV;
}

export function rememberOwnerMode(on: boolean): void {
  try {
    localStorage.setItem(OWNER_KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
}
