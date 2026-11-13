import type { MonsterDef, MonsterType } from '../quest/schema';

export interface MonsterStats {
  readonly move: number;
  readonly att: number;
  readonly def: number;
  readonly body: number;
  readonly mind: number;
}

/** Base stats from docs/RULES_DIGEST.md. Dread sorcerer is a stand-in for named characters. */
export const MONSTER_STATS: Readonly<Record<MonsterType, MonsterStats>> = {
  goblin: { move: 10, att: 2, def: 1, body: 1, mind: 1 },
  orc: { move: 8, att: 3, def: 2, body: 1, mind: 2 },
  abomination: { move: 6, att: 3, def: 3, body: 2, mind: 3 },
  skeleton: { move: 6, att: 2, def: 2, body: 1, mind: 0 },
  zombie: { move: 5, att: 2, def: 3, body: 1, mind: 0 },
  mummy: { move: 4, att: 3, def: 4, body: 2, mind: 0 },
  dreadWarrior: { move: 7, att: 4, def: 4, body: 3, mind: 3 },
  gargoyle: { move: 6, att: 4, def: 5, body: 3, mind: 4 },
  dreadSorcerer: { move: 6, att: 3, def: 4, body: 3, mind: 6 },
};

export const MONSTER_NAMES: Readonly<Record<MonsterType, string>> = {
  goblin: 'Goblin',
  orc: 'Orc',
  abomination: 'Abomination',
  skeleton: 'Skeleton',
  zombie: 'Zombie',
  mummy: 'Mummy',
  dreadWarrior: 'Dread Warrior',
  gargoyle: 'Gargoyle',
  dreadSorcerer: 'Dread Sorcerer',
};

/** Base stats with the quest monster's overrides applied. */
export function statsOf(monster: Pick<MonsterDef, 'type' | 'overrides'>): MonsterStats {
  const out = { ...MONSTER_STATS[monster.type] };
  const o = monster.overrides;
  if (o) {
    for (const k of ['move', 'att', 'def', 'body', 'mind'] as const) {
      const v = o[k];
      if (v !== undefined) out[k] = v;
    }
  }
  return out;
}
