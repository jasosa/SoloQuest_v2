/**
 * What the heroes have not seen yet, for the Zargon view of a playtest. Pure: it reads the level
 * and the game state and returns lists. It never changes the state and uses no randomness.
 */
import { areaAt, type Cell } from '../../engine/board/board';
import {
  cellKey,
  keyOf,
  type BlockInfo,
  type DoorInfo,
  type Level,
} from '../../engine/board/level';
import type { GameState } from '../../engine/game/state';
import type { FurnitureDef, MarkerDef, MonsterDef, TrapDef } from '../../engine/quest/schema';

export interface HiddenTrap {
  readonly id: string;
  readonly kind: TrapDef['kind'];
  readonly cell: Cell;
}

export interface HiddenView {
  /** Floor squares not yet shown (rooms and corridors, no rock, no blocks). */
  readonly cells: readonly Cell[];
  readonly blocks: readonly BlockInfo[];
  /** Doors not on the map yet, secret and false doors included. */
  readonly doors: readonly DoorInfo[];
  readonly furniture: readonly FurnitureDef[];
  /** Monsters not seen yet that stand on a square. */
  readonly monsters: readonly (MonsterDef & { readonly cell: Cell })[];
  /** Monsters with no square: a quest note places them later. */
  readonly placedByNotes: readonly MonsterDef[];
  readonly traps: readonly HiddenTrap[];
  readonly markers: readonly MarkerDef[];
}

export function hiddenView(level: Level, state: GameState): HiddenView {
  const { board, quest } = level;
  const blockCells = new Set<string>();
  for (const b of level.blocks) for (const c of b.cells) blockCells.add(keyOf(c));
  const cells: Cell[] = [];
  for (let y = 0; y < board.height; y++)
    for (let x = 0; x < board.width; x++) {
      const k = cellKey(x, y);
      if (areaAt(board, x, y) === undefined || level.rock.has(k)) continue;
      if (state.seenCells.has(k) || blockCells.has(k)) continue;
      cells.push([x, y]);
    }

  const traps: HiddenTrap[] = [];
  for (const t of quest.traps) {
    if (state.seenTraps.has(t.id) || t.kind === 'scripted') continue;
    const cell = t.cell ?? quest.furniture.find((f) => f.id === t.furniture)?.cells[0];
    if (cell) traps.push({ id: t.id, kind: t.kind, cell });
  }

  const monsters: (MonsterDef & { readonly cell: Cell })[] = [];
  const placedByNotes: MonsterDef[] = [];
  for (const m of quest.monsters) {
    if (state.seenMonsters.has(m.id)) continue;
    if (m.cell) monsters.push({ ...m, cell: m.cell });
    else placedByNotes.push(m);
  }

  return {
    cells,
    blocks: level.blocks.filter((b) => !state.seenBlocks.has(b.id)),
    doors: [...level.doors.values()].filter((d) => !state.seenDoors.has(d.id)),
    furniture: quest.furniture.filter((f) => !state.seenFurniture.has(f.id)),
    monsters,
    placedByNotes,
    traps,
    markers: quest.markers,
  };
}
