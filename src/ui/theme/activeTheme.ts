import {
  createContext,
  createElement,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { getBoxArtVersion, getQuestBox, layeredTheme, subscribeBoxArt } from './boxArt';
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

/** The theme the app uses (the pack the person chose), whatever a screen draws with. */
export function useActiveTheme(): Theme {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => active,
  );
}

const ScopeCtx = createContext<Theme | undefined>(undefined);

/** Draw what is inside with another theme (the editor map with the built-in look, for example). */
export function ThemeScope({ theme, children }: { theme: Theme | undefined; children: ReactNode }) {
  return createElement(ScopeCtx.Provider, { value: theme }, children);
}

/** The theme to draw with: the one of the nearest `ThemeScope`, or the theme the app uses. */
export function useTheme(): Theme {
  const scoped = useContext(ScopeCtx);
  const app = useActiveTheme();
  // the box of the open quest and the art switch change what is drawn too
  useSyncExternalStore(subscribeBoxArt, getBoxArtVersion);
  return scoped ?? layeredTheme(app, getQuestBox());
}
