/**
 * The weights table of docs/ZARGON_AI.md. Tune weights here only, and keep the doc in sync.
 */
import type { MonsterDef, MonsterType } from '../quest/schema';

export const RULE_KEYS = [
  'closest',
  'lastAttacker',
  'lowestBody',
  'highestBody',
  'lowestDef',
  'highestDef',
  'highestAtt',
  'caster',
  'grudge',
] as const;
export type RuleKey = (typeof RULE_KEYS)[number];

export type Profile = 'skirmisher' | 'soldier' | 'brute' | 'duelist' | 'relentless' | 'caster';

export type Weights = Readonly<Partial<Record<RuleKey, number>>>;

const DUELIST: Weights = { highestAtt: 3, highestBody: 2, grudge: 2, lastAttacker: 1 };
const RELENTLESS: Weights = { closest: 4, lastAttacker: 2, lowestDef: 1 };

/** Weights per monster type. */
export const WEIGHTS: Readonly<Record<MonsterType, Weights>> = {
  goblin: { lowestBody: 3, lowestDef: 3, caster: 2, closest: 2, lastAttacker: 1 },
  orc: { closest: 3, lastAttacker: 3, lowestBody: 2, highestAtt: 1, grudge: 1 },
  abomination: { highestAtt: 2, closest: 2, lastAttacker: 2, highestBody: 1, grudge: 1 },
  dreadWarrior: DUELIST,
  skeleton: RELENTLESS,
  zombie: RELENTLESS,
  mummy: RELENTLESS,
  gargoyle: { highestBody: 2, closest: 2, lastAttacker: 1, grudge: 1 },
  // Stand-in for named characters; as a caster it uses the duelist weights anyway.
  dreadSorcerer: DUELIST,
};

/** Named casters draw their rule like a dread warrior (after the spell choice). */
export const CASTER_WEIGHTS: Weights = DUELIST;

export const PROFILE_OF_TYPE: Readonly<Record<MonsterType, Exclude<Profile, 'caster'>>> = {
  goblin: 'skirmisher',
  orc: 'soldier',
  abomination: 'brute',
  dreadWarrior: 'duelist',
  skeleton: 'relentless',
  zombie: 'relentless',
  mummy: 'relentless',
  gargoyle: 'brute',
  dreadSorcerer: 'duelist',
};

type ProfileInput = Pick<MonsterDef, 'type'> & { readonly spells?: readonly string[] | undefined };

/** Named monsters with spells (and the dread sorcerer) use the caster profile. */
export function isCaster(monster: ProfileInput): boolean {
  return (
    (monster.spells !== undefined && monster.spells.length > 0) || monster.type === 'dreadSorcerer'
  );
}

export function profileOf(monster: ProfileInput): Profile {
  return isCaster(monster) ? 'caster' : PROFILE_OF_TYPE[monster.type];
}

export function weightsOf(monster: ProfileInput): Weights {
  return isCaster(monster) ? CASTER_WEIGHTS : WEIGHTS[monster.type];
}
