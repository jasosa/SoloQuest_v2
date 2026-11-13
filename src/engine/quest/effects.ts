import type { Effect, Quest } from './schema';

/** Visit every effect of every note, including the effects inside `promptChoice` options. */
export function forEachEffect(quest: Quest, fn: (e: Effect) => void): void {
  const walk = (list: readonly Effect[]) => {
    for (const e of list) {
      fn(e);
      if (e.type === 'promptChoice') for (const o of e.options) walk(o.effects);
    }
  };
  for (const n of quest.notes) walk(n.effects);
}

/** showText and giveItem texts of a list of effects, in order, and the first showText title. */
export function textsOf(effects: readonly Effect[]): { texts: string[]; title?: string } {
  const texts: string[] = [];
  let title: string | undefined;
  for (const e of effects) {
    if (e.type === 'showText') {
      texts.push(e.text);
      if (title === undefined && e.title) title = e.title;
    } else if (e.type === 'giveItem') texts.push(e.text);
  }
  return title !== undefined ? { texts, title } : { texts };
}
