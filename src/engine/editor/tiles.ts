/**
 * Editor operations for tiles placed on the map (Frozen Horror): board tiles with their real
 * footprint (a tile that comes as 2 x 1 or 2 x 3, a cave entrance of 6 x 5), terrain laid square
 * by square, and room tiles. Same style as `ops.ts`: pure, the input is never changed.
 *
 * The squares in the quest are the real footprint. A turned tile is just the same footprint with
 * width and height swapped, so the quest format needs no field for it.
 */
import { tr } from '../../i18n/translate';
import { board, inBoard } from '../board/board';
import {
  BOARD_TILES,
  BOARD_TILE_TYPES,
  MAX_TUNNEL_PAIRS,
  ROOM_TILES,
  ROOM_TILE_TYPES,
  footprintIndex,
  limitText,
  tileMax,
  tileSpec,
  type BoardTileType,
  type Footprint,
  type RoomTileType,
} from '../data/roomTiles';
import type { Quest } from '../quest/schema';
import { roomTileCells } from '../quest/roomTileCells';
import { clean, fail, isRockCell as isRock, newIssues, ok, type EditResult } from './result';

type Cell = [number, number];
type Tile = Quest['boardTiles'][number];
type RoomTile = Quest['roomTiles'][number];

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

/** The squares of every tile of a group, as the editor sees them (a room tile may be an `area`). */
function groupCells(
  q: Quest,
  group: 'board' | 'room',
): { type: string; cells: readonly (readonly number[])[] }[] {
  return group === 'board'
    ? q.boardTiles.map((t) => ({ type: t.type, cells: t.cells as Cell[] }))
    : q.roomTiles.map((t) => ({ type: t.type, cells: roomTileCells(q, t) }));
}

/** How many tiles of a type the quest has and the most it may have (undefined: no limit). */
export function tileUsage(
  q: Quest,
  group: 'board' | 'room',
  type: string,
): { used: number; max: number | undefined; text: string } {
  const spec = tileSpec(group, type);
  const used = groupCells(q, group).filter((t) => t.type === type).length;
  return { used, max: spec ? tileMax(spec) : undefined, text: spec ? limitText(spec) : '' };
}

/** How many tiles of a type already use one of its sizes (a turned tile has the same size). */
export function tileSizeUsed(
  q: Quest,
  group: 'board' | 'room',
  type: string,
  size: Footprint,
  skip?: number,
): number {
  const spec = tileSpec(group, type);
  if (!spec) return 0;
  const at = footprintIndex(spec.footprints, size[0], size[1]);
  return groupCells(q, group).filter((t, i) => {
    if (i === skip || t.type !== type || t.cells.length === 0) return false;
    const b = tileBox(t.cells);
    return b.full && footprintIndex(spec.footprints, b.w, b.h) === at;
  }).length;
}

/** Why the quest may not have one more tile of this type and size, or undefined. */
function limitProblem(
  q: Quest,
  group: 'board' | 'room',
  type: string,
  size: Footprint,
  skip?: number,
): string | undefined {
  const spec = tileSpec(group, type);
  if (!spec || spec.laid || spec.maxPerSize === undefined) return undefined;
  if (tileSizeUsed(q, group, type, size, skip) < spec.maxPerSize) return undefined;
  return tr(
    'editor.tiles.xTheBoxHasAndThis',
    '{name} {size0} x {size1}: the box has {limitText}, and this quest already uses it.',
    { name: spec.name, size0: size[0], size1: size[1], limitText: limitText(spec) },
  );
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
      return tr('editor.tiles.isOffTheBoard', '{name}: {c0}, {c1} is off the board.', {
        name,
        c0: c[0],
        c1: c[1],
      });
  const taken = new Map<string, string>();
  q.boardTiles.forEach((t, i) => {
    if (i !== skip) for (const c of t.cells) taken.set(key(c), BOARD_TILES[t.type].name);
  });
  for (const c of cells) {
    const other = taken.get(key(c));
    if (other)
      return tr(
        'editor.tiles.wouldOverlapTheAt',
        '{name} would overlap the {toLowerCase} at {c0}, {c1}.',
        { name, toLowerCase: other.toLowerCase(), c0: c[0], c1: c[1] },
      );
    // the cave entrance is the one tile that lies over rock
    if (type !== 'iceCaveEntrance' && isRock(q, c))
      return tr('editor.tiles.isRock', '{name}: {c0}, {c1} is rock.', { name, c0: c[0], c1: c[1] });
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
  if (!BOARD_TILE_TYPES.includes(input.type))
    return fail(tr('editor.tiles.thatIsNotABoardTile', 'That is not a board tile.'));
  const def = BOARD_TILES[input.type];
  const cells = tileCellsFor(input.type, input.at, input.variant ?? 0, input.turned ?? false);
  const problem =
    (def.shape === 'fixed' &&
      limitProblem(q, 'board', input.type, [tileBox(cells).w, tileBox(cells).h])) ||
    placeProblem(q, input.type, cells);
  if (def.shape === 'laid') {
    const here = q.boardTiles.findIndex((t) => t.cells.some((c) => key(c) === key(input.at)));
    if (here >= 0)
      return fail(
        tr('editor.tiles.isAlreadyOnThatSquare', '{name} is already on that square.', {
          name: BOARD_TILES[q.boardTiles[here]!.type].name,
        }),
      );
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
  if (!t) return fail(tr('editor.tiles.thereIsNoSuchTile', 'There is no such tile.'));
  const next = fn(t);
  const quest = { ...q, boardTiles: q.boardTiles.map((x, i) => (i === index ? next : x)) };
  return ok(quest, newIssues(q, quest));
}

/** Slide a tile so its top left square is on `to`. */
export function moveBoardTile(q: Quest, index: number, to: Cell): EditResult {
  const t = q.boardTiles[index];
  if (!t) return fail(tr('editor.tiles.thereIsNoSuchTile', 'There is no such tile.'));
  const box = tileBox(t.cells);
  const cells = ordered(t.cells.map((c) => [c[0] - box.x + to[0], c[1] - box.y + to[1]] as Cell));
  const problem = placeProblem(q, t.type, cells, index);
  if (problem) return fail(problem);
  return withTile(q, index, (x) => ({ ...x, cells }));
}

/** Give a fixed tile another size, keeping its top left square. The size must be one it comes in. */
export function resizeBoardTile(q: Quest, index: number, size: Footprint): EditResult {
  const t = q.boardTiles[index];
  if (!t) return fail(tr('editor.tiles.thereIsNoSuchTile', 'There is no such tile.'));
  const def = BOARD_TILES[t.type];
  if (def.shape === 'laid')
    return fail(
      tr(
        'editor.tiles.isLaidSquareBySquareIt',
        '{name} is laid square by square, it has no size.',
        { name: def.name },
      ),
    );
  if (!tileSizes(t.type).some((s) => s[0] === size[0] && s[1] === size[1]))
    return fail(
      tr('editor.tiles.doesNotComeAsX', '{name} does not come as {size0} x {size1}.', {
        name: def.name,
        size0: size[0],
        size1: size[1],
      }),
    );
  const box = tileBox(t.cells);
  const cells = rectCells([box.x, box.y], size[0], size[1]);
  const problem =
    limitProblem(q, 'board', t.type, size, index) || placeProblem(q, t.type, cells, index);
  if (problem) return fail(problem);
  return withTile(q, index, (x) => ({ ...x, cells }));
}

/** Turn a fixed tile a quarter turn: width and height swap, the top left square stays. */
export function rotateBoardTile(q: Quest, index: number): EditResult {
  const t = q.boardTiles[index];
  if (!t) return fail(tr('editor.tiles.thereIsNoSuchTile', 'There is no such tile.'));
  const def = BOARD_TILES[t.type];
  if (def.shape === 'laid')
    return fail(
      tr(
        'editor.tiles.isLaidSquareBySquareIt2',
        '{name} is laid square by square, it cannot be turned.',
        { name: def.name },
      ),
    );
  const box = tileBox(t.cells);
  if (!box.full)
    return fail(
      tr(
        'editor.tiles.thisTileIsNotAPlain',
        'This tile is not a plain rectangle, so it cannot be turned.',
      ),
    );
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
  if (!t) return fail(tr('editor.tiles.thereIsNoSuchTile', 'There is no such tile.'));
  const hiddenWhen =
    flags.hiddenWhen === undefined ? t.hiddenWhen : flags.hiddenWhen.trim() || undefined;
  const blocks = flags.blocks === undefined ? t.blocks : flags.blocks || undefined;
  if (blocks && !hiddenWhen)
    return fail(
      tr(
        'editor.tiles.aTileThatBlocksNeedsA',
        'A tile that blocks needs a flag that takes it away. Type the flag first.',
      ),
    );
  return withTile(q, index, (x) => clean({ type: x.type, cells: x.cells, hiddenWhen, blocks }));
}

/** Take one square out of laid terrain. The last square takes the tile with it. */
export function removeBoardTileCell(q: Quest, index: number, cell: Cell): EditResult {
  const t = q.boardTiles[index];
  if (!t) return fail(tr('editor.tiles.thereIsNoSuchTile', 'There is no such tile.'));
  if (!t.cells.some((c) => key(c) === key(cell)))
    return fail(tr('editor.tiles.thatSquareIsNotInThe', 'That square is not in the tile.'));
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

// ---- room tiles (decision 88): a physical tile over squares, like a board tile ----

/** Every size a room tile can be laid in: its footprints and the same turned a quarter. */
export function roomTileSizes(type: RoomTileType): Footprint[] {
  const out: Footprint[] = [];
  for (const [w, h] of ROOM_TILES[type].footprints)
    for (const f of [[w, h] as Footprint, [h, w] as Footprint])
      if (!out.some((o) => o[0] === f[0] && o[1] === f[1])) out.push(f);
  return out;
}

/** The squares a room tile covers when placed at `at`: `variant` picks a footprint, `turned` swaps it. */
export function roomTileCellsFor(
  type: RoomTileType,
  at: readonly number[],
  variant: number,
  turned: boolean,
): Cell[] {
  const fps = ROOM_TILES[type].footprints;
  const [w0, h0] = fps[Math.min(Math.max(variant, 0), fps.length - 1)]!;
  return turned ? rectCells(at, h0, w0) : rectCells(at, w0, h0);
}

/** Why these squares cannot hold this room tile, or undefined. `skip` is the tile being changed. */
function roomPlaceProblem(
  q: Quest,
  type: RoomTileType,
  cells: readonly Cell[],
  skip?: number,
): string | undefined {
  const name = ROOM_TILES[type].name;
  for (const c of cells)
    if (!Number.isInteger(c[0]) || !Number.isInteger(c[1]) || !inBoard(board, c[0], c[1]))
      return tr('editor.tiles.isOffTheBoard', '{name}: {c0}, {c1} is off the board.', {
        name,
        c0: c[0],
        c1: c[1],
      });
  const taken = new Map<string, string>();
  q.roomTiles.forEach((t, i) => {
    if (i !== skip) for (const c of roomTileCells(q, t)) taken.set(key(c), ROOM_TILES[t.type].name);
  });
  for (const c of cells) {
    const other = taken.get(key(c));
    if (other)
      return tr(
        'editor.tiles.wouldOverlapTheAt',
        '{name} would overlap the {toLowerCase} at {c0}, {c1}.',
        { name, toLowerCase: other.toLowerCase(), c0: c[0], c1: c[1] },
      );
    if (isRock(q, c))
      return tr('editor.tiles.isRock', '{name}: {c0}, {c1} is rock.', {
        name,
        c0: c[0],
        c1: c[1],
      });
  }
  return undefined;
}

/**
 * Lay a room tile with its top left square on `at`. `variant` picks one of the tile's footprints and
 * `turned` swaps width and height. The tile may lie over parts of two rooms and over corridor squares.
 */
export function placeRoomTile(
  q: Quest,
  input: { type: RoomTileType; at: Cell; variant?: number; turned?: boolean },
): EditResult {
  if (!ROOM_TILE_TYPES.includes(input.type))
    return fail(tr('editor.tiles.thatIsNotARoomTile', 'That is not a room tile.'));
  const cells = roomTileCellsFor(input.type, input.at, input.variant ?? 0, input.turned ?? false);
  const b = tileBox(cells);
  const problem =
    limitProblem(q, 'room', input.type, [b.w, b.h]) || roomPlaceProblem(q, input.type, cells);
  if (problem) return fail(problem);
  const quest = { ...q, roomTiles: [...q.roomTiles, { type: input.type, cells }] };
  return ok(quest, newIssues(q, quest));
}

function withRoomTile(q: Quest, index: number, fn: (t: RoomTile) => RoomTile): EditResult {
  const t = q.roomTiles[index];
  if (!t) return fail(tr('editor.tiles.thereIsNoSuchTile', 'There is no such tile.'));
  const quest = { ...q, roomTiles: q.roomTiles.map((x, i) => (i === index ? fn(x) : x)) };
  return ok(quest, newIssues(q, quest));
}

/** Slide a room tile so its top left square is on `to`. A tile that filled a room gets squares. */
export function moveRoomTile(q: Quest, index: number, to: Cell): EditResult {
  const t = q.roomTiles[index];
  if (!t) return fail(tr('editor.tiles.thereIsNoSuchTile', 'There is no such tile.'));
  const here = roomTileCells(q, t);
  const box = tileBox(here);
  const cells = ordered(here.map((c) => [c[0] - box.x + to[0], c[1] - box.y + to[1]] as Cell));
  const problem = roomPlaceProblem(q, t.type, cells, index);
  if (problem) return fail(problem);
  return withRoomTile(q, index, (x) => ({ type: x.type, cells }));
}

/** Give a room tile another size it comes in, keeping its top left square. */
export function resizeRoomTile(q: Quest, index: number, size: Footprint): EditResult {
  const t = q.roomTiles[index];
  if (!t) return fail(tr('editor.tiles.thereIsNoSuchTile', 'There is no such tile.'));
  if (!roomTileSizes(t.type).some((s) => s[0] === size[0] && s[1] === size[1]))
    return fail(
      tr('editor.tiles.doesNotComeAsX', '{name} does not come as {size0} x {size1}.', {
        name: ROOM_TILES[t.type].name,
        size0: size[0],
        size1: size[1],
      }),
    );
  const box = tileBox(roomTileCells(q, t));
  const cells = rectCells([box.x, box.y], size[0], size[1]);
  const problem =
    limitProblem(q, 'room', t.type, size, index) || roomPlaceProblem(q, t.type, cells, index);
  if (problem) return fail(problem);
  return withRoomTile(q, index, (x) => ({ type: x.type, cells }));
}

/** Turn a room tile a quarter turn: width and height swap, the top left square stays. */
export function rotateRoomTile(q: Quest, index: number): EditResult {
  const t = q.roomTiles[index];
  if (!t) return fail(tr('editor.tiles.thereIsNoSuchTile', 'There is no such tile.'));
  const box = tileBox(roomTileCells(q, t));
  if (!box.full)
    return fail(
      tr(
        'editor.tiles.thisTileIsNotAPlain',
        'This tile is not a plain rectangle, so it cannot be turned.',
      ),
    );
  if (box.w === box.h) return ok(q);
  return resizeRoomTile(q, index, [box.h, box.w]);
}

/** Take a room tile away. */
export function removeRoomTile(q: Quest, index: number): EditResult {
  if (!q.roomTiles[index])
    return fail(tr('editor.tiles.thereIsNoSuchTile', 'There is no such tile.'));
  const quest = { ...q, roomTiles: q.roomTiles.filter((_, i) => i !== index) };
  return ok(quest, newIssues(q, quest));
}

/** The index of the room tile over a square, or -1. */
export function roomTileIndexAt(q: Quest, cell: readonly number[]): number {
  return q.roomTiles.findIndex((t) => roomTileCells(q, t).some((c) => key(c) === key(cell)));
}

/** True when the quest may not have one more ice tunnel pair (the box holds three). */
export function tunnelsFull(q: Quest): boolean {
  return q.tunnels.length >= MAX_TUNNEL_PAIRS;
}
