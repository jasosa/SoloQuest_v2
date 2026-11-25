import { useMemo, useSyncExternalStore } from 'react';
import { CORE_PACK } from '../engine/pack/registry';

/**
 * "My collection": the boxes the player owns, kept on this device. The base game is always on. Until
 * the player ticks something, every installed box counts as owned. Quest lists, campaigns and the
 * hero list follow it.
 */

const KEY = 'soloquest-collection';
const listeners = new Set<() => void>();

/** The ids the player ticked, or undefined when nothing was ever chosen (all boxes). */
function read(): readonly string[] | undefined {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : undefined;
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === 'string')
      : undefined;
  } catch {
    return undefined;
  }
}

let stored = read();
let cache: ReadonlySet<string> | undefined;
let cacheFor: readonly string[] | undefined | null = null;

/** The owned box ids among `installed` (the base game is always one). */
export function ownedBoxes(installed: readonly string[]): ReadonlySet<string> {
  return new Set(
    installed.filter((id) => id === CORE_PACK || stored === undefined || stored.includes(id)),
  );
}

export function setOwned(id: string, owned: boolean, installed: readonly string[]): void {
  if (id === CORE_PACK) return;
  const now = new Set(ownedBoxes(installed));
  if (owned) now.add(id);
  else now.delete(id);
  stored = [...now];
  cache = undefined;
  try {
    localStorage.setItem(KEY, JSON.stringify(stored));
  } catch {
    /* storage unavailable: the choice lasts until the page closes */
  }
  listeners.forEach((l) => l());
}

/** The owned boxes, as a set that stays the same object until the choice changes. */
export function useOwnedBoxes(installed: readonly string[]): ReadonlySet<string> {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => {
      if (!cache || cacheFor !== stored) {
        cache = ownedBoxes(installed);
        cacheFor = stored;
      }
      return cache;
    },
  );
}

/**
 * The colour of each box (concept: every box has a colour bar). A default per box, changed by the
 * player in My collection and kept on this device. The base game is the ink red of the app.
 */
const COLOR_KEY = 'soloquest-box-colors';
const DEFAULT_COLORS = ['#8a5a2b', '#3b6636', '#3b4a78', '#5a3a73', '#7a3a5a', '#5a6e3a'];
const FIXED_COLORS: Record<string, string> = { [CORE_PACK]: '#6e1f2a', 'frozen-horror': '#3b6b8c' };

function readColors(): Record<string, string> {
  try {
    const raw = localStorage.getItem(COLOR_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

let colors = readColors();

/** The colour of a box: the player's, else the default for it (`installed` fixes the order). */
export function boxColorOf(
  id: string,
  installed: readonly string[],
  own: Readonly<Record<string, string>> = colors,
): string {
  const chosen = own[id];
  if (chosen && /^#[0-9a-f]{6}$/i.test(chosen)) return chosen;
  const fixed = FIXED_COLORS[id];
  if (fixed) return fixed;
  const others = installed.filter((x) => !(x in FIXED_COLORS));
  return DEFAULT_COLORS[Math.max(0, others.indexOf(id)) % DEFAULT_COLORS.length]!;
}

export function setBoxColor(id: string, color: string): void {
  colors = { ...colors, [id]: color };
  try {
    localStorage.setItem(COLOR_KEY, JSON.stringify(colors));
  } catch {
    /* storage unavailable: the choice lasts until the page closes */
  }
  listeners.forEach((l) => l());
}

/** The colour of every installed box, as an object that stays the same until a colour changes. */
export function useBoxColors(installed: readonly string[]): Readonly<Record<string, string>> {
  const snapshot = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => colors,
  );
  return useMemo(
    () => Object.fromEntries(installed.map((id) => [id, boxColorOf(id, installed, snapshot)])),
    [installed, snapshot],
  );
}
