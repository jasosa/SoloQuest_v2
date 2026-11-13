/**
 * "Who can it reach?" mode (docs/ZARGON_AI.md). The players tap the heroes a monster can reach
 * and the heroes it is already next to; this turns the order into a sharper one. Pure data: the
 * taps are UI state, not events.
 */
import { HERO_NAMES, type Hero } from '../data/heroes';
import type { Order } from './orders';
import { ADJACENT_PLAN, NOBODY_PLAN, PLAN_TEXT, RULE_TEXT } from './texts';

export interface ReachResult {
  /** `nobody`: no hero in reach. `hero`: one hero is named. `rule`: the rule still decides. */
  readonly kind: 'nobody' | 'hero' | 'rule';
  /** The named hero, for `hero`. */
  readonly hero?: Hero;
  /** One sentence for the players. */
  readonly text: string;
  /** The tie list restricted to the heroes in reach (the named hero alone for `hero`). */
  readonly tie: readonly Hero[];
  /** Heroes in reach, in tie list order. */
  readonly candidates: readonly Hero[];
  /** The monster is already next to the named hero (`hero`), or to any reachable hero (`rule`). */
  readonly adjacent: boolean;
  readonly plan: string;
}

const lowerFirst = (s: string): string => s.charAt(0).toLowerCase() + s.slice(1);
const list = (hs: readonly Hero[]): string => hs.map((h) => HERO_NAMES[h]).join(', ');

export function reachOrder(
  order: Order,
  reachable: readonly Hero[],
  adjacent: readonly Hero[],
): ReachResult {
  if (order.rule === undefined)
    return {
      kind: 'nobody',
      text: order.note ?? 'It does nothing this turn.',
      tie: [],
      candidates: [],
      adjacent: false,
      plan: 'It does nothing.',
    };

  // Adjacent heroes are in reach too. Only heroes of the team count. Tie list order.
  const inReach = order.tie.filter((h) => reachable.includes(h) || adjacent.includes(h));
  const next = (hero: Hero) => adjacent.includes(hero);

  if (inReach.length === 0)
    return {
      kind: 'nobody',
      text: 'It can reach no hero.',
      tie: [],
      candidates: [],
      adjacent: false,
      plan: NOBODY_PLAN,
    };

  const named = (hero: Hero, why: string): ReachResult => {
    const adj = next(hero);
    return {
      kind: 'hero',
      hero,
      text: `Target: ${HERO_NAMES[hero]}. ${why}`,
      tie: [hero],
      candidates: inReach,
      adjacent: adj,
      plan: adj
        ? ADJACENT_PLAN[order.profile]
        : `Move next to the ${HERO_NAMES[hero]} and attack, then stay.`,
    };
  };

  if (inReach.length === 1) return named(inReach[0]!, 'It is the only hero in reach.');

  if (order.rule === 'grudge') {
    const g = order.grudgeHero;
    if (g && inReach.includes(g)) return named(g, 'Its grudge hero is in reach.');
    return named(inReach[0]!, 'Its grudge hero is out of reach: first in the tie list.');
  }
  if (order.rule === 'caster') {
    const c = inReach.filter((h) => h === 'wizard' || h === 'elf');
    if (c.length > 0) return named(c[0]!, 'A spellcaster is in reach.');
    return named(inReach[0]!, 'No spellcaster in reach: first in the tie list.');
  }
  if (order.rule === 'closest') {
    // A hero it already stands next to is the closest; else the tie list decides.
    const beside = inReach.filter(next);
    if (beside.length > 0) return named(beside[0]!, 'It is already next to it.');
    return named(inReach[0]!, 'First in the tie list among the heroes in reach.');
  }

  return {
    kind: 'rule',
    text: `Among ${list(inReach)}: ${lowerFirst(RULE_TEXT[order.rule])}. Still tied: ${list(inReach)} in that order.`,
    tie: inReach,
    candidates: inReach,
    adjacent: inReach.some(next),
    plan: order.plan ?? PLAN_TEXT[order.profile],
  };
}
