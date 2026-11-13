import { areaAt, type AreaId } from '../board/board';
import type { Level } from '../board/level';
import type { MonsterDef } from '../quest/schema';
import type { GameState, MonsterStateRecord } from './state';

/**
 * Ids of seen, living monsters in `room`: quest monsters whose start square is there, and living
 * wanderers that came to this room (they have no square, so their room stands in for it).
 */
export function liveMonstersInRoom(level: Level, state: GameState, room: AreaId): string[] {
  const where = (m: MonsterDef) => state.placedMonsterCells[m.id] ?? m.cell;
  const quest = level.quest.monsters
    .filter(
      (m) =>
        !isDormant(m, state) &&
        where(m) !== undefined &&
        areaAt(level.board, where(m)![0], where(m)![1]) === room &&
        state.seenMonsters.has(m.id) &&
        state.monsters[m.id]?.dead === false,
    )
    .map((m) => m.id);
  const wanderers = Object.entries(state.wanderers)
    .filter(([id, w]) => w.room === room && state.monsters[id]?.dead === false)
    .map(([id]) => id);
  return [...quest, ...wanderers];
}

/** Current state of a quest monster: a note's record, else the quest data, else active. */
export function monsterStateOf(
  def: Pick<MonsterDef, 'id' | 'state'>,
  state: Pick<GameState, 'monsterStates'>,
): MonsterStateRecord {
  return state.monsterStates[def.id] ?? { state: def.state ?? 'active' };
}

/**
 * A dormant monster (a statue) is furniture until a note wakes it: it is not in the roster, not
 * counted by search guards, gets no orders and cannot be wounded (decision 28).
 */
export function isDormant(
  def: Pick<MonsterDef, 'id' | 'state'>,
  state: Pick<GameState, 'monsterStates'>,
): boolean {
  return monsterStateOf(def, state).state === 'dormant';
}
