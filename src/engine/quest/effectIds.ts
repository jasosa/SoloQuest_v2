import type { Effect, Quest } from './schema';

/**
 * Stable ids for effects and choice options (decision 101). A translation key names a list item by
 * its id, so an id never changes once given. A missing or repeated id gets the lowest free `e<N>`
 * (`o<N>` for an option) of that list, as every generated id in the editor does.
 */
function fill<T extends { id?: string | undefined }>(
  list: readonly T[],
  prefix: string,
  inner: (item: T) => T,
): T[] {
  const taken = new Set(list.map((x) => x.id).filter((v): v is string => v !== undefined));
  const used = new Set<string>();
  let changed = false;
  const out = list.map((x) => {
    let item = inner(x);
    if (item.id === undefined || used.has(item.id)) {
      let n = 1;
      while (taken.has(`${prefix}${n}`)) n += 1;
      const fresh = `${prefix}${n}`;
      taken.add(fresh);
      const rest: Record<string, unknown> = { ...item };
      delete rest.id;
      item = { id: fresh, ...rest } as T;
    }
    used.add(item.id!);
    if (item !== x) changed = true;
    return item;
  });
  return changed ? out : (list as T[]);
}

/** The effects with an id on each one and on each choice option, at any depth. */
export function assignEffectIds(effects: readonly Effect[]): Effect[] {
  return fill(effects, 'e', (e) => {
    if (e.type !== 'promptChoice') return e;
    const options = fill(e.options, 'o', (o) => {
      const inner = assignEffectIds(o.effects);
      return inner === o.effects ? o : { ...o, effects: inner };
    });
    return options === e.options ? e : { ...e, options };
  });
}

/** The quest with ids on every effect and option of every note. The same object when none is missing. */
export function withEffectIds(quest: Quest): Quest {
  let changed = false;
  const notes = quest.notes.map((n) => {
    const effects = assignEffectIds(n.effects);
    if (effects === n.effects) return n;
    changed = true;
    return { ...n, effects };
  });
  return changed ? { ...quest, notes } : quest;
}
