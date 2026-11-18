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
