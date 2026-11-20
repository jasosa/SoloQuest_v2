import {
  createContext,
  createElement,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { getQuestBox, getQuestBoxVersion, subscribeQuestBox, themeForBox } from './questBox';
import { CLASSIC_THEME, type Theme } from './theme';

/**
 * The themes in use. A small store, so the board redraws when it changes: the theme of the core pack
 * (every quest) and, by box, the theme of each expansion pack on top of it (that box's quests only).
 */
let active: Theme = CLASSIC_THEME;
let byBox: Readonly<Record<string, Theme>> = {};
const listeners = new Set<() => void>();

export function setActiveTheme(
  theme: Theme,
  expansions: Readonly<Record<string, Theme>> = {},
): void {
  active = theme;
  byBox = expansions;
  listeners.forEach((l) => l());
}

/** The theme of the expansion pack of a box, already merged over the core theme. */
export function getExpansionThemes(): Readonly<Record<string, Theme>> {
  return byBox;
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
  // an expansion pack dresses only the quests of its box
  useSyncExternalStore(subscribeQuestBox, getQuestBoxVersion);
  return scoped ?? themeForBox(app, byBox, getQuestBox());
}
