/**
 * Editor operations for tiles placed on the map (Frozen Horror): board tiles with their real
 * footprint (a tile that comes as 2 x 1 or 2 x 3, a cave entrance of 6 x 5), terrain laid square
 * by square, and room tiles. Same style as `ops.ts`: pure, the input is never changed.
 *
 * The squares in the quest are the real footprint. A turned tile is just the same footprint with
 * width and height swapped, so the quest format needs no field for it.
 */
import { areaAt, board, inBoard } from '../board/board';
import {
  BOARD_TILES,
  BOARD_TILE_TYPES,
  ROOM_TILE_TYPES,
  type BoardTileType,
  type Footprint,
  type RoomTileType,
} from '../data/roomTiles';
import type { Quest } from '../quest/schema';
import { clean, fail, isRockCell as isRock, newIssues, ok, type EditResult } from './result';

type Cell = [number, number];
type Tile = Quest['boardTiles'][number];

const key = (c: readonly number[]) => `${c[0]},${c[1]}`;

/** Every size a tile type can be laid in: its footprints and the same turned a quarter. */
export function tileSizes(type: BoardTileType): Footprint[] {
  const out: Footprint[] = [];
  for (const [w, h] of BOARD_TILES[type].footprints)
    for (const f of [[w, h] as Footprint, [h, w] as Footprint])
      if (!out.some((o) => o[0] === f[0] && o[1] === f[1])) out.push(f);
  return out;
}

/** The squares of a w x h rectangle whose top left square is `at`. */
export function rectCells(at: readonly number[], w: number, h: number): Cell[] {
  const out: Cell[] = [];
  for (let dy = 0; dy < h; dy++)
    for (let dx = 0; dx < w; dx++) out.push([(at[0] as number) + dx, (at[1] as number) + dy]);
  return out;
}

/** The box around a tile's squares, and whether the squares fill it (a plain rectangle). */
export function tileBox(cells: readonly (readonly number[])[]): {
  x: number;
  y: number;
  w: number;
  h: number;
  full: boolean;
} {
  const xs = cells.map((c) => c[0] as number);
  const ys = cells.map((c) => c[1] as number);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const w = Math.max(...xs) - x + 1;
  const h = Math.max(...ys) - y + 1;
  return { x, y, w, h, full: new Set(cells.map(key)).size === w * h };
}

/** The squares a tile type covers when placed at `at`: `variant` picks a footprint, `turned` swaps it. */
export function tileCellsFor(
  type: BoardTileType,
  at: readonly number[],
  variant: number,
  turned: boolean,
): Cell[] {
  const def = BOARD_TILES[type];
  if (def.shape === 'laid') return [[at[0] as number, at[1] as number]];
  const [w0, h0] = def.footprints[Math.min(Math.max(variant, 0), def.footprints.length - 1)]!;
  return turned ? rectCells(at, h0, w0) : rectCells(at, w0, h0);
}

/** Why these squares cannot hold this tile, or undefined. `skip` is the tile being changed. */
function placeProblem(
  q: Quest,
  type: BoardTileType,
  cells: readonly Cell[],
  skip?: number,
): string | undefined {
  const name = BOARD_TILES[type].name;
  for (const c of cells)
    if (!Number.isInteger(c[0]) || !Number.isInteger(c[1]) || !inBoard(board, c[0], c[1]))
      return `${name}: ${c[0]}, ${c[1]} is off the board.`;
  const taken = new Map<string, string>();
  q.boardTiles.forEach((t, i) => {
    if (i !== skip) for (const c of t.cells) taken.set(key(c), BOARD_TILES[t.type].name);
  });
  for (const c of cells) {
    const other = taken.get(key(c));
    if (other) return `${name} would overlap the ${other.toLowerCase()} at ${c[0]}, ${c[1]}.`;
    // the cave entrance is the one tile that lies over rock
    if (type !== 'iceCaveEntrance' && isRock(q, c)) return `${name}: ${c[0]}, ${c[1]} is rock.`;
  }
  return undefined;
}

/** Normalize cells into a stable order (rows, then columns). */
const ordered = (cells: readonly Cell[]): Cell[] =>
  [...cells].sort((a, b) => a[1] - b[1] || a[0] - b[0]).map((c) => [c[0], c[1]] as Cell);

/**
 * Lay a board tile with its top left square on `at`. `variant` picks one of the tile's footprints
 * and `turned` swaps width and height. Terrain that is laid square by square (icy river, ice
 * ledge, chasm) takes one square and grows the tile of the same type that touches it, else it
 * starts a new tile.
 */
export function placeBoardTile(
  q: Quest,
  input: { type: BoardTileType; at: Cell; variant?: number; turned?: boolean },
): EditResult {
  if (!BOARD_TILE_TYPES.includes(input.type)) return fail('That is not a board tile.');
  const def = BOARD_TILES[input.type];
  const cells = tileCellsFor(input.type, input.at, input.variant ?? 0, input.turned ?? false);
  const problem = placeProblem(q, input.type, cells);
  if (def.shape === 'laid') {
    const here = q.boardTiles.findIndex((t) => t.cells.some((c) => key(c) === key(input.at)));
    if (here >= 0)
      return fail(`${BOARD_TILES[q.boardTiles[here]!.type].name} is already on that square.`);
    if (problem) return fail(problem);
    const near = q.boardTiles.findIndex(
      (t) =>
        t.type === input.type &&
        t.cells.some((c) => Math.abs(c[0] - input.at[0]) + Math.abs(c[1] - input.at[1]) === 1),
    );
    const boardTiles =
      near >= 0
        ? q.boardTiles.map((t, i) =>
            i === near ? { ...t, cells: ordered([...(t.cells as Cell[]), ...cells]) } : t,
          )
        : [...q.boardTiles, { type: input.type, cells }];
    const quest = { ...q, boardTiles };
    return ok(quest, newIssues(q, quest));
  }
  if (problem) return fail(problem);
  const quest = { ...q, boardTiles: [...q.boardTiles, { type: input.type, cells }] };
  return ok(quest, newIssues(q, quest));
}

function withTile(q: Quest, index: number, fn: (t: Tile) => Tile): EditResult {
  const t = q.boardTiles[index];
  if (!t) return fail('There is no such tile.');
  const next = fn(t);
  const quest = { ...q, boardTiles: q.boardTiles.map((x, i) => (i === index ? next : x)) };
  return ok(quest, newIssues(q, quest));
}

/** Slide a tile so its top left square is on `to`. */
export function moveBoardTile(q: Quest, index: number, to: Cell): EditResult {
  const t = q.boardTiles[index];
  if (!t) return fail('There is no such tile.');
  const box = tileBox(t.cells);
  const cells = ordered(t.cells.map((c) => [c[0] - box.x + to[0], c[1] - box.y + to[1]] as Cell));
  const problem = placeProblem(q, t.type, cells, index);
  if (problem) return fail(problem);
  return withTile(q, index, (x) => ({ ...x, cells }));
}

/** Give a fixed tile another size, keeping its top left square. The size must be one it comes in. */
export function resizeBoardTile(q: Quest, index: number, size: Footprint): EditResult {
  const t = q.boardTiles[index];
  if (!t) return fail('There is no such tile.');
  const def = BOARD_TILES[t.type];
  if (def.shape === 'laid') return fail(`${def.name} is laid square by square, it has no size.`);
  if (!tileSizes(t.type).some((s) => s[0] === size[0] && s[1] === size[1]))
    return fail(`${def.name} does not come as ${size[0]} x ${size[1]}.`);
  const box = tileBox(t.cells);
  const cells = rectCells([box.x, box.y], size[0], size[1]);
  const problem = placeProblem(q, t.type, cells, index);
  if (problem) return fail(problem);
  return withTile(q, index, (x) => ({ ...x, cells }));
}

/** Turn a fixed tile a quarter turn: width and height swap, the top left square stays. */
export function rotateBoardTile(q: Quest, index: number): EditResult {
  const t = q.boardTiles[index];
  if (!t) return fail('There is no such tile.');
  const def = BOARD_TILES[t.type];
  if (def.shape === 'laid')
    return fail(`${def.name} is laid square by square, it cannot be turned.`);
  const box = tileBox(t.cells);
  if (!box.full) return fail('This tile is not a plain rectangle, so it cannot be turned.');
  if (box.w === box.h) return ok(q);
  return resizeBoardTile(q, index, [box.h, box.w]);
}

/**
 * The flag that takes a tile away (`hiddenWhen`) and whether it blocks sight and squares until
 * then. An empty text clears the flag. A tile that blocks needs a flag.
 */
export function setBoardTileFlags(
  q: Quest,
  index: number,
  flags: { hiddenWhen?: string; blocks?: boolean },
): EditResult {
  const t = q.boardTiles[index];
  if (!t) return fail('There is no such tile.');
  const hiddenWhen =
    flags.hiddenWhen === undefined ? t.hiddenWhen : flags.hiddenWhen.trim() || undefined;
  const blocks = flags.blocks === undefined ? t.blocks : flags.blocks || undefined;
  if (blocks && !hiddenWhen)
    return fail('A tile that blocks needs a flag that takes it away. Type the flag first.');
  return withTile(q, index, (x) => clean({ type: x.type, cells: x.cells, hiddenWhen, blocks }));
}

/** Take one square out of laid terrain. The last square takes the tile with it. */
export function removeBoardTileCell(q: Quest, index: number, cell: Cell): EditResult {
  const t = q.boardTiles[index];
  if (!t) return fail('There is no such tile.');
  if (!t.cells.some((c) => key(c) === key(cell))) return fail('That square is not in the tile.');
  const left = t.cells.filter((c) => key(c) !== key(cell));
  if (left.length === 0) {
    const quest = { ...q, boardTiles: q.boardTiles.filter((_, i) => i !== index) };
    return ok(quest, newIssues(q, quest));
  }
  return withTile(q, index, (x) => ({ ...x, cells: left }));
}

/** The index of the board tile on a square, or -1. */
export function boardTileAt(q: Quest, cell: readonly number[]): number {
  return q.boardTiles.findIndex((t) => t.cells.some((c) => key(c) === key(cell)));
}

/**
 * Put a room tile in the room that holds `cell`, replacing the room's old tile. A corridor is not
 * a room.
 */
export function placeRoomTile(q: Quest, cell: Cell, type: RoomTileType): EditResult {
  if (!ROOM_TILE_TYPES.includes(type)) return fail('That is not a room tile.');
  if (!inBoard(board, cell[0], cell[1])) return fail('That square is off the board.');
  const area = areaAt(board, cell[0], cell[1]);
  if (!area || area === 'C') return fail('A room tile goes in a room. Tap a room, not a corridor.');
  const merged = q.areaOverrides.find((m) => m.merge[1] === area);
  const room = merged ? merged.merge[0] : area;
  const rest = q.roomTiles.filter((t) => t.area !== room);
  const quest = { ...q, roomTiles: [...rest, { type, area: room }] };
  return ok(quest, newIssues(q, quest));
}

/** The room tile of the room that holds `cell`, or undefined. */
export function roomTileAt(q: Quest, cell: readonly number[]) {
  const area = areaAt(board, cell[0] as number, cell[1] as number);
  if (!area) return undefined;
  const merged = q.areaOverrides.find((m) => m.merge[1] === area);
  const room = merged ? merged.merge[0] : area;
  return q.roomTiles.find((t) => t.area === room);
}
