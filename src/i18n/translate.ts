/**
 * The text lookup of the whole app (decision 92). Pure: no DOM, no clock, no random. A text has a
 * key and its English words. The active language is a map of key to text; a key that is missing in
 * it falls back to the English words, so English needs no map at all.
 *
 * `tr('zargon.thief.steal', 'Steal: move next to {who}', { who })`
 * Variables are written `{name}` in the text. A translation must keep the same names.
 */

export type Strings = Readonly<Record<string, string>>;
export type Params = Readonly<Record<string, string | number>>;

let active: Strings = {};
const listeners = new Set<() => void>();

/** Sets the strings of the active language (an empty map is English). */
export function setActiveStrings(strings: Strings): void {
  active = strings;
  for (const l of listeners) l();
}

export function activeStrings(): Strings {
  return active;
}

export function onStringsChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Fills `{name}` placeholders. An unknown name is left as it is. */
export function fill(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (m, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : m,
  );
}

/** The names of the `{placeholders}` of a text, in order, without repeats. */
export function placeholdersOf(text: string): string[] {
  return [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!))];
}

export function tr(key: string, english: string, params?: Params): string {
  const own = active[key];
  return fill(own !== undefined && own !== '' ? own : english, params);
}
