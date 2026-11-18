import type { Board } from '../../engine/board/board';
import type { FurnitureDef } from '../../engine/quest/schema';
import { CELL } from './BoardView';
import { color } from '../shared/tokens';
import { useTheme } from '../theme/activeTheme';
import { cornerTurn, needsTurn } from '../theme/theme';

const S = CELL;
const INK = color.ink;
const WHITE = color.white;

/** Furniture footprint as simple line art (ported from the prototype). Rooms are never partly drawn. */
/** `board` is only needed for a themed corner piece (stairs): it says which room corner it is in. */
export function Furniture({ f, board }: { f: FurnitureDef; board?: Board | undefined }) {
  const slot = useTheme().furniture?.[f.type];
  const xs = f.cells.map((c) => c[0]);
  const ys = f.cells.map((c) => c[1]);
  const cx0 = Math.min(...xs);
  const cy0 = Math.min(...ys);
  const w = (Math.max(...xs) - cx0 + 1) * S;
  const h = (Math.max(...ys) - cy0 + 1) * S;
  const x = cx0 * S;
  const y = cy0 * S;

  // A theme picture replaces the line art (decision 78); turned by 90 degrees when the piece stands the other way.
  if (slot) {
    // `f.turn` is the quarter turns made in the editor. The picture first fits the shape the piece
    // was placed with (the footprint before those turns), then turns with them. Stairs also
    // follow their room corner, and the editor turns add to that.
    const quarters = f.turn ?? 0;
    const odd = quarters % 2 === 1;
    const placedW = (odd ? h : w) / S;
    const placedH = (odd ? w : h) / S;
    const base =
      slot.corner && board
        ? cornerTurn(board, f.cells, slot.corner)
        : needsTurn(slot, placedW, placedH)
          ? 90
          : 0;
    const degrees = (base + 90 * quarters) % 360;
    const sideways = degrees === 90 || degrees === 270;
    const fit = slot.scale ?? 1;
    const pw = (sideways && !slot.corner ? h : w) * fit;
    const ph = (sideways && !slot.corner ? w : h) * fit;
    // the pack may move the picture a little (offset, in squares, on the screen)
    const mx = x + w / 2 + (slot.offset?.[0] ?? 0) * S;
    const my = y + h / 2 + (slot.offset?.[1] ?? 0) * S;
    return (
      <image
        href={slot.href}
        x={mx - pw / 2}
        y={my - ph / 2}
        width={pw}
        height={ph}
        preserveAspectRatio="xMidYMid meet"
        transform={degrees ? `rotate(${degrees} ${mx} ${my})` : undefined}
        data-themed="furniture"
      />
    );
  }

  if (f.type === 'stairs') {
    const n = Math.round(Math.min(w, h) / 10.5);
    const step = (Math.min(w, h) - 4) / Math.max(1, n);
    return (
      <g>
        <rect
          x={x + 2}
          y={y + 2}
          width={w - 4}
          height={h - 4}
          fill={WHITE}
          stroke={INK}
          strokeWidth={1.5}
        />
        {Array.from({ length: n - 1 }, (_, i) => {
          const r = (i + 1) * step;
          return (
            <path
              key={i}
              d={`M ${x + 2} ${y + 2 + r} A ${r} ${r} 0 0 0 ${x + 2 + r} ${y + 2}`}
              fill="none"
              stroke={INK}
              strokeWidth={1.2}
            />
          );
        })}
      </g>
    );
  }
  if (f.type === 'chest') {
    return (
      <g>
        <rect
          x={x + 6}
          y={y + 8}
          width={w - 12}
          height={h - 16}
          fill={WHITE}
          stroke={INK}
          strokeWidth={1.5}
        />
        <line x1={x + 6} y1={y + 14} x2={x + w - 6} y2={y + 14} stroke={INK} strokeWidth={1} />
      </g>
    );
  }

  const lines: React.ReactNode[] = [];
  if (f.type === 'rack' || f.type === 'weaponsRack') {
    const n = (Math.max(w, h) / S) * 2;
    for (let i = 1; i < n; i++)
      lines.push(
        h > w ? (
          <line
            key={i}
            x1={x + 8}
            y1={y + 4 + (i * (h - 8)) / n}
            x2={x + w - 8}
            y2={y + 4 + (i * (h - 8)) / n}
            stroke={INK}
            strokeWidth={0.9}
          />
        ) : (
          <line
            key={i}
            x1={x + 4 + (i * (w - 8)) / n}
            y1={y + 8}
            x2={x + 4 + (i * (w - 8)) / n}
            y2={y + h - 8}
            stroke={INK}
            strokeWidth={0.9}
          />
        ),
      );
  } else if (f.type === 'bookcase') {
    for (let i = 1; i < 9; i++)
      lines.push(
        <line
          key={i}
          x1={x + 4 + (i * (w - 8)) / 9}
          y1={y + 8}
          x2={x + 4 + (i * (w - 8)) / 9}
          y2={y + h - 8}
          stroke={INK}
          strokeWidth={0.9}
        />,
      );
  } else if (f.type === 'tomb') {
    lines.push(
      <rect
        key="in"
        x={x + 9}
        y={y + 9}
        width={w - 18}
        height={h - 18}
        fill="none"
        stroke={INK}
        strokeWidth={0.8}
      />,
      <line
        key="v"
        x1={x + w / 2}
        y1={y + 14}
        x2={x + w / 2}
        y2={y + h - 14}
        stroke={INK}
        strokeWidth={0.9}
      />,
      <line
        key="h"
        x1={x + w / 2 - 8}
        y1={y + 24}
        x2={x + w / 2 + 8}
        y2={y + 24}
        stroke={INK}
        strokeWidth={0.9}
      />,
    );
  } else {
    lines.push(
      <rect
        key="in"
        x={x + 8}
        y={y + 8}
        width={w - 16}
        height={h - 16}
        fill="none"
        stroke={INK}
        strokeWidth={0.8}
      />,
    );
  }
  return (
    <g>
      <rect
        x={x + 4}
        y={y + 4}
        width={w - 8}
        height={h - 8}
        fill={WHITE}
        stroke={INK}
        strokeWidth={1.5}
      />
      {lines}
    </g>
  );
}
