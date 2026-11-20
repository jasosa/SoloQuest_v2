/**
 * Tiles the players put on the physical board (Frozen Horror). The app only tells them which tile and
 * where; it never needs the tile to play. Pure.
 */
import { areaAt, type Cell } from '../board/board';
import { tr } from '../../i18n/translate';
import type { Level } from '../board/level';
import { BOARD_TILES, ROOM_TILES, type RoomTileDef } from '../data/roomTiles';
import { roomTileCells } from '../quest/roomTileCells';
import type { GameState } from './state';
import { boardTilesInView } from './view';

export interface RoomTileView {
  /** The place in the quest's `roomTiles`. */
  readonly index: number;
  readonly tile: RoomTileDef;
  readonly cells: readonly Cell[];
}

/**
 * The room tiles the heroes can see: a tile that fills a room once the room is revealed, a tile over
 * squares once one of its squares has been seen (decision 88).
 */
export function roomTilesInView(level: Level, state: GameState): RoomTileView[] {
  const out: RoomTileView[] = [];
  level.quest.roomTiles.forEach((t, index) => {
    const cells = roomTileCells(level.quest, t);
    const seen = t.area
      ? state.revealedRooms.has(t.area)
      : cells.some((c) => state.seenCells.has(`${c[0]},${c[1]}`));
    if (seen) out.push({ index, tile: ROOM_TILES[t.type], cells });
  });
  return out;
}

/** The visible room tiles that have a square in a room (a tile can lie over two rooms). */
export function roomTilesInArea(level: Level, state: GameState, area: string): RoomTileView[] {
  return roomTilesInView(level, state).filter((t) =>
    t.cells.some((c) => areaAt(level.board, c[0], c[1]) === area),
  );
}

/** The visible room tiles over a square (a tile can lie over corridor squares). */
export function roomTilesAt(level: Level, state: GameState, cell: Cell): RoomTileView[] {
  return roomTilesInView(level, state).filter((t) =>
    t.cells.some((c) => c[0] === cell[0] && c[1] === cell[1]),
  );
}

/** Names of the tiles that came into view between two states (rooms revealed, tiles shown). */
export function newTiles(level: Level, before: GameState, after: GameState): string[] {
  const out: string[] = [];
  const old = new Set(boardTilesInView(level, before).map((t) => t.index));
  for (const t of boardTilesInView(level, after))
    if (!old.has(t.index)) out.push(BOARD_TILES[t.type].name);
  const oldRoom = new Set(roomTilesInView(level, before).map((t) => t.index));
  for (const t of roomTilesInView(level, after)) if (!oldRoom.has(t.index)) out.push(t.tile.name);
  return out;
}

/** The sentence that asks the players to put tiles on the board. */
export function putTilesText(names: readonly string[]): string {
  return tr('game.putTiles', 'Put on the board: {tiles}.', {
    tiles: names.map((n) => tr('game.theTile', 'the {name} tile', { name: n })).join(', '),
  });
}

/** Tiles that are on the board before the first move (the cave under the start). */
export function startTiles(level: Level): string[] {
  return level.quest.boardTiles
    .filter((t) => BOARD_TILES[t.type].always)
    .map((t) => BOARD_TILES[t.type].name);
}
