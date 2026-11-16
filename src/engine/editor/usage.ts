/**
 * Where a Designer item is used (the "Used in" panel of decision 70). Pure: it takes the quests
 * to look at. A core enemy is "used" by monsters of its type that have no enemy of their own.
 */
import type { Quest } from '../quest/schema';

export type UsageKind = 'ability' | 'spell' | 'enemy';

export interface UsageRow {
  readonly quest: string;
  /** Monsters (or enemies, for an ability or spell an enemy lists) that use it. */
  readonly count: number;
}

export function usageOf(
  kind: UsageKind,
  id: string,
  quests: readonly { title: string; quest: Quest }[],
): UsageRow[] {
  const rows: UsageRow[] = [];
  for (const { title, quest } of quests) {
    let count: number;
    if (kind === 'enemy') {
      count = quest.monsters.filter((m) => (m.enemy ? m.enemy === id : m.type === id)).length;
    } else if (kind === 'ability') {
      count =
        quest.monsters.filter((m) => (m.abilities ?? []).includes(id)).length +
        quest.enemyDefs.filter((e) => (e.abilities ?? []).includes(id)).length;
    } else {
      count =
        quest.monsters.filter((m) => (m.spells ?? []).includes(id)).length +
        quest.enemyDefs.filter((e) => (e.spells ?? []).includes(id)).length;
    }
    if (count > 0) rows.push({ quest: title, count });
  }
  return rows;
}
