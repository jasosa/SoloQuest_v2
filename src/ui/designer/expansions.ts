import { useSyncExternalStore } from 'react';
import { CORE_EXPANSION } from '../../engine/data/coreFile';

/**
 * Expansions on and off (decision 76, Library layers). An official item belongs to an expansion
 * (`expansion` on the item; none means the base game). A person can hide an expansion: its items
 * leave the add menus of the quest editor. Quests that already use them keep working, and the Library
 * screen still lists everything. The choice is kept on this device.
 */

const KEY = 'soloquest-hidden-expansions';
const listeners = new Set<() => void>();

function read(): ReadonlySet<string> {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return new Set(Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

let hidden: ReadonlySet<string> = read();

export function setExpansionHidden(name: string, hide: boolean): void {
  const next = new Set(hidden);
  if (hide) next.add(name);
  else next.delete(name);
  hidden = next;
  try {
    localStorage.setItem(KEY, JSON.stringify([...next]));
  } catch {
    /* storage unavailable: the choice lasts until the page closes */
  }
  listeners.forEach((l) => l());
}

export function useHiddenExpansions(): ReadonlySet<string> {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => hidden,
  );
}

/** The expansion of an item: its own `expansion`, or the one a Core file gave it. None: the base game. */
export function expansionOf(
  kind: string,
  id: string,
  data?: { readonly expansion?: unknown },
): string | undefined {
  const own = data?.expansion;
  if (typeof own === 'string' && own !== '') return own;
  return CORE_EXPANSION.get(`${kind}:${id}`);
}

/** Is an item shown in the add menus (the base game always is)? */
export function isShown(
  hiddenSet: ReadonlySet<string>,
  kind: string,
  id: string,
  data?: { readonly expansion?: unknown },
): boolean {
  const e = expansionOf(kind, id, data);
  return e === undefined || !hiddenSet.has(e);
}

/** The expansions that exist: those of Core items and of the items in the library. */
export function expansionNames(
  libraryItems: readonly { kind: string; id: string; data: { expansion?: unknown } }[],
): string[] {
  const names = new Set<string>(CORE_EXPANSION.values());
  for (const it of libraryItems) {
    const e = expansionOf(it.kind, it.id, it.data);
    if (e) names.add(e);
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}
