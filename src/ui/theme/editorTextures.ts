import { useSyncExternalStore } from 'react';

/**
 * Does the quest editor draw its map with the texture pack in use? A per-person setting kept in this
 * browser (it is a convenience, so a failing storage just means it is on). On by default.
 */
const KEY = 'soloquest-editor-textures';
const listeners = new Set<() => void>();

function read(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

let value = read();

export function setEditorTextures(on: boolean): void {
  value = on;
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    /* storage unavailable: the choice lasts until the page closes */
  }
  listeners.forEach((l) => l());
}

export function useEditorTextures(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => value,
  );
}
