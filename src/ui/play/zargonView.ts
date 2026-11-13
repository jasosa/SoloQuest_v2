/** Pure helpers for Zargon's turn: the sequence of dialogs, labels. No React. */
import type { Hero } from '../../engine/data/heroes';
import { HERO_NAMES } from '../../engine/data/heroes';
import type { Order, TurnProgress } from '../../engine/zargon';

export interface TurnItem {
  readonly order: Order;
  /** `act`: carry out the order. `info`: stone or fresh wanderer, a short dialog with "Next". */
  readonly kind: 'act' | 'info';
  /** 1-based position among the acting monsters (undefined for `info`). */
  readonly number: number | undefined;
  /** Still to show: an acting monster not done, an info monster not read yet. */
  readonly pending: boolean;
}

export interface TurnSequence {
  readonly items: readonly TurnItem[];
  /** Monsters that act this turn. */
  readonly actingTotal: number;
  /** The first item still pending, in order (resume point). */
  readonly current: TurnItem | undefined;
}

/** One dialog per monster, in the order of `ordersFor` (reveal order). `read`: info ids shown. */
export function turnSequence(orders: readonly Order[], read: ReadonlySet<string>): TurnSequence {
  let n = 0;
  const items = orders.map<TurnItem>((order) => {
    if (order.status === 'act') {
      n += 1;
      return { order, kind: 'act', number: n, pending: !order.done };
    }
    return { order, kind: 'info', number: undefined, pending: !read.has(order.monster) };
  });
  return { items, actingTotal: n, current: items.find((i) => i.pending) };
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
