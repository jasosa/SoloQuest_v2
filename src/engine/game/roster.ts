/**
 * Monsters that join the roster in play: wandering monsters, monsters a spell or a trap brings, and
 * those the players add (decision 66). They are seen at once and have Body Points; the app never
 * moves them.
 */
import type { Level } from '../board/level';
import { resolveMonster } from '../data/enemies';
import { statsOf } from '../data/monsters';
import type { MonsterDef } from '../quest/schema';
import type { Draft, WandererRecord } from './state';

/**
 * The definition of a monster that joined in play: its core type, or the quest enemy it is (so an
 * Ice Gremlin has the Ice Gremlin's stats, plan and abilities, not a goblin's).
 */
export function wandererDef(
  level: Level,
  rec: Pick<WandererRecord, 'type' | 'enemy'>,
  id: string,
): MonsterDef {
  const base = { id, type: rec.type, ...(rec.enemy ? { enemy: rec.enemy } : {}) } as MonsterDef;
  return resolveMonster(base, level.quest.enemyDefs);
}

/** Put a monster that joined in play on the roster (seen, with its Body Points) and give it an id. */
export function joinRoster(level: Level, d: Draft, rec: WandererRecord): string {
  let n = d.wanderCount + 1;
  while (level.quest.monsters.some((m) => m.id === `w${n}`)) n++;
  const id = `w${n}`;
  d.wanderCount = n;
  d.wanderers[id] = rec;
  d.seenMonsters.add(id);
  d.monsters[id] = { body: statsOf(wandererDef(level, rec, id)).body, dead: false };
  return id;
}
