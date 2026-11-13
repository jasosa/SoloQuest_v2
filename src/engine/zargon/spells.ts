/**
 * Dread spell keys, display names and the suggestion table. The effect of a spell is NOT written
 * here: the players read the Dread spell card. Quest files use the keys in `spells`; a spell that
 * the quest lists twice may be cast twice.
 */

export const SPELL_KEYS = [
  'escape',
  'summon',
  'fear',
  'sleep',
  'ballOfFlame',
  'firestorm',
  'tempest',
  'command',
] as const;
export type SpellKey = (typeof SPELL_KEYS)[number];

export const SPELL_NAMES: Readonly<Record<SpellKey, string>> = {
  escape: 'Escape',
  summon: 'Summon',
  fear: 'Fear',
  sleep: 'Sleep',
  ballOfFlame: 'Ball of Flame',
  firestorm: 'Firestorm',
  tempest: 'Tempest',
  command: 'Command',
};

/** Added to the condition of a spell that does not fit the team; such spells are listed last. */
export const SPELL_UNFIT_TEXT: Readonly<Record<Exclude<SpellNeed, 'none'>, string>> = {
  threeHeroes: 'fewer than 3 heroes in this team, only if 3 or more are in sight anyway',
  casterHero: 'no Wizard or Elf in this team, only if a hero is in sight anyway',
};

export const SPELL_EFFECT_TEXT = 'Read the Dread spell card.';

export function isSpellKey(s: string): s is SpellKey {
  return (SPELL_KEYS as readonly string[]).includes(s);
}

/** What the heroes need to look like for a spell to be worth casting. */
export type SpellNeed = 'none' | 'threeHeroes' | 'casterHero';

export interface SpellRule {
  /** Lower comes first in the suggestion list. */
  readonly priority: number;
  /** Plain words: the app does not know who is in sight, the players check. */
  readonly condition: string;
  readonly need: SpellNeed;
}

/** Suggestion order from docs/ZARGON_AI.md, section Casters. */
export const SPELL_RULES: Readonly<Record<SpellKey, SpellRule>> = {
  escape: { priority: 1, condition: 'it has 1 Body Point left', need: 'none' },
  summon: { priority: 2, condition: '3 or more heroes are in its sight', need: 'threeHeroes' },
  fear: { priority: 3, condition: 'a hero with many attack dice is next to it', need: 'none' },
  sleep: { priority: 4, condition: 'a hero with many attack dice is in its sight', need: 'none' },
  ballOfFlame: {
    priority: 5,
    condition: 'the Wizard or the Elf is in its sight',
    need: 'casterHero',
  },
  firestorm: {
    priority: 5,
    condition: 'the Wizard or the Elf is in its sight',
    need: 'casterHero',
  },
  tempest: {
    priority: 6,
    condition: 'a hero in its sight is the closest to the quest goal',
    need: 'none',
  },
  command: {
    priority: 6,
    condition: 'a hero in its sight is the closest to the quest goal',
    need: 'none',
  },
};
