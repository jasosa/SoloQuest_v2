/**
 * The weights table of docs/ZARGON_AI.md. Tune weights here only, and keep the doc in sync.
 */
import type { MonsterDef, MonsterType } from '../quest/schema';

export const RULE_KEYS = [
  'closest',
  'isolated',
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

/**
 * The plan of a monster (decision 74): skirmisher (goblins), fighter (orcs, abominations, dread
 * warriors: sometimes attack and move back), relentless (undead, gargoyles: never fall back), caster.
 */
export const PROFILES = ['skirmisher', 'fighter', 'relentless', 'caster'] as const;
export type Profile = (typeof PROFILES)[number];

export type Weights = Readonly<Partial<Record<RuleKey, number>>>;

const DUELIST: Weights = { highestAtt: 3, highestBody: 2, grudge: 2, lastAttacker: 1 };
// Skeletons, zombies and mummies always go for the closest hero.
const RELENTLESS: Weights = { closest: 1 };

/** Weights per monster type. */
export const WEIGHTS: Readonly<Record<MonsterType, Weights>> = {
  // Goblins pick on a hero cut off from the others, next to other monsters.
  goblin: { isolated: 1 },
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
  orc: 'fighter',
  abomination: 'fighter',
  dreadWarrior: 'fighter',
  skeleton: 'relentless',
  zombie: 'relentless',
  mummy: 'relentless',
  gargoyle: 'relentless',
  dreadSorcerer: 'fighter',
};

type ProfileInput = Pick<MonsterDef, 'type'> & {
  readonly spells?: readonly string[] | undefined;
  /** An enemy's own plan and weights (decision 75). They win over the table of its type. */
  readonly profile?: Profile | undefined;
  readonly weights?: Weights | undefined;
};

/** Named monsters with spells (and the dread sorcerer) use the caster profile. */
export function isCaster(monster: ProfileInput): boolean {
  return (
    (monster.spells !== undefined && monster.spells.length > 0) ||
    monster.type === 'dreadSorcerer' ||
    monster.profile === 'caster'
  );
}

export function profileOf(monster: ProfileInput): Profile {
  if (isCaster(monster)) return 'caster';
  return monster.profile ?? PROFILE_OF_TYPE[monster.type];
}

export function weightsOf(monster: ProfileInput): Weights {
  if (monster.weights && Object.values(monster.weights).some((w) => w > 0)) return monster.weights;
  return isCaster(monster) ? CASTER_WEIGHTS : WEIGHTS[monster.type];
}
