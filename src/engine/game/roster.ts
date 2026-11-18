/**
 * Monsters that join the roster in play: wandering monsters, monsters a spell or a trap brings, and
 * those the players add (decision 66). They are seen at once and have Body Points; the app never
 * moves them.
 */
import type { Level } from '../board/level';
import { statsOf } from '../data/monsters';
import type { Draft, WandererRecord } from './state';

/** Put a monster that joined in play on the roster (seen, with its Body Points) and give it an id. */
export function joinRoster(level: Level, d: Draft, rec: WandererRecord): string {
  let n = d.wanderCount + 1;
  while (level.quest.monsters.some((m) => m.id === `w${n}`)) n++;
  const id = `w${n}`;
  d.wanderCount = n;
  d.wanderers[id] = rec;
  d.seenMonsters.add(id);
  d.monsters[id] = { body: statsOf({ type: rec.type }).body, dead: false };
  return id;
}
