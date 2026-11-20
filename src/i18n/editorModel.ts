/**
 * What the translation editor shows (decision 92), as pure functions: which texts a language has
 * translated, progress per area, and the rows for a filter. A text counts as translated when it is
 * not empty and not the English words (a new language starts as a copy of English).
 */
import { areaOf, placeholderProblem } from './file';

type Texts = Readonly<Record<string, string>>;

export const AREA_ALL = 'all';

export const isTranslated = (english: Texts, strings: Texts, key: string): boolean => {
  const own = strings[key];
  return own !== undefined && own !== '' && own !== english[key];
};

export interface AreaProgress {
  readonly area: string;
  readonly total: number;
  readonly done: number;
}

/** `interface`, `library`, then the quests by id. */
export function areasOf(english: Texts): string[] {
  const set = new Set(Object.keys(english).map(areaOf));
  const quests = [...set].filter((a) => a !== 'interface' && a !== 'library').sort();
  return [
    ...(set.has('interface') ? ['interface'] : []),
    ...(set.has('library') ? ['library'] : []),
    ...quests,
  ];
}

export function progressByArea(english: Texts, strings: Texts): AreaProgress[] {
  const rows = new Map<string, { total: number; done: number }>();
  for (const key of Object.keys(english)) {
    const area = areaOf(key);
    const row = rows.get(area) ?? { total: 0, done: 0 };
    row.total++;
    if (isTranslated(english, strings, key)) row.done++;
    rows.set(area, row);
  }
  return areasOf(english).map((area) => ({ area, ...rows.get(area)! }));
}

export type RowFilter = 'all' | 'todo' | 'problems';

export interface RowQuery {
  readonly area: string;
  readonly filter: RowFilter;
  readonly search: string;
}

/** The keys to show, in the order of the English file. */
export function rowsFor(english: Texts, strings: Texts, q: RowQuery): string[] {
  const needle = q.search.trim().toLowerCase();
  return Object.keys(english).filter((key) => {
    if (q.area !== AREA_ALL && areaOf(key) !== q.area) return false;
    if (q.filter === 'todo' && isTranslated(english, strings, key)) return false;
    if (q.filter === 'problems' && !placeholderProblem(english[key]!, strings[key] ?? ''))
      return false;
    if (!needle) return true;
    return [key, english[key], strings[key]].some((s) => s?.toLowerCase().includes(needle));
  });
}

/** Adds the English texts of the keys the language lacks (a file made for an older English). */
export function addNewTexts(english: Texts, strings: Texts): Record<string, string> {
  const out = { ...strings };
  for (const [k, v] of Object.entries(english)) if (!out[k]) out[k] = v;
  return out;
}

/** Drops the texts of keys that English no longer has. */
export function removeOldTexts(english: Texts, strings: Texts): Record<string, string> {
  return Object.fromEntries(Object.entries(strings).filter(([k]) => k in english));
}
