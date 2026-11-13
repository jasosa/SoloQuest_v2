/** Pure helpers for the Zargon's turn page: ordering, labels. No React. */
import { HERO_NAMES, type Hero } from '../../engine/data/heroes';
import type { OrderGroup, TurnProgress } from '../../engine/zargon';

export interface DisplayGroup {
  readonly group: OrderGroup;
  /** 1-based position among the entries still to do; undefined for a done entry. */
  readonly number: number | undefined;
  /** Members that are not done yet. */
  readonly open: readonly string[];
}

/** Entries in reveal order, the done ones moved to the bottom (still in reveal order). */
export function displayGroups(groups: readonly OrderGroup[]): DisplayGroup[] {
  const todo = groups.filter((g) => !g.done);
  const done = groups.filter((g) => g.done);
  return [...todo, ...done].map((group) => ({
    group,
    number: group.done ? undefined : todo.indexOf(group) + 1,
    open: group.monsters.filter((m) => !group.doneIds.includes(m)),
  }));
}

/** "Dwarf › Elf › Wizard" */
export const tieText = (tie: readonly Hero[]): string => tie.map((h) => HERO_NAMES[h]).join(' › ');

/** The line under "Zargon's turn" in the right column. */
export function progressLabel(p: TurnProgress): string {
  if (p.total === 0) return 'no monster to act';
  if (p.allDone) return 'all monsters done';
  const n = p.remaining.length;
  return `${n} monster${n === 1 ? '' : 's'} to act`;
}

export const leftLabel = (left: number): string => (left === 1 ? '1 left' : `${left} left`);

export const MODE_HELP = {
  priority:
    'Each monster goes for the first hero that fits its rule and that it can reach. Use your character sheets. If the rule does not decide, use the tie list.',
  reach: 'Tap the heroes each monster can reach. The app chooses the target when it can.',
} as const;
