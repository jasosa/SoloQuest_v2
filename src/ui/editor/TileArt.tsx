/**
 * The drawings the editor map makes of the Frozen Horror board features: board tiles, room tiles,
 * ice tunnel ends and exterior doors. They follow the play board (DESIGN.md, "Frozen Horror look"
 * and "Edge doors") so the author sees what the players will see. Pure drawing: no state.
 */
import type { ReactNode } from 'react';
import { BOARD_TILES, ROOM_TILES, type RoomTileType } from '../../engine/data/roomTiles';
import type { Quest } from '../../engine/quest/schema';
import { color } from '../shared/tokens';

type Cell = readonly [number, number];
type Tile = Quest['boardTiles'][number];

/** The text on a tile: its name in capitals. */
function label(t: Tile): string {
  return BOARD_TILES[t.type].name.toUpperCase();
}

const SEL_RING = (x: number, y: number, w: number, h: number) => (
  <rect x={x - 2} y={y - 2} width={w + 4} height={h + 4} fill={color.sel} className="selring" />
);

/** A flag label at the bottom left of a tile that goes away (or blocks) with a flag. */
function FlagTag({ t, U }: { t: Tile; U: number }): ReactNode {
  if (!t.hiddenWhen) return null;
  const xs = t.cells.map((c) => c[0]);
  const ys = t.cells.map((c) => c[1]);
  const c: Cell = [Math.min(...xs), Math.max(...ys)];
  const text = `${t.blocks ? 'blocks, ' : ''}gone when ${t.hiddenWhen}`;
  const w = Math.min(text.length * 4.6 + 8, U * 4);
  return (
    <g pointerEvents="none" data-tile-flag={t.hiddenWhen}>
      <rect x={c[0] * U + 2} y={(c[1] + 1) * U - 15} width={w} height={13} fill={color.ink} />
      <text
        x={c[0] * U + 6}
        y={(c[1] + 1) * U - 5.5}
        fill={color.tokenText}
        fontFamily="Bonum"
        fontWeight={700}
        fontSize={9}
      >
        {text}
      </text>
    </g>
  );
}

export function BoardTileArt({
  tile,
  index,
  selected,
  U,
}: {
  tile: Tile;
  index: number;
  selected: boolean;
  U: number;
}) {
  const def = BOARD_TILES[tile.type];
  const xs = tile.cells.map((c) => c[0]);
  const ys = tile.cells.map((c) => c[1]);
  const x0 = Math.min(...xs) * U;
  const y0 = Math.min(...ys) * U;
  const w = (Math.max(...xs) + 1) * U - x0;
  const h = (Math.max(...ys) + 1) * U - y0;
  const ring = selected
    ? tile.cells.map((c) => (
        <rect
          key={`${c[0]},${c[1]}`}
          x={c[0] * U}
          y={c[1] * U}
          width={U}
          height={U}
          fill={color.sel}
          className="selring"
        />
      ))
    : null;

  if (tile.type === 'icyRiver' || tile.type === 'iceLedge' || tile.type === 'chasm') {
    return (
      <g data-board-tile={tile.type} data-tile-index={index}>
        {ring}
        {tile.cells.map(([cx, cy]) => {
          const px = cx * U;
          const py = cy * U;
          return (
            <g key={`${cx},${cy}`} pointerEvents="none">
              <rect
                x={px + 2}
                y={py + 2}
                width={U - 4}
                height={U - 4}
                fill={tile.type === 'chasm' ? 'var(--pit)' : 'var(--ice)'}
                fillOpacity={tile.type === 'chasm' ? 0.85 : tile.type === 'icyRiver' ? 0.4 : 0.18}
                stroke={tile.type === 'chasm' ? color.ink : 'var(--ice)'}
                strokeWidth={tile.type === 'iceLedge' ? 2 : 1}
                strokeDasharray={tile.type === 'iceLedge' ? '5 3' : undefined}
              />
              {tile.type === 'icyRiver' &&
                [-5, 5].map((dy) => (
                  <path
                    key={dy}
                    d={`M${px + 6} ${py + U / 2 + dy} q4 -4 6 0 t6 0 t6 0`}
                    fill="none"
                    stroke="var(--ice)"
                    strokeWidth={1.6}
                    strokeLinecap="round"
                  />
                ))}
              {tile.type === 'chasm' && (
                <path
                  d={`M${px + 6} ${py + 9} l7 6 l-4 5 l9 5 l-3 4`}
                  fill="none"
                  stroke={color.tokenText}
                  strokeWidth={1.4}
                  opacity={0.7}
                />
              )}
            </g>
          );
        })}
        <text
          x={Math.min(...xs) * U + 4}
          y={Math.min(...ys) * U + 12}
          fill={color.ink}
          stroke={color.paper}
          strokeWidth={3}
          paintOrder="stroke"
          fontFamily="Bonum"
          fontWeight={700}
          fontSize={8}
          pointerEvents="none"
        >
          {label(tile)}
        </text>
        <FlagTag t={tile} U={U} />
      </g>
    );
  }

  const cage = tile.type === 'cage';
  const bars: ReactNode[] = [];
  if (cage)
    for (let bx = x0 + 7; bx < x0 + w - 3; bx += 9)
      bars.push(
        <line
          key={bx}
          x1={bx}
          y1={y0 + 3}
          x2={bx}
          y2={y0 + h - 3}
          stroke={color.ink}
          strokeWidth={1.6}
          opacity={0.55}
        />,
      );
  return (
    <g data-board-tile={tile.type} data-tile-index={index}>
      {selected && SEL_RING(x0, y0, w, h)}
      <rect
        x={x0 + 2}
        y={y0 + 2}
        width={w - 4}
        height={h - 4}
        fill={cage ? 'none' : 'var(--ice)'}
        fillOpacity={cage ? 0 : 0.3}
        stroke={cage ? color.ink : 'var(--ice)'}
        strokeWidth={cage ? 3 : 2.5}
        strokeDasharray={cage ? undefined : '7 4'}
        pointerEvents="none"
      />
      {bars}
      <text
        x={x0 + w / 2}
        y={y0 + h / 2 + 4}
        textAnchor="middle"
        fill={color.ink}
        stroke={color.paper}
        strokeWidth={3}
        paintOrder="stroke"
        fontFamily="Bonum"
        fontWeight={700}
        fontSize={def.shape === 'fixed' && w < U * 3 ? 8 : 12}
        letterSpacing={1}
        pointerEvents="none"
      >
        {label(tile)}
      </text>
      <FlagTag t={tile} U={U} />
    </g>
  );
}

/** A room tile: a dashed outline round every square of the tile and the tile's name. */
export function RoomTileArt({
  type,
  index,
  cells,
  selected,
  U,
}: {
  type: RoomTileType;
  index: number;
  cells: readonly Cell[];
  selected: boolean;
  U: number;
}) {
  const mx = cells.reduce((a, c) => a + c[0], 0) / cells.length;
  const my = cells.reduce((a, c) => a + c[1], 0) / cells.length;
  const mid = cells.reduce((best, c) =>
    Math.hypot(c[0] - mx, c[1] - my) < Math.hypot(best[0] - mx, best[1] - my) ? c : best,
  );
  return (
    <g data-room-tile={type} data-room-tile-index={index}>
      {cells.map(([cx, cy]) => (
        <g key={`${cx},${cy}`} pointerEvents="none">
          {selected && (
            <rect x={cx * U} y={cy * U} width={U} height={U} fill={color.sel} className="selring" />
          )}
          <rect
            x={cx * U + 2}
            y={cy * U + 2}
            width={U - 4}
            height={U - 4}
            fill="var(--ice)"
            fillOpacity={0.12}
            stroke="var(--ice)"
            strokeWidth={1.5}
            strokeDasharray="5 3"
          />
        </g>
      ))}
      <text
        x={(mid[0] + 0.5) * U}
        y={(mid[1] + 0.5) * U + 3}
        textAnchor="middle"
        fill={color.ink}
        stroke={color.paper}
        strokeWidth={3}
        paintOrder="stroke"
        fontFamily="Bonum"
        fontWeight={700}
        fontSize={8}
        letterSpacing={0.3}
        pointerEvents="none"
      >
        {ROOM_TILES[type].name.toUpperCase()}
      </text>
    </g>
  );
}

/** One end of an ice tunnel: a rounded `--ice` square with a dashed ring and the design number. */
export function TunnelEndArt({
  tunnel,
  end,
  design,
  cell,
  selected,
  U,
}: {
  tunnel: string;
  end: 'a' | 'b';
  design: number;
  cell: Cell;
  selected: boolean;
  U: number;
}) {
  const cx = (cell[0] + 0.5) * U;
  const cy = (cell[1] + 0.5) * U;
  return (
    <g data-tunnel={`${tunnel}:${end}`} data-design={design}>
      {selected && <circle cx={cx} cy={cy} r={19} fill={color.sel} className="selring" />}
      <rect
        x={cell[0] * U + 3}
        y={cell[1] * U + 3}
        width={U - 6}
        height={U - 6}
        rx={5}
        fill="var(--ice)"
        stroke={color.ink}
        strokeWidth={1.5}
      />
      <ellipse
        cx={cx}
        cy={cy}
        rx={9.5}
        ry={6.5}
        transform={`rotate(-30 ${cx} ${cy})`}
        fill="none"
        stroke={color.tokenText}
        strokeWidth={1.4}
        strokeDasharray="3 2"
      />
      <text
        x={cx}
        y={cy + 4.5}
        textAnchor="middle"
        fill={color.tokenText}
        fontFamily="Bonum"
        fontWeight={700}
        fontSize={13}
      >
        {design}
      </text>
      <text
        x={cell[0] * U + U - 5}
        y={cell[1] * U + 11}
        textAnchor="end"
        fill={color.tokenText}
        fontFamily="Bonum"
        fontWeight={700}
        fontSize={8}
      >
        {end.toUpperCase()}
      </text>
    </g>
  );
}

const SIDE_VECTOR = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] } as const;

/**
 * An exterior door on the outer edge of a square: iron entry (ink slab, white arrow into the
 * board) or wooden exit (white slab, ink arrow out). `start` rings the door the heroes start at.
 */
export function ExteriorDoorArt({
  id,
  cell,
  side,
  kind,
  selected,
  start,
  U,
}: {
  id: string;
  cell: Cell;
  side: 'n' | 'e' | 's' | 'w';
  kind: 'ironEntry' | 'woodenExit';
  selected: boolean;
  start: boolean;
  U: number;
}) {
  const [vx, vy] = SIDE_VECTOR[side];
  // the middle of the edge, moved 6 px into the board so the slab stays inside the picture
  const ex = (cell[0] + 0.5 + vx * 0.5) * U - vx * 6;
  const ey = (cell[1] + 0.5 + vy * 0.5) * U - vy * 6;
  const horizontal = vy !== 0;
  const w = horizontal ? 26 : 10;
  const h = horizontal ? 10 : 26;
  const iron = kind === 'ironEntry';
  // arrow direction: into the board for the entry, out of it for the exit
  const dir = iron ? -1 : 1;
  const ax = vx * dir;
  const ay = vy * dir;
  const tip: [number, number] = [ex + ax * 4, ey + ay * 4];
  const base1: [number, number] = [ex - ax * 3 + ay * 4, ey - ay * 3 + ax * 4];
  const base2: [number, number] = [ex - ax * 3 - ay * 4, ey - ay * 3 - ax * 4];
  return (
    <g data-edge-door={id} data-edge-kind={kind}>
      {(selected || start) && (
        <circle
          cx={ex}
          cy={ey}
          r={selected ? 21 : 19}
          fill={selected ? color.sel : 'none'}
          stroke={start ? color.ink : 'none'}
          strokeWidth={start ? 2.5 : 0}
          strokeDasharray={start ? '4 3' : undefined}
          className={selected ? 'selring' : undefined}
        />
      )}
      <rect
        x={ex - w / 2}
        y={ey - h / 2}
        width={w}
        height={h}
        fill={iron ? color.ink : color.white}
        stroke={color.ink}
        strokeWidth={1.6}
      />
      <polygon
        points={`${tip.join(',')} ${base1.join(',')} ${base2.join(',')}`}
        fill={iron ? color.white : color.ink}
      />
    </g>
  );
}
