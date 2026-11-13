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
 * What to do when the target rule has no valid target (decision 35): use the tie list. Only for the
 * rules where the case is not obvious; the other rules need no line (ties and out-of-reach are
 * what the tie list is for). `grudgeName` fills in the hero of a grudge.
 */
export function noTargetText(rule: RuleKey, grudgeName?: string): string | undefined {
  switch (rule) {
    case 'lastAttacker':
      return 'If nobody has attacked it yet, use the tie list.';
    case 'caster':
      return 'If no Wizard or Elf is in reach, use the tie list.';
    case 'grudge':
      return `If the ${grudgeName ?? 'grudge hero'} is out of reach, use the tie list.`;
    default:
      return undefined;
  }
}
