import { useSyncExternalStore } from 'react';

/**
 * Settings kept on this device (localStorage, per viewer). Rule hints (decision 60): short reminders
 * of rules the app does not enforce, such as the rule of a terrain the first time it is seen.
 */

const KEY = 'soloquest-rule-hints';
const listeners = new Set<() => void>();

function read(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

let ruleHints = read();

export const getRuleHints = (): boolean => ruleHints;

export function setRuleHints(on: boolean): void {
  ruleHints = on;
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    /* storage unavailable: the choice lasts until the page closes */
  }
  listeners.forEach((l) => l());
}

export function useRuleHints(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => ruleHints,
  );
}
