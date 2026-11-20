/** Pure helpers for Zargon's turn: the sequence of dialogs, labels. No React. */
import type { Order, TurnProgress } from '../../engine/zargon';

import { nameFromId } from '../../engine/data/team';
import { t } from '../../i18n/t';

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
/** The tie list as one line. `names` are the order's own names (a mercenary reads "Scout (Dwarf)"); without them the ids are turned into words. */
export const tieText = (tie: readonly string[], names?: readonly string[]): string =>
  (names ?? tie.map(nameFromId)).join(' › ');

/** The line under "Zargon's turn" in the right column. */
export function progressLabel(p: TurnProgress): string {
  if (p.total === 0) return t('play.zargonView.noMonsterToAct', 'no monster to act');
  if (p.allDone) return t('play.zargonView.allMonstersDone', 'all monsters done');
  const n = p.remaining.length;
  return n === 1
    ? t('play.zargonView.oneMonsterToAct', '1 monster to act')
    : t('play.zargonView.monstersToAct', '{n} monsters to act', { n });
}

export const leftLabel = (left: number): string =>
  left === 1
    ? t('play.zargonView.oneLeft', '1 left')
    : t('play.zargonView.nLeft', '{n} left', { n: left });
