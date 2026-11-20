import { useSyncExternalStore } from 'react';

/**
 * Settings kept on this device (localStorage, per viewer), one set for each quest. Rule hints (decision
 * 60): short reminders of rules the app does not enforce (the rule of a terrain the first time it is
 * seen, moving without rolling when no monster is awake). No Yeti hug in solo quests (decision 59).
 * Both are on by default.
 */

export interface QuestSettings {
  readonly ruleHints: boolean;
  /** "No Yeti hug in solo quests" (decision 59). Only matters in a quest for one hero. */
  readonly soloNoHug: boolean;
}

const DEFAULTS: QuestSettings = { ruleHints: true, soloNoHug: true };
const KEY = 'soloquest-quest-settings';
const listeners = new Set<() => void>();

type Stored = Record<string, Partial<QuestSettings>>;

function read(): Stored {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? (parsed as Stored) : {};
  } catch {
    return {};
  }
}

let stored = read();
/** Cached per quest, so `useSyncExternalStore` sees the same object until a setting changes. */
const cache = new Map<string, QuestSettings>();

export function getQuestSettings(questId: string): QuestSettings {
  let s = cache.get(questId);
  if (!s) {
    const own = stored[questId];
    s = {
      ruleHints: typeof own?.ruleHints === 'boolean' ? own.ruleHints : DEFAULTS.ruleHints,
      soloNoHug: typeof own?.soloNoHug === 'boolean' ? own.soloNoHug : DEFAULTS.soloNoHug,
    };
    cache.set(questId, s);
  }
  return s;
}

export function setQuestSetting<K extends keyof QuestSettings>(
  questId: string,
  key: K,
  value: QuestSettings[K],
): void {
  stored = { ...stored, [questId]: { ...stored[questId], [key]: value } };
  cache.delete(questId);
  try {
    localStorage.setItem(KEY, JSON.stringify(stored));
  } catch {
    /* storage unavailable: the choice lasts until the page closes */
  }
  listeners.forEach((l) => l());
}

export function useQuestSettings(questId: string): QuestSettings {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => getQuestSettings(questId),
  );
}
