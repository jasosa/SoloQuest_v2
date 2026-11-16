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
  'lightningBolt',
  'cloudOfDread',
  'rust',
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
  lightningBolt: 'Lightning Bolt',
  cloudOfDread: 'Cloud of Dread',
  rust: 'Rust',
};

export const SPELL_EFFECT_TEXT = 'Read the Dread spell card.';

export function isSpellKey(s: string): s is SpellKey {
  return (SPELL_KEYS as readonly string[]).includes(s);
}
