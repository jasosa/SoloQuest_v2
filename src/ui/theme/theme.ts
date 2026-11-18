import type { FurnitureDef } from '../../engine/quest/schema';

/**
 * Themes (decision 78). A theme says how board elements are drawn. It never changes rules, data or
 * the grid. A slot without an image uses the built-in drawing, so a theme can be partial.
 * The built-in theme has no images: it is the line art drawn by BoardView and Furniture.
 */

export type FurnitureType = FurnitureDef['type'];

/** One picture for a piece of furniture. */
export interface FurnitureSlot {
  /** Image URL (a data URL or an object URL made from a pack file). */
  readonly href: string;
  /**
   * The footprint in squares as the picture is drawn, for example [2, 1] for a landscape table.
   * When the piece stands the other way on the board, the picture is turned by 90 degrees.
   * Left out: the picture is stretched to the footprint and never turned.
   */
  readonly cells?: readonly [number, number];
}

export interface Theme {
  readonly id: string;
  readonly name: string;
  /** Floor tiles of rooms. Several pictures are used in turn, so the floor does not repeat. */
  readonly floor?: readonly string[];
  /** Floor tiles of corridors. */
  readonly corridor?: readonly string[];
  /** One tile that fills the rock. */
  readonly rock?: string;
  readonly furniture?: Readonly<Partial<Record<FurnitureType, FurnitureSlot>>>;
  /** A wall piece, one square long, drawn along every wall edge (turned for vertical walls). */
  readonly wall?: string;
  /** A door, one square wide, drawn across the opening (turned for a door in a vertical wall). */
  readonly door?: { readonly closed?: string; readonly open?: string };
  /** A blocked square (rubble, a fallen block). */
  readonly block?: string;
  /** A trap: armed (what the heroes see before it springs) and sprung (the pit tile). */
  readonly trap?: { readonly armed?: string; readonly sprung?: string };
}

export const CLASSIC_THEME: Theme = { id: 'classic', name: 'Classic' };

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
