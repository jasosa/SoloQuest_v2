/**
 * Dread spells as data (decisions 47, 48 and 70). A spell has a name, situation tags (or one
 * question of its own), an optional warning and a rule for when it can be offered. The effect of
 * a core spell is NOT written here: the players read the Dread spell card. A quest may add spells
 * of its own (`spellDefs`) with their own text. All texts are our own words.
 */
import type { Quest } from '../quest/schema';

export const SPELL_TAG_IDS = [
  'selfHurt',
  'selfNearDeath',
  'allyHurt',
  'manyInSight',
  'heroesGrouped',
  'heroesInSameRoom',
  'heroesInSameArea',
  'heroInLine',
  'heroAdjacent',
  'strongAdjacent',
  'strongInSight',
  'casterInSight',
  'noneInReach',
  'canBlockPath',
  'nearObjective',
  'any',
] as const;
export type SpellTag = (typeof SPELL_TAG_IDS)[number];

/** The question the players answer for a tag. */
export const SPELL_TAG_QUESTIONS: Readonly<Record<SpellTag, string>> = {
  selfHurt: 'Has it lost Body Points?',
  selfNearDeath: 'Does it have 1 Body Point left?',
  allyHurt: 'Has another monster lost Body Points?',
  manyInSight: 'Are 3 or more heroes in sight?',
  heroesGrouped: 'Are 2 or more heroes close together in sight?',
  heroesInSameRoom: 'Is it in a room with 2 or more heroes?',
  heroesInSameArea: 'Are 2 or more heroes in the same room or corridor as it?',
  heroInLine: 'Is a hero in a straight line from it, with no wall or closed door between?',
  heroAdjacent: 'Is any hero next to it?',
  strongAdjacent: 'Is a hero with high attack next to it?',
  strongInSight: 'Is a hero with high attack in sight?',
  casterInSight: 'Is the Wizard or Elf in sight?',
  noneInReach: 'Is no hero in reach this turn?',
  canBlockPath: 'Can it block a corridor or doorway between it and the heroes?',
  nearObjective: 'Is a hero close to finishing the quest goal?',
  any: 'Could it cast it?',
};

export function isSpellTag(s: string): s is SpellTag {
  return (SPELL_TAG_IDS as readonly string[]).includes(s);
}

/** `always`, or only when the quest has a way to use it (Escape needs an escape point). */
export type OfferWhen = 'always' | 'escapePoint';

export interface SpellDef {
  readonly id: string;
  readonly name: string;
  /** What the spell does, in the quest's own words. Core spells leave it out (the card is read). */
  readonly text?: string;
  readonly tags: readonly SpellTag[];
  /** One question of its own: replaces the tags. */
  readonly question?: string;
  readonly warning?: string;
  readonly offerWhen: OfferWhen;
  readonly core: boolean;
}

const core = (
  id: string,
  name: string,
  tags: readonly SpellTag[],
  extra: Partial<Pick<SpellDef, 'question' | 'warning' | 'offerWhen'>> = {},
): SpellDef => ({ id, name, tags, offerWhen: 'always', core: true, ...extra });

export const CORE_SPELLS: readonly SpellDef[] = [
  core('fear', 'Fear', ['strongAdjacent', 'strongInSight']),
  core('sleep', 'Sleep', ['strongAdjacent', 'strongInSight']),
  core('command', 'Command', ['strongInSight']),
  core('tempest', 'Tempest', ['nearObjective', 'strongInSight']),
  core('ballOfFlame', 'Ball of Flame', ['any']),
  core('lightningBolt', 'Lightning Bolt', ['heroInLine'], {
    warning: 'Older card: it also hits monsters in the line.',
  }),
  core('firestorm', 'Firestorm', ['heroesInSameRoom'], {
    warning: 'It also hits monsters in the room. It does not work in corridors.',
  }),
  core('cloudOfDread', 'Cloud of Dread', ['heroesInSameArea']),
  core('summon', 'Summon', ['manyInSight', 'selfHurt']),
  core('escape', 'Escape', ['selfNearDeath'], { offerWhen: 'escapePoint' }),
  core('rust', 'Rust', [], {
    question: 'Does a hero in sight carry a metal sword or helmet that is not an artifact?',
  }),
];

/** The core spells and the quest's own, by id. A quest spell cannot reuse a core id. */
export function spellLookup(
  quest: Pick<Quest, 'spellDefs'> | undefined,
): ReadonlyMap<string, SpellDef> {
  const out = new Map<string, SpellDef>(CORE_SPELLS.map((s) => [s.id, s]));
  for (const s of quest?.spellDefs ?? [])
    if (!out.has(s.id))
      out.set(s.id, {
        id: s.id,
        name: s.name,
        ...(s.text ? { text: s.text } : {}),
        tags: (s.tags ?? []) as SpellTag[],
        ...(s.question ? { question: s.question } : {}),
        ...(s.warning ? { warning: s.warning } : {}),
        offerWhen: s.offerWhen ?? 'always',
        core: false,
      });
  return out;
}

/** The questions to ask for a spell: its own question, or one per tag. */
export function spellQuestions(s: SpellDef): string[] {
  if (s.question) return [s.question];
  if (s.tags.length === 0) return [SPELL_TAG_QUESTIONS.any];
  return s.tags.map((t) => SPELL_TAG_QUESTIONS[t]);
}

/**
 * The quest has an escape point when a note reacts to this spell being cast (Balur's escape in
 * quest 8). Only then is a spell with `offerWhen: 'escapePoint'` offered.
 */
export function hasEscapePoint(quest: Pick<Quest, 'notes'>, spellId: string): boolean {
  return quest.notes.some((n) => n.trigger.type === 'spellCast' && n.trigger.spell === spellId);
}
