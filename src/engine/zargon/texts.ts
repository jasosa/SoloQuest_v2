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
  caster: 'Cast a spell if a target is in sight and a spell is left; otherwise as duelist.',
};

/** Plan once the target is chosen and the monster is already next to it. */
export const ADJACENT_PLAN: Readonly<Record<Profile, string>> = {
  skirmisher: 'Already next to it: attack, then run back out of reach.',
  soldier: 'Already next to it: attack and stay.',
  brute: 'Already next to it: attack and stay. Never falls back.',
  duelist: 'Already next to it: attack and stay.',
  relentless: 'Already next to it: attack and stay. Never falls back.',
  caster: 'Already next to it: cast a spell if one is left, otherwise attack and stay.',
};

export const NOBODY_PLAN =
  'It can reach nobody: move toward the heroes, or hold the nearest doorway.';
