/**
 * Short labels for monster tokens: type letter + a counter per type, in the order the heroes met
 * them ("O1", "O2", "Z1"). The order comes from the game state, so a hidden monster never takes
 * a number early and undo gives the same labels back.
 */
import type { MonsterType } from '../../engine/quest/schema';
import type { Level } from '../../engine/board/level';

export const MONSTER_LETTER: Readonly<Record<MonsterType, string>> = {
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
export function monsterCodes(
  level: Level,
  seen: Iterable<string>,
  wanderers: Readonly<Record<string, { type: MonsterType }>> = {},
): ReadonlyMap<string, string> {
  // The letter of a monster: its enemy's letter, else the letter of its type.
  const letter = new Map<string, string>(
    level.quest.monsters.map((m) => [m.id, m.letter ?? MONSTER_LETTER[m.type]]),
  );
  for (const [id, w] of Object.entries(wanderers)) letter.set(id, MONSTER_LETTER[w.type]);
  const counters = new Map<string, number>();
  const out = new Map<string, string>();
  for (const id of seen) {
    const l = letter.get(id);
    if (!l) continue;
    const n = (counters.get(l) ?? 0) + 1;
    counters.set(l, n);
    out.set(id, `${l}${n}`);
  }
  return out;
}
