/** The random spell of a caster: a seeded shuffle of the spells it still has. Pure. */
import { rngFor, shuffled } from './hash';

/**
 * `left` are the distinct spell keys still available. The pick is the first spell of the seeded
 * shuffle that was not declined this turn. Declined spells are always the first ones offered, so
 * this is element `declined.length` of the shuffle and the offers never repeat. Same seed, turn
 * and monster give the same shuffle, after undo and reload. Undefined when nothing is left.
 */
export function pickSpell(
  seed: number,
  turn: number,
  monsterId: string,
  left: readonly string[],
  declined: readonly string[],
): string | undefined {
  const order = shuffled(left, rngFor(seed, turn, monsterId, 'spell'));
  return order.find((s) => !declined.includes(s));
}
