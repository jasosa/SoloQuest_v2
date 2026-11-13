/** Texts of docs/ZARGON_AI.md: target rules and plans. */
import type { Profile, RuleKey } from './weights';

export const RULE_TEXT: Readonly<Record<RuleKey, string>> = {
  closest: 'The closest hero it can reach',
  lastAttacker: 'The hero who attacked it last',
  lowestBody: 'The hero with the fewest Body Points left',
  highestBody: 'The hero with the most Body Points left',
  lowestDef: 'The hero with the fewest defend dice',
  highestDef: 'The hero with the most defend dice',
  highestAtt: 'The hero with the most attack dice',
  caster: 'A spellcaster (Wizard or Elf)',
  grudge: 'The grudge hero, whatever it costs',
};

export const PLAN_TEXT: Readonly<Record<Profile, string>> = {
  skirmisher: 'Next to a hero: attack, then run back out of reach. Otherwise: move in and attack.',
  soldier: 'Move in and attack. Already next to a hero: attack and stay.',
  brute: 'Move in and attack. Never falls back.',
  duelist: 'Move in and attack. No hero in reach: block the nearest doorway.',
  relentless: 'Move in and attack. Never falls back.',
  // The plan of a caster that has no spell to cast: as a duelist.
  caster: 'Move in and attack. No hero in reach: block the nearest doorway.',
};

/**
 * What to do when the target rule has no valid target (decision 35): use the tie list among the
 * heroes the monster can reach. One short line per rule.
 */
export const NO_TARGET_TEXT: Readonly<Record<RuleKey, string>> = {
  closest: 'If two heroes are equally close, use the tie list.',
  lastAttacker:
    'If nobody has attacked it yet, or that hero is dead or out of reach, use the tie list.',
  lowestBody:
    'If heroes are tied for the fewest Body Points, or the one with the fewest is out of reach, use the tie list.',
  highestBody:
    'If heroes are tied for the most Body Points, or the one with the most is out of reach, use the tie list.',
  lowestDef:
    'If heroes are tied for the fewest defend dice, or the one with the fewest is out of reach, use the tie list.',
  highestDef:
    'If heroes are tied for the most defend dice, or the one with the most is out of reach, use the tie list.',
  highestAtt:
    'If heroes are tied for the most attack dice, or the one with the most is out of reach, use the tie list.',
  caster: 'If no living Wizard or Elf is within reach, use the tie list.',
  grudge: 'If the grudge hero is out of reach, use the tie list.',
};

/** Added to every no-target line: the monster may only attack a hero it can attack this turn. */
export const ADJACENT_FALLBACK_TEXT =
  'If it is next to a hero but not next to the target, attack the first hero next to it in the tie list.';

/** The monster can reach no hero at all (decision 35). `toward` names the hero to move toward. */
export function nobodyInReachText(profile: Profile, toward: string): string {
  if (profile === 'duelist' || profile === 'caster')
    return 'No hero in reach: block the nearest doorway (or hold your place if you are in one).';
  return `No hero in reach: move as far as you can toward ${toward}, in straight lines, without passing heroes or opening doors. Do not attack.`;
}
