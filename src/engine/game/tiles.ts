/**
 * Tiles the players put on the physical board (Frozen Horror). The app only tells them which tile and
 * where; it never needs the tile to play. Pure.
 */
import { cellsOf, type Cell } from '../board/board';
import type { Level } from '../board/level';
import { BOARD_TILES, ROOM_TILES, type RoomTileDef } from '../data/roomTiles';
import type { GameState } from './state';
import { boardTilesInView } from './view';

export interface RoomTileView {
  readonly area: string;
  readonly tile: RoomTileDef;
  readonly cells: readonly Cell[];
}

/** The room tiles of rooms the heroes have revealed. */
export function roomTilesInView(level: Level, state: GameState): RoomTileView[] {
  return level.quest.roomTiles
    .filter((t) => state.revealedRooms.has(t.area))
    .map((t) => ({ area: t.area, tile: ROOM_TILES[t.type], cells: cellsOf(level.board, t.area) }));
}

/** Names of the tiles that came into view between two states (rooms revealed, tiles shown). */
export function newTiles(level: Level, before: GameState, after: GameState): string[] {
  const out: string[] = [];
  const old = new Set(boardTilesInView(level, before).map((t) => t.index));
  for (const t of boardTilesInView(level, after))
    if (!old.has(t.index)) out.push(BOARD_TILES[t.type].name);
  for (const t of roomTilesInView(level, after))
    if (!before.revealedRooms.has(t.area)) out.push(t.tile.name);
  return out;
}

/** The sentence that asks the players to put tiles on the board. */
export function putTilesText(names: readonly string[]): string {
  return `Put on the board: ${names.map((n) => `the ${n} tile`).join(', ')}.`;
}

/** Tiles that are on the board before the first move (the cave under the start). */
export function startTiles(level: Level): string[] {
  return level.quest.boardTiles
    .filter((t) => BOARD_TILES[t.type].always)
    .map((t) => BOARD_TILES[t.type].name);
}
