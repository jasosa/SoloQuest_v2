import type { ReactNode } from 'react';
import { color } from '../shared/tokens';
import { tileFor, type Theme } from './theme';

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
  if (kind === 'secret') {
    // A secret door picture is about square (a slab on the wall line with its leaf swung up): its
    // bottom edge sits on the wall, and it is turned for a door in a vertical wall.
    return (
      <image
        href={href}
        x={cx - size / 2}
        y={cy - size + 5}
        width={size}
        height={size}
        preserveAspectRatio="xMidYMid meet"
        transform={vertical ? `rotate(90 ${cx} ${cy})` : undefined}
        data-themed="door"
      />
    );
  }
  return (
    <image
      href={href}
      x={cx - size / 2}
      y={cy - DOOR_THICK / 2}
      width={size}
      height={DOOR_THICK}
      preserveAspectRatio="none"
      transform={vertical ? `rotate(90 ${cx} ${cy})` : undefined}
      data-themed="door"
    />
  );
}

/** One square filled with a picture (blocks, traps), or null for the built-in drawing. */
export function squarePiece(
  href: string | undefined,
  x: number,
  y: number,
  size: number,
  kind: string,
): ReactNode {
  if (!href) return null;
  return (
    <image
      href={href}
      x={x * size}
      y={y * size}
      width={size}
      height={size}
      preserveAspectRatio="xMidYMid meet"
      data-themed={kind}
    />
  );
}

/**
 * A block of one or two squares as one picture, or null for the built-in drawing. Two squares
 * side by side use the `double` picture (turned when they stand one above the other).
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
    const x0 = Math.min(a[0], b[0]) * size;
    const y0 = Math.min(a[1], b[1]) * size;
    const w = (vertical ? 1 : 2) * size;
    const h = (vertical ? 2 : 1) * size;
    const mx = x0 + w / 2;
    const my = y0 + h / 2;
    return (
      <image
        key={key}
        href={theme.block.double}
        x={mx - size}
        y={my - size / 2}
        width={2 * size}
        height={size}
        preserveAspectRatio="xMidYMid meet"
        transform={vertical ? `rotate(90 ${mx} ${my})` : undefined}
        data-themed="block2"
      />
    );
  }
  return null;
}
