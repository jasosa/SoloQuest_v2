/**
 * Short labels for monster tokens: type letter + a counter per type, in the order the heroes met
 * them ("O1", "O2", "Z1"). The order comes from the game state, so a hidden monster never takes
 * a number early and undo gives the same labels back.
 */
import type { MonsterType } from '../../engine/quest/schema';
import type { Level } from '../../engine/board/level';

const LETTER: Readonly<Record<MonsterType, string>> = {
  goblin: 'G',
  orc: 'O',
  abomination: 'A',
  skeleton: 'S',
  zombie: 'Z',
  mummy: 'M',
  dreadWarrior: 'D',
  gargoyle: 'R',
  dreadSorcerer: 'X',
};

/** `seen` is the monster ids in the order they were first seen (`GameState.seenMonsters`). */
export function monsterCodes(level: Level, seen: Iterable<string>): ReadonlyMap<string, string> {
  const type = new Map(level.quest.monsters.map((m) => [m.id, m.type]));
  const counters = new Map<MonsterType, number>();
  const out = new Map<string, string>();
  for (const id of seen) {
    const t = type.get(id);
    if (!t) continue;
    const n = (counters.get(t) ?? 0) + 1;
    counters.set(t, n);
    out.set(id, `${LETTER[t]}${n}`);
  }
  return out;
}
