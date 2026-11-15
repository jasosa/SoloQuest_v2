/** Pure helpers of the inspector forms: text in, engine patch out. No React. */
import type { MonsterDef } from '../../engine/quest/schema';

export const STAT_KEYS = ['move', 'att', 'def', 'body', 'mind'] as const;
export type StatKey = (typeof STAT_KEYS)[number];
export type Overrides = NonNullable<MonsterDef['overrides']>;

/**
 * Turn the five stat fields into an overrides object. An empty field means "no override".
 * Returns an error sentence for text that is not a whole number, 0 or more.
 */
export function parseOverrides(
  fields: Readonly<Record<StatKey, string>>,
): { ok: true; overrides: Overrides } | { ok: false; error: string } {
  const out: Overrides = {};
  for (const k of STAT_KEYS) {
    const t = fields[k].trim();
    if (t === '') continue;
    if (!/^\d+$/.test(t)) return { ok: false, error: `${k} must be a whole number, 0 or more.` };
    out[k] = Number(t);
  }
  return { ok: true, overrides: out };
}

/** One entry per non-empty line. */
export function parseLines(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '');
}

/** Toggle a value in a list, keeping the list order of `order`. */
export function toggleIn<T extends string>(list: readonly T[], value: T, order: readonly T[]): T[] {
  const has = list.includes(value);
  return order.filter((x) => (x === value ? !has : list.includes(x)));
}
