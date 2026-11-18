import { useSyncExternalStore } from 'react';
import { CLASSIC_THEME, type Theme } from './theme';

/** The theme in use. A small store, so the board redraws when it changes. */
let active: Theme = CLASSIC_THEME;
const listeners = new Set<() => void>();

export function setActiveTheme(theme: Theme): void {
  active = theme;
  listeners.forEach((l) => l());
}

export function getActiveTheme(): Theme {
  return active;
}

export function useTheme(): Theme {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => active,
  );
}
