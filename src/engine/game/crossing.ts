/**
 * Crossing from one map of a multi-map quest to another (decision 45), by a stairway link.
 *
 * Reset: what the heroes have seen (fog), the doors that were opened (they are closed again) and
 * the squares of falling blocks and searched rooms of the old map, which wait for their map.
 * Kept: kills and monster damage, traps, searches by furniture, fired notes, flags, counters, dead
 * heroes, found secret doors, and the turn counter.
 * Gone: wandering monsters that have no square (they cannot follow). Monsters the players put on
 * a square stay with the map they were put on.
 *
 * `crossLink` only changes the draft. The arrival (revealing the room of the stairway on the new
 * map and firing its notes) is done by the reducer after the event, with the level of the new map.
 */
import { areaAt, type Cell } from '../board/board';
import type { Level } from '../board/level';
import { EventError } from './errors';
import { revealFrom, revealRoom, syncBlockers } from './reveal';
import type { Draft } from './state';

export interface Arrival {
  readonly map: string;
  readonly cell: Cell;
}

/** Cross the link from the map `level` to its other end. Changes the draft. */
export function crossLink(level: Level, d: Draft, linkId: string): Arrival {
  const link = (level.quest.links ?? []).find((l) => l.id === linkId);
  if (!link) throw new EventError('UNKNOWN_LINK', `Unknown link ${linkId}`);
  const here = level.quest.mapId;
  const to = link.a.map === here ? link.b : link.b.map === here ? link.a : undefined;
  if (here === undefined || !to)
    throw new EventError('WRONG_MAP', `Link ${linkId} does not start on this map`);

  // What belongs to the squares of this map waits here, and what the target map kept comes back.
  d.mapMemory = {
    ...d.mapMemory,
    [here]: { placedBlocks: [...d.placedBlocks], treasureSearched: { ...d.treasureSearched } },
  };
  const kept = d.mapMemory[to.map];
  d.placedBlocks = new Set(kept?.placedBlocks ?? []);
  d.treasureSearched = { ...(kept?.treasureSearched ?? {}) };

  // Fog: nothing is seen on the new map yet. Found secret doors stay found.
  d.seenCells = new Set();
  d.layoutCells = new Set();
  d.revealedRooms = new Set();
  d.looked = new Set();
  d.seenBlocks = new Set();
  d.seenFurniture = new Set();
  d.seenTraps = new Set();
  d.sightBlockers = new Set();
  for (const door of level.doors.values()) {
    d.openDoors.delete(door.id);
    if (door.kind !== 'secret') d.seenDoors.delete(door.id);
  }

  // The monsters of the map the heroes leave are fog again. Their wounds and kills are kept.
  for (const m of level.quest.monsters) d.seenMonsters.delete(m.id);

  // A wandering monster without a square cannot follow the heroes. A dead one stays as a kill.
  for (const [id, w] of Object.entries(d.wanderers)) {
    if (w.map !== here || w.cell || d.monsters[id]?.dead) continue;
    delete d.wanderers[id];
    delete d.monsters[id];
    delete d.monsterStates[id];
    d.seenMonsters.delete(id);
  }

  d.map = to.map;
  const arrival = { map: to.map, cell: [to.cell[0], to.cell[1]] as Cell };
  d.arrival = arrival;
  return arrival;
}

/**
 * The heroes have arrived on the map of `level`: reveal what they see at the stairway (the whole
 * room, or the line of sight when it is in a corridor). Returns the squares that became known.
 */
export function revealArrival(level: Level, d: Draft, cell: Cell): string[] {
  syncBlockers(level, d);
  const area = areaAt(level.board, cell[0], cell[1]);
  if (area === undefined) return [];
  if (area === 'C') {
    d.looked.add(`${cell[0]},${cell[1]}`);
    return revealFrom(level, d, cell).cells;
  }
  return revealRoom(level, d, area).cells;
}
