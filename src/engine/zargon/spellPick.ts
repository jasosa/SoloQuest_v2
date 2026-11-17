/** The random spell of a caster: a seeded shuffle of the spells it still has. Pure. */
import { rngFor, shuffled } from './hash';

/**
 * `left` are the distinct spell keys still available. The offers follow a seeded shuffle; the first
 * spell of it that was not declined this turn is the pick. `order` pins spells to a place (1 =
 * first): a pinned spell takes that place when it is free (else the next free one), and the
 * spells without a place fill the rest in shuffle order. The offer order is fixed for a seed, turn
 * and monster, so declined spells are always the first ones offered and offers never repeat, also
 * after undo and reload. Undefined when nothing is left.
 */
export function pickSpell(
  seed: number,
  turn: number,
  monsterId: string,
  left: readonly string[],
  declined: readonly string[],
  order?: Readonly<Record<string, number>>,
): string | undefined {
  const shuffle = shuffled(left, rngFor(seed, turn, monsterId, 'spell'));
  const pinned = shuffle
    .filter((s) => order?.[s] !== undefined)
    .sort((a, b) => order![a]! - order![b]!);
  const slots: (string | undefined)[] = Array<string | undefined>(shuffle.length).fill(undefined);
  for (const s of pinned) {
    let at = Math.min(order![s]! - 1, slots.length - 1);
    while (slots[at] !== undefined && at < slots.length - 1) at++;
    while (slots[at] !== undefined && at > 0) at--;
    slots[at] = s;
  }
  const free = shuffle.filter((s) => !pinned.includes(s));
  const offers = slots.map((s) => s ?? free.shift()!);
  return offers.find((s) => !declined.includes(s));
}
