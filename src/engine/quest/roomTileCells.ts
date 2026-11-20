/**
 * The squares of a room tile (decision 88). A tile with `cells` lies over exactly those squares. A
 * tile with `area` fills that room: the rooms merged into it count, rock squares do not (the cage
 * room of Q0 is a 4 x 4 tile over one room, a strip of its neighbour and rock).
 */
import { areaAt, board as realBoard, type Board, type Cell } from '../board/board';
import type { Quest } from './schema';

type Tile = Quest['roomTiles'][number];
type Source = Pick<Quest, 'areaOverrides' | 'rock'>;

export function roomTileCells(quest: Source, t: Tile, base: Board = realBoard): Cell[] {
  if (t.cells) return t.cells.map((c) => [c[0], c[1]] as Cell);
  const rooms = new Set<string>([t.area as string]);
  for (const m of quest.areaOverrides) if (rooms.has(m.merge[0])) rooms.add(m.merge[1]);
  const rockRooms = new Set(quest.rock.rooms);
  const rockCells = new Set(quest.rock.cells.map((c) => `${c[0]},${c[1]}`));
  const out: Cell[] = [];
  for (let y = 0; y < base.height; y++)
    for (let x = 0; x < base.width; x++) {
      const a = areaAt(base, x, y);
      if (a === undefined || !rooms.has(a) || rockCells.has(`${x},${y}`)) continue;
      if (rockRooms.has(a)) continue;
      out.push([x, y]);
    }
  return out;
}

/** The rooms (ids after merges) a tile has a square in. */
export function roomTileAreas(level: { board: Board }, cells: readonly Cell[]): Set<string> {
  const out = new Set<string>();
  for (const c of cells) {
    const a = areaAt(level.board, c[0], c[1]);
    if (a !== undefined && a !== 'C') out.add(a);
  }
  return out;
}
