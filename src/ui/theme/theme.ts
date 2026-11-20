import { areaAt, cellsOf, type Board, type Cell } from '../../engine/board/board';
import { ROOM_TILE_TYPES } from '../../engine/data/roomTiles';
import type { FurnitureDef, MonsterType } from '../../engine/quest/schema';
import { TRAP_KINDS } from '../../engine/quest/schema';

/**
 * Themes (decision 78). A theme says how board elements are drawn. It never changes rules, data or
 * the grid. A slot without an image uses the built-in drawing, so a theme can be partial.
 * The built-in theme has no images: it is the line art drawn by BoardView and Furniture.
 */

export type FurnitureType = FurnitureDef['type'];

/** The four corners of a room, clockwise from the top left. */
export const CORNERS = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'] as const;
export type Corner = (typeof CORNERS)[number];

/** One picture for a piece of furniture. It keeps its proportions inside the footprint. */
export interface FurnitureSlot {
  /** Image URL (a data URL or an object URL made from a pack file). */
  readonly href: string;
  /**
   * The footprint in squares as the picture is drawn, for example [3, 2] for a landscape table.
   * When the piece stands the other way on the board, the picture is turned by 90 degrees.
   * Left out: the picture is never turned.
   */
  readonly cells?: readonly [number, number];
  /**
   * For a picture that belongs in a room corner (stairs): which corner of the picture is the solid
   * one. The picture is turned so that corner points into the corner of the room the piece is in.
   */
  readonly corner?: Corner;
  /** Size and shift of the picture (see `Tune`). */
  readonly scale?: number;
  readonly offset?: readonly [number, number];
}

/**
 * How a pack adjusts one picture: `scale` (1 is the normal size, 0.4 to 2.5) makes it smaller or bigger
 * around its center, keeping its proportions, and `offset` moves it by `[dx, dy]` squares.
 */
export interface Tune {
  readonly scale?: number;
  readonly offset?: readonly [number, number];
}

export const SCALE_MIN = 0.4;
export const SCALE_MAX = 2.5;
export const OFFSET_MAX = 1;

/** The box of a picture: normal size `w` x `h` centered on (cx, cy), with its tune applied (`unit` px a square). */
export function tuned(
  cx: number,
  cy: number,
  w: number,
  h: number,
  unit: number,
  tune?: Tune,
): { x: number; y: number; width: number; height: number } {
  const s = tune?.scale ?? 1;
  const width = w * s;
  const height = h * s;
  return {
    x: cx + (tune?.offset?.[0] ?? 0) * unit - width / 2,
    y: cy + (tune?.offset?.[1] ?? 0) * unit - height / 2,
    width,
    height,
  };
}

/**
 * The tiles that can have a picture (Frozen Horror): the room tiles, the board tiles that are a fixed
 * piece (cave entrance, river, ledge, slippery ice) and the ice slide, which is laid along a path.
 */
export const TILE_KEYS = [
  ...ROOM_TILE_TYPES,
  'iceCaveEntrance',
  'icyRiver',
  'iceLedge',
  'slipperyIce',
  'iceSlide',
] as const;
export type TileKey = (typeof TILE_KEYS)[number];

/** The designs of an ice tunnel that can have a picture (the quest data allows 1 to 9). */
export const TUNNEL_DESIGNS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;
export type TunnelDesign = (typeof TUNNEL_DESIGNS)[number];

/** The two doors in the outer wall of the board. */
export const EDGE_DOOR_SLOTS = ['ironEntry', 'woodenExit'] as const;
export type EdgeDoorSlot = (typeof EDGE_DOOR_SLOTS)[number];

/**
 * One picture of a tile. `cells` is its footprint in squares as the picture is drawn (a portrait ice
 * vault is [2, 3]); the picture is drawn once over the squares of a tile of that size, and turned a
 * quarter turn when the tile lies the other way. A tile that comes in two sizes has two pictures.
 */
export interface TilePicture {
  readonly href: string;
  readonly cells: readonly [number, number];
  readonly scale?: number;
  readonly offset?: readonly [number, number];
}

/** The size of a monster token, in px at 34 px a square: a little less than one square. */
export const TOKEN_SIZE = 32;

/** The adjustments of the pictures of a theme, by slot. Only slots that have one are listed. */
export interface ThemeTune {
  readonly monster?: Readonly<Partial<Record<MonsterType, Tune>>>;
  readonly door?: Readonly<Partial<Record<'closed' | 'open' | 'secret', Tune>>>;
  readonly block?: Readonly<Partial<Record<'single' | 'double', Tune>>>;
  readonly trap?: Readonly<Partial<Record<TrapSlot, Tune>>>;
  readonly enemy?: Readonly<Partial<Record<string, Tune>>>;
  readonly edgeDoor?: Readonly<Partial<Record<EdgeDoorSlot, Tune>>>;
  readonly tunnel?: Readonly<Partial<Record<TunnelDesign, Tune>>>;
}

/** The traps that can have a picture: the hidden "armed" look, and one per kind of trap. */
export type TrapSlot = 'armed' | (typeof TRAP_KINDS)[number];

export interface Theme {
  readonly id: string;
  readonly name: string;
  /** The quest pack the theme dresses (`frozen-horror`); left out: the core game. */
  readonly box?: string;
  /**
   * One picture of the whole board (26 x 19 squares, the same shape as the grid). It is shown
   * through the squares the heroes have seen, and it already has the walls, so no wall lines are
   * drawn between rooms. Rock and fog are still drawn over what is not seen.
   */
  readonly board?: string;
  /** Floor tiles of rooms, used in turn. Not needed when the theme has a `board` picture. */
  readonly floor?: readonly string[];
  /** Floor tiles of corridors. */
  readonly corridor?: readonly string[];
  /** One tile that fills the rock. */
  readonly rock?: string;
  readonly furniture?: Readonly<Partial<Record<FurnitureType, FurnitureSlot>>>;
  /** A wall piece, one square long, drawn along wall edges that the board picture does not cover. */
  readonly wall?: string;
  /** A door, one square wide, drawn across the opening (turned for a door in a vertical wall). */
  readonly door?: {
    readonly closed?: string;
    readonly open?: string;
    /** Seen by Zargon only: a door the heroes have not found yet. */
    readonly secret?: string;
  };
  /**
   * The whole token of each monster type (its own frame included). An enemy's own image from
   * the Library wins. The app draws no frame behind it.
   */
  readonly monster?: Readonly<Partial<Record<MonsterType, string>>>;
  /** Blocked squares: one square, and two squares side by side. */
  readonly block?: { readonly single?: string; readonly double?: string };
  /**
   * Traps. `armed` is what the heroes see before a trap springs (its kind stays hidden). A picture per
   * kind is shown once it is known: a sprung pit, a fallen block, and, for Zargon, every trap.
   */
  readonly trap?: Readonly<Partial<Record<TrapSlot, string>>>;
  /**
   * The whole token of an enemy, by enemy id (`iceGremlin`). It wins over the picture of the enemy's
   * base type, and an enemy's own image from the Library still wins over both.
   */
  readonly enemy?: Readonly<Partial<Record<string, string>>>;
  /** Doors in the outer wall of the board (Frozen Horror): the iron entry and the wooden exit. */
  readonly edgeDoor?: Readonly<Partial<Record<EdgeDoorSlot, string>>>;
  /** An ice tunnel end, by design number. A design without a picture keeps the drawn look. */
  readonly tunnel?: Readonly<Partial<Record<TunnelDesign, string>>>;
  /** Pictures of tiles over their squares (see `TilePicture`). A tile without one keeps its outline. */
  readonly tile?: Readonly<Partial<Record<TileKey, readonly TilePicture[]>>>;
  /** Scale and shift of the pictures above, by slot (furniture and tiles carry their own). */
  readonly tune?: ThemeTune;
}

export const CLASSIC_THEME: Theme = { id: 'classic', name: 'Classic' };

/**
 * A theme that builds on another (a Frozen Horror pack on a core pack): every slot the child has wins,
 * every other slot comes from the parent. Groups (monsters, doors, furniture...) merge slot by slot.
 */
export function mergeThemes(parent: Theme, child: Theme): Theme {
  const out: Record<string, unknown> = { ...parent, ...child };
  for (const k of [
    'door',
    'block',
    'trap',
    'monster',
    'furniture',
    'enemy',
    'edgeDoor',
    'tunnel',
    'tile',
  ] as const) {
    const a = parent[k];
    const b = child[k];
    if (a && b) out[k] = { ...a, ...b };
  }
  if (parent.tune || child.tune) {
    const tune: Record<string, unknown> = { ...(parent.tune ?? {}), ...(child.tune ?? {}) };
    for (const k of ['monster', 'door', 'block', 'trap', 'enemy', 'edgeDoor', 'tunnel'] as const) {
      const a = parent.tune?.[k];
      const b = child.tune?.[k];
      if (a && b) tune[k] = { ...a, ...b };
    }
    out['tune'] = tune;
  }
  out['id'] = child.id;
  out['name'] = child.name;
  return out as unknown as Theme;
}

/** The same square always gets the same picture (no randomness, so a redraw never changes it). */
export function tileFor(tiles: readonly string[], x: number, y: number): string | undefined {
  if (tiles.length === 0) return undefined;
  const h = (Math.imul(x + 1, 73856093) ^ Math.imul(y + 1, 19349663)) >>> 0;
  return tiles[h % tiles.length];
}

/** Does the picture have to be turned by 90 degrees to fit a footprint of `w` x `h` squares? */
export function needsTurn(slot: FurnitureSlot, w: number, h: number): boolean {
  if (!slot.cells) return false;
  const [a, b] = slot.cells;
  if (a === b || w === h) return false;
  return a > b !== w > h;
}

/**
 * How far (0, 90, 180 or 270 degrees clockwise) a corner picture must turn so that its solid corner
 * is the corner of the room that the piece stands in. 0 when the piece is not in one corner of its room.
 */
export function cornerTurn(board: Board, cells: readonly Cell[], solid: Corner): number {
  const first = cells[0];
  if (!first) return 0;
  const area = areaAt(board, first[0], first[1]);
  if (area === undefined) return 0;
  const room = cellsOf(board, area);
  const bounds = (cs: readonly Cell[]) => ({
    x0: Math.min(...cs.map((c) => c[0])),
    x1: Math.max(...cs.map((c) => c[0])),
    y0: Math.min(...cs.map((c) => c[1])),
    y1: Math.max(...cs.map((c) => c[1])),
  });
  const r = bounds(room);
  const f = bounds(cells);
  const left = f.x0 === r.x0;
  const right = f.x1 === r.x1;
  const top = f.y0 === r.y0;
  const bottom = f.y1 === r.y1;
  if (left === right || top === bottom) return 0; // in the middle of a wall, or fills the room
  const actual: Corner = top
    ? left
      ? 'topLeft'
      : 'topRight'
    : left
      ? 'bottomLeft'
      : 'bottomRight';
  const steps = (CORNERS.indexOf(actual) - CORNERS.indexOf(solid) + 4) % 4;
  return steps * 90;
}

/** The picture of a monster: its own (an enemy's image) first, then the theme's for its enemy, then for its type. */
export function monsterPicture(
  theme: Theme,
  own: string | undefined,
  type: MonsterType | undefined,
  enemy?: string,
): string | undefined {
  if (own !== undefined) return own;
  const byEnemy = enemy === undefined ? undefined : theme.enemy?.[enemy];
  // no type: an enemy of its own kind that the pack has no picture of: the built-in token is drawn
  return byEnemy ?? (type === undefined ? undefined : theme.monster?.[type]);
}

/** True when the picture comes from the theme, so it is a whole token and the app draws no frame. */
export function isThemeToken(
  theme: Theme,
  own: string | undefined,
  type: MonsterType | undefined,
  enemy?: string,
): boolean {
  return own === undefined && monsterPicture(theme, own, type, enemy) !== undefined;
}

/**
 * The picture of a tile that fits a `w` x `h` footprint (turned or not), and how many quarter turns
 * (0 or 1) it needs to lie that way. Undefined when the theme has no picture of that size.
 */
export function tilePictureFor(
  theme: Theme,
  key: TileKey,
  w: number,
  h: number,
): { picture: TilePicture; turned: boolean } | undefined {
  for (const picture of theme.tile?.[key] ?? []) {
    const [a, b] = picture.cells;
    if (a === w && b === h) return { picture, turned: false };
    if (a === h && b === w) return { picture, turned: true };
  }
  return undefined;
}
