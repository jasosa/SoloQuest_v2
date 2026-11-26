import type { ReactNode } from 'react';
import { color } from '../shared/tokens';
import {
  TOKEN_SIZE,
  tileFor,
  tilePictureFor,
  tuned,
  type EdgeDoorSlot,
  type Theme,
  type TileKey,
  type TrapSlot,
  type TunnelDesign,
} from './theme';
import type { MonsterType } from '../../engine/quest/schema';

/**
 * Drawing helpers shared by every board (play, Zargon view, editor, debug): the floor square and
 * the rock fill. With no picture in the theme they draw the built-in look (decision 78).
 */

/** One floor square at cell (x, y), `size` px wide. */
export function floorCell(
  theme: Theme,
  x: number,
  y: number,
  size: number,
  corridor: boolean,
  key: string,
  art = 'board-art',
): ReactNode {
  // the board picture shows through the squares that are drawn (the pattern is `<BoardArt id={art} />`)
  if (theme.board)
    return (
      <rect
        key={key}
        x={x * size}
        y={y * size}
        width={size}
        height={size}
        fill={`url(#${art})`}
        data-themed="floor"
      />
    );
  const tile = tileFor((corridor ? theme.corridor : undefined) ?? theme.floor ?? [], x, y);
  if (tile)
    return (
      <image
        key={key}
        href={tile}
        x={x * size}
        y={y * size}
        width={size}
        height={size}
        preserveAspectRatio="none"
        data-themed="floor"
      />
    );
  return (
    <rect
      key={key}
      x={x * size}
      y={y * size}
      width={size}
      height={size}
      fill={corridor ? color.corridor : color.floor}
      stroke={color.cellLine}
      strokeWidth={0.8}
    />
  );
}

/** The picture of the whole board as a pattern called `id`, `w` x `h` squares of `size` px. */
export function BoardArt({
  id,
  theme,
  w,
  h,
  size,
}: {
  id: string;
  theme: Theme;
  w: number;
  h: number;
  size: number;
}) {
  if (!theme.board) return null;
  return (
    <pattern id={id} width={w * size} height={h * size} patternUnits="userSpaceOnUse" x={0} y={0}>
      <image
        href={theme.board}
        width={w * size}
        height={h * size}
        preserveAspectRatio="none"
        data-themed="board"
      />
    </pattern>
  );
}

/** The rock fill, as a pattern called `id`: the hatching, or the theme's rock picture. */
export function RockPattern({ id, theme, size }: { id: string; theme: Theme; size: number }) {
  if (theme.rock)
    return (
      <pattern id={id} width={size} height={size} patternUnits="userSpaceOnUse">
        <image href={theme.rock} width={size} height={size} preserveAspectRatio="none" />
      </pattern>
    );
  return (
    <pattern
      id={id}
      width={6}
      height={6}
      patternUnits="userSpaceOnUse"
      patternTransform="rotate(45)"
    >
      <rect width={6} height={6} fill={color.rock} />
      <line x1={0} y1={0} x2={0} y2={6} stroke={color.rockLine} strokeWidth={2} />
    </pattern>
  );
}

const WALL_THICK = 8;
const DOOR_THICK = 14;

/** A wall edge from (x1, y1) to (x2, y2): the theme's wall piece, or the built-in ink line. */
export function wallSegment(
  theme: Theme,
  key: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): ReactNode {
  if (!theme.wall)
    return (
      <line
        key={key}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color.ink}
        strokeWidth={3.2}
        strokeLinecap="square"
      />
    );
  const vertical = x1 === x2;
  const len = Math.abs(vertical ? y2 - y1 : x2 - x1);
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  return (
    <image
      key={key}
      href={theme.wall}
      x={mx - len / 2}
      y={my - WALL_THICK / 2}
      width={len}
      height={WALL_THICK}
      preserveAspectRatio="none"
      transform={vertical ? `rotate(90 ${mx} ${my})` : undefined}
      data-themed="wall"
    />
  );
}

/** A door at (cx, cy), `size` px wide: the theme's picture, or null for the built-in drawing. */
export function doorPiece(
  theme: Theme,
  kind: 'closed' | 'open' | 'secret',
  cx: number,
  cy: number,
  vertical: boolean,
  size: number,
): ReactNode {
  const href = theme.door?.[kind];
  if (!href) return null;
  const tune = theme.tune?.door?.[kind];
  const turn = vertical ? `rotate(90 ${cx} ${cy})` : undefined;
  if (kind === 'secret') {
    // A secret door picture is about square (a slab on the wall line with its leaf swung up): its
    // bottom edge sits on the wall, and it is turned for a door in a vertical wall.
    return (
      <image
        href={href}
        {...tuned(cx, cy - size / 2 + 5, size, size, size, tune)}
        preserveAspectRatio="xMidYMid meet"
        transform={turn}
        data-themed="door"
      />
    );
  }
  return (
    <image
      href={href}
      {...tuned(cx, cy, size, DOOR_THICK, size, tune)}
      preserveAspectRatio="none"
      transform={turn}
      data-themed="door"
    />
  );
}

/** The slot of a picture that fills one square. */
export type SquareSlot = { group: 'block'; key: 'single' } | { group: 'trap'; key: TrapSlot };

/** One square filled with a picture (a block, a trap), or null for the built-in drawing. */
export function squarePiece(
  theme: Theme,
  slot: SquareSlot,
  x: number,
  y: number,
  size: number,
  kind: string,
): ReactNode {
  const href = slot.group === 'block' ? theme.block?.[slot.key] : theme.trap?.[slot.key];
  if (!href) return null;
  const tune =
    slot.group === 'block' ? theme.tune?.block?.[slot.key] : theme.tune?.trap?.[slot.key];
  return (
    <image
      href={href}
      {...tuned((x + 0.5) * size, (y + 0.5) * size, size, size, size, tune)}
      preserveAspectRatio="xMidYMid meet"
      data-themed={kind}
    />
  );
}

/**
 * The box of a monster token (one picture, about a square wide) with the pack's scale and shift. A
 * picture made for an enemy (`enemy`) has its own tune, otherwise the one of the monster type.
 */
export function tokenBox(
  theme: Theme,
  type: MonsterType,
  cx: number,
  cy: number,
  unit: number,
  enemy?: string,
) {
  const tune =
    enemy !== undefined && theme.enemy?.[enemy] !== undefined
      ? theme.tune?.enemy?.[enemy]
      : theme.tune?.monster?.[type];
  return tuned(cx, cy, TOKEN_SIZE, TOKEN_SIZE, unit, tune);
}

type Sq = readonly [number, number];

/** The rectangle of squares a tile covers, or null when the squares are not a full rectangle. */
export function tileRect(
  cells: readonly Sq[],
): { x: number; y: number; w: number; h: number } | null {
  if (cells.length === 0) return null;
  const xs = cells.map((c) => c[0]);
  const ys = cells.map((c) => c[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const w = Math.max(...xs) - x + 1;
  const h = Math.max(...ys) - y + 1;
  return cells.length === w * h ? { x, y, w, h } : null;
}

/**
 * A tile picture drawn once over the squares of a tile (a full rectangle), exactly on them, turned
 * a quarter turn when the tile lies the other way than the picture. Null when the theme has no
 * picture of that tile and size: the tile keeps its built-in outline.
 */
export function tilePiece(
  theme: Theme,
  key: TileKey,
  cells: readonly Sq[],
  size: number,
  turn = 0,
): ReactNode {
  const r = tileRect(cells);
  if (!r) return null;
  const found = tilePictureFor(theme, key, r.w, r.h);
  if (!found) return null;
  const { picture, turned } = found;
  // the box the picture has before it is turned: its own width and height in squares
  const [pw, ph] = picture.cells;
  const cx = (r.x + r.w / 2) * size;
  const cy = (r.y + r.h / 2) * size;
  const box = tuned(cx, cy, pw * size, ph * size, size, picture);
  const mx = box.x + box.width / 2;
  const my = box.y + box.height / 2;
  const angle = (turned ? 90 : 0) + turn;
  return (
    <image
      href={picture.href}
      {...box}
      preserveAspectRatio="none"
      transform={angle ? `rotate(${angle} ${mx} ${my})` : undefined}
      data-themed="tile"
      data-tile-picture={key}
    />
  );
}

/**
 * The ice slide picture along its squares: a straight run (the picture is `cells` long), with the
 * picture's arrow, which points down, turned to the way the slide goes. Null when the path is not
 * a straight run of the picture's length.
 */
export function slidePiece(theme: Theme, path: readonly Sq[], size: number): ReactNode {
  const first = path[0];
  const last = path[path.length - 1];
  if (!first || !last) return null;
  const dx = Math.sign(last[0] - first[0]);
  const dy = Math.sign(last[1] - first[1]);
  const straight =
    (dx === 0) !== (dy === 0) &&
    path.every((c, i) => c[0] === first[0] + dx * i && c[1] === first[1] + dy * i);
  if (!straight) return null;
  // down is 0 degrees; clockwise from there: left 90, up 180, right 270
  const angle = dy > 0 ? 0 : dx < 0 ? 90 : dy < 0 ? 180 : 270;
  const found = tilePictureFor(
    theme,
    'iceSlide',
    dx === 0 ? 1 : path.length,
    dx === 0 ? path.length : 1,
  );
  if (!found) return null;
  const { picture } = found;
  const [pw, ph] = picture.cells;
  if (Math.max(pw, ph) !== path.length) return null;
  const cx = ((first[0] + last[0]) / 2 + 0.5) * size;
  const cy = ((first[1] + last[1]) / 2 + 0.5) * size;
  const box = tuned(cx, cy, pw * size, ph * size, size, picture);
  const mx = box.x + box.width / 2;
  const my = box.y + box.height / 2;
  return (
    <image
      href={picture.href}
      {...box}
      preserveAspectRatio="none"
      transform={angle ? `rotate(${angle} ${mx} ${my})` : undefined}
      data-themed="tile"
      data-tile-picture="iceSlide"
    />
  );
}

/** One end of an ice tunnel at square (x, y): the picture of its design, or null (the drawn look). */
export function tunnelPiece(
  theme: Theme,
  design: number,
  x: number,
  y: number,
  size: number,
): ReactNode {
  const key = String(design) as TunnelDesign;
  const href = theme.tunnel?.[key];
  if (!href) return null;
  return (
    <image
      href={href}
      {...tuned((x + 0.5) * size, (y + 0.5) * size, size, size, size, theme.tune?.tunnel?.[key])}
      preserveAspectRatio="xMidYMid meet"
      data-themed="tunnel"
    />
  );
}

/**
 * A door in the outer wall of the board: the picture of its kind with the door on the wall line and the
 * arrow just outside it, turned so its arrow points into the board for the entry and out of it for the exit. (dx, dy) points
 * from outside into the board. Null for the drawn look.
 */
export function edgeDoorPiece(
  theme: Theme,
  kind: EdgeDoorSlot,
  open: boolean,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
  size: number,
): ReactNode {
  const href = theme.edgeDoor?.[kind];
  if (!href) return null;
  // The pictures are drawn with the arrow pointing right. The wooden exit picture has the door on the
  // left and its arrow pointing away from it. The iron entry picture has the arrow on the left pointing
  // at the door on the right: its arrow is mirrored in place so that it points away from the door too.
  // Turned, the door half lies inside the board and the arrow half outside, pointing out of the board.
  const iron = kind === 'ironEntry';
  const ax = iron ? dx : -dx;
  const ay = iron ? dy : -dy;
  const angle = (Math.atan2(ay, ax) * 180) / Math.PI;
  // the picture has the arrow in one half and the door in the other half. The door half is centred on
  // the wall line, so the picture centre is a quarter of a square outside the wall and the arrow
  // lies just outside the board
  const mx = cx - dx * size * 0.25;
  const my = cy - dy * size * 0.25;
  const box = tuned(mx, my, size, size, size, theme.tune?.edgeDoor?.[kind]);
  const turn = angle
    ? `rotate(${angle} ${box.x + box.width / 2} ${box.y + box.height / 2})`
    : undefined;
  if (!iron)
    return (
      <image
        href={href}
        {...box}
        preserveAspectRatio="xMidYMid meet"
        transform={turn}
        opacity={open ? 0.45 : 1}
        data-themed="edge-door"
      />
    );
  // iron entry: the door half as it is, and the arrow half mirrored about its own middle
  const half = box.width / 2;
  const id = `edge-clip-${Math.round(cx)}-${Math.round(cy)}`;
  return (
    <g transform={turn} opacity={open ? 0.45 : 1}>
      <clipPath id={`${id}-door`}>
        <rect x={box.x + half} y={box.y} width={half} height={box.height} />
      </clipPath>
      <clipPath id={`${id}-arrow`}>
        <rect x={box.x} y={box.y} width={half} height={box.height} />
      </clipPath>
      <image
        href={href}
        {...box}
        preserveAspectRatio="xMidYMid meet"
        clipPath={`url(#${id}-door)`}
        data-themed="edge-door"
      />
      <image
        href={href}
        {...box}
        preserveAspectRatio="xMidYMid meet"
        clipPath={`url(#${id}-arrow)`}
        transform={`translate(${2 * (box.x + half / 2)} 0) scale(-1 1)`}
        data-themed="edge-door-arrow"
      />
    </g>
  );
}

/**
 * A block of two squares side by side as one picture, or null for the built-in drawing (and for
 * anything that is not two squares side by side). Turned when the two squares stand one above the other.
 */
export function blockPiece(
  theme: Theme,
  cells: readonly (readonly [number, number])[],
  size: number,
  key: string,
): ReactNode {
  const a = cells[0];
  const b = cells[1];
  if (a && b && cells.length === 2 && Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1) {
    if (!theme.block?.double) return null;
    const vertical = a[0] === b[0];
    const mx = (Math.min(a[0], b[0]) + (vertical ? 0.5 : 1)) * size;
    const my = (Math.min(a[1], b[1]) + (vertical ? 1 : 0.5)) * size;
    return (
      <image
        key={key}
        href={theme.block.double}
        {...tuned(mx, my, 2 * size, size, size, theme.tune?.block?.double)}
        preserveAspectRatio="xMidYMid meet"
        transform={vertical ? `rotate(90 ${mx} ${my})` : undefined}
        data-themed="block2"
      />
    );
  }
  return null;
}
