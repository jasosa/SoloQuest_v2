/** Read-only selectors over the game state, for the UI. Pure. */
import { MONSTER_NAMES, statsOf, type MonsterStats } from '../data/monsters';
import type { Level } from '../board/level';
import type { MonsterType } from '../quest/schema';
import type { GameState } from './state';

export interface MonsterView {
  readonly id: string;
  readonly type: MonsterType;
  /** The quest's name for the monster, or the name of its type. */
  readonly name: string;
  readonly stats: MonsterStats;
  readonly body: number;
  readonly maxBody: number;
  readonly dead: boolean;
}

/** Monsters the heroes have seen, in quest order. Hidden or unseen monsters are not listed. */
export function monstersInPlay(level: Level, state: GameState): MonsterView[] {
  const out: MonsterView[] = [];
  for (const m of level.quest.monsters) {
    const rec = state.monsters[m.id];
    if (!state.seenMonsters.has(m.id) || !rec) continue;
    const stats = statsOf(m);
    out.push({
      id: m.id,
      type: m.type,
      name: m.name ?? MONSTER_NAMES[m.type],
      stats,
      body: rec.body,
      maxBody: stats.body,
      dead: rec.dead,
    });
  }
  return out;
}
