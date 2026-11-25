import { useSyncExternalStore } from 'react';
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
