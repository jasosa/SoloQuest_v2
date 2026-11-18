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
): ReactNode {
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
  open: boolean,
  cx: number,
  cy: number,
  vertical: boolean,
  size: number,
): ReactNode {
  const href = open ? theme.door?.open : theme.door?.closed;
  if (!href) return null;
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
      preserveAspectRatio="none"
      data-themed={kind}
    />
  );
}
