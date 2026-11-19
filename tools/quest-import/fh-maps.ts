/**
 * Where each Frozen Horror quest map sits in its PDF (all at 300 dpi). Quest 0 is page 1 of the
 * online prelude (a letter page, upright). Quests 1 to 8 are on the pages 8 to 15 of the quest pack:
 * each page is a print spread of 3900 x 3000 pixels with the real page turned a quarter turn, so it
 * is rotated 90 degrees clockwise to read upright (3000 x 3900).
 *
 * `grid` is measured on the upright page: the top-left corner of square (0,0) and the size of one
 * square. The crop keeps a small margin around the board, and the calibration is the same grid
 * expressed in the crop (what `buildOverlaySvg` needs).
 */
import type { Calibration } from './overlay-svg';

export type FhSource = 'book' | 'prelude';
export type Rotation = 0 | 90 | 180 | 270;

export interface FhMap {
  source: FhSource;
  /** PDF page, 1 based. */
  page: number;
  /** Clockwise turn that makes the raw render upright. */
  rotation: Rotation;
  /** Top-left corner of square (0,0) on the upright page, and the square size, in pixels. */
  grid: { x0: number; y0: number; cw: number; ch: number };
}

export const FH_QUESTS = [0, 1, 2, 3, 4, 5, 6, 7, 8] as const;

export const FH_MAPS: Record<number, FhMap> = {
  0: { source: 'prelude', page: 1, rotation: 0, grid: { x0: 349, y0: 482, cw: 71.58, ch: 71.84 } },
  1: { source: 'book', page: 8, rotation: 90, grid: { x0: 412, y0: 266, cw: 82.45, ch: 83.1 } },
  2: { source: 'book', page: 9, rotation: 90, grid: { x0: 414, y0: 261, cw: 82.45, ch: 82.9 } },
  3: { source: 'book', page: 10, rotation: 90, grid: { x0: 415, y0: 259, cw: 82.7, ch: 83.05 } },
  4: { source: 'book', page: 11, rotation: 90, grid: { x0: 401, y0: 270, cw: 83, ch: 83.8 } },
  5: { source: 'book', page: 12, rotation: 90, grid: { x0: 402, y0: 252, cw: 83.1, ch: 83.45 } },
  6: { source: 'book', page: 13, rotation: 90, grid: { x0: 406, y0: 251, cw: 83.1, ch: 83.55 } },
  7: { source: 'book', page: 14, rotation: 90, grid: { x0: 409, y0: 253, cw: 82.5, ch: 82.85 } },
  8: { source: 'book', page: 15, rotation: 90, grid: { x0: 408, y0: 254, cw: 83, ch: 83.35 } },
};

/** Margin kept around the board in the crop, in pixels. */
export const MARGIN = { left: 22, top: 18, right: 30, bottom: 30 };

export interface Crop {
  x: number;
  y: number;
  w: number;
  h: number;
}

function mapOf(q: number): FhMap {
  const m = FH_MAPS[q];
  if (!m) throw new Error(`no Frozen Horror map for quest ${q}`);
  return m;
}

export function fhCrop(q: number): Crop {
  const g = mapOf(q).grid;
  const x = Math.floor(g.x0) - MARGIN.left;
  const y = Math.floor(g.y0) - MARGIN.top;
  return {
    x,
    y,
    w: Math.ceil(g.x0 + 26 * g.cw + MARGIN.right) - x,
    h: Math.ceil(g.y0 + 19 * g.ch + MARGIN.bottom) - y,
  };
}

export function fhCalibration(q: number): Calibration {
  const g = mapOf(q).grid;
  const c = fhCrop(q);
  return { x0: g.x0 - c.x, y0: g.y0 - c.y, cw: g.cw, ch: g.ch, width: c.w, height: c.h };
}

export type Matrix = [number, number, number, number, number, number];

/**
 * Canvas transform (a, b, c, d, e, f) for `ctx.setTransform` that draws the raw render (rawW x rawH)
 * upright and shifted by the crop corner: after it, `drawImage(raw, 0, 0)` fills the crop.
 */
export function uprightTransform(
  rotation: Rotation,
  rawW: number,
  rawH: number,
  crop: { x: number; y: number },
): Matrix {
  const [a, b, c, d, tx, ty]: Matrix =
    rotation === 0
      ? [1, 0, 0, 1, 0, 0]
      : rotation === 90
        ? [0, 1, -1, 0, rawH, 0]
        : rotation === 180
          ? [-1, 0, 0, -1, rawW, rawH]
          : [0, -1, 1, 0, 0, rawW];
  return [a, b, c, d, tx - crop.x, ty - crop.y];
}

/** Size of the page after the turn. */
export function uprightSize(rotation: Rotation, rawW: number, rawH: number): [number, number] {
  return rotation === 90 || rotation === 270 ? [rawH, rawW] : [rawW, rawH];
}
