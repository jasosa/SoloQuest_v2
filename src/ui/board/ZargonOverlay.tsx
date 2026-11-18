/**
 * The Zargon view of a playtest: everything the heroes have not seen yet, drawn faint over the
 * fog. A pure view option. It reads the game state and draws, it dispatches nothing and the
 * game state does not change. Nothing here is tappable.
 */
import { areaAt, isWallBetween, type Cell } from '../../engine/board/board';
import { cellKey, type Level } from '../../engine/board/level';
import type { GameState } from '../../engine/game/state';
import { MONSTER_LETTER } from '../play/monsterCodes';
import { color } from '../shared/tokens';
import { CELL as S } from './BoardView';
import { useTheme } from '../theme/activeTheme';
import { floorCell } from '../theme/draw';
import { Furniture } from './Furniture';
import { hiddenView, type HiddenTrap } from './hiddenView';

const EDGES = [
  [0, -1, 0, 0, 1, 0],
  [1, 0, 1, 0, 1, 1],
  [0, 1, 0, 1, 1, 1],
  [-1, 0, 0, 0, 0, 1],
] as const;

const TRAP_LETTER: Record<HiddenTrap['kind'], string> = {
  pit: 'P',
  fallingBlock: 'F',
  spear: 'S',
  chest: 'C',
  scripted: '?',
};

export function ZargonOverlay({ level, state }: { level: Level; state: GameState }) {
  const theme = useTheme();
  const { board } = level;
  const hv = hiddenView(level, state);
  const floors: React.ReactNode[] = [];
  const walls: React.ReactNode[] = [];
  for (const [x, y] of hv.cells) {
    floors.push(floorCell(theme, x, y, S, areaAt(board, x, y) === 'C', `zf${x},${y}`));
    for (const [dx, dy, ax, ay, bx, by] of EDGES) {
      const nx = x + dx;
      const ny = y + dy;
      if (!isWallBetween(board, [x, y], [nx, ny]) && !level.rock.has(cellKey(nx, ny))) continue;
      walls.push(
        <line
          key={`zw${x},${y},${dx},${dy}`}
          x1={(x + ax) * S}
          y1={(y + ay) * S}
          x2={(x + bx) * S}
          y2={(y + by) * S}
          stroke={color.ink}
          strokeWidth={3.2}
          strokeLinecap="square"
        />,
      );
    }
  }

  const blocks = hv.blocks.flatMap((b) =>
    b.cells.map(([x, y]: Cell) => (
      <rect
        key={`zb${x},${y}`}
        x={x * S + 2}
        y={y * S + 2}
        width={S - 4}
        height={S - 4}
        fill={color.white}
        stroke={color.ink}
        strokeWidth={1.5}
      />
    )),
  );

  const doors = hv.doors.map((d) => {
    const vertical = d.a[1] === d.b[1];
    const ex = vertical ? Math.max(d.a[0], d.b[0]) : d.a[0];
    const ey = vertical ? d.a[1] : Math.max(d.a[1], d.b[1]);
    const cx = (vertical ? ex : ex + 0.5) * S;
    const cy = (vertical ? ey + 0.5 : ey) * S;
    const w = vertical ? 10 : 24;
    const h = vertical ? 24 : 10;
    return (
      <g key={`zd${d.id}`} data-zdoor={d.id} data-kind={d.kind}>
        <rect
          x={cx - w / 2}
          y={cy - h / 2}
          width={w}
          height={h}
          fill={color.white}
          stroke={color.ink}
          strokeWidth={1.6}
          strokeDasharray={d.kind === 'secret' ? '3 2' : undefined}
        />
        {d.kind === 'false' && (
          <path
            d={`M ${cx - 5} ${cy - 5} L ${cx + 5} ${cy + 5} M ${cx + 5} ${cy - 5} L ${cx - 5} ${cy + 5}`}
            stroke={color.ink}
            strokeWidth={1.6}
          />
        )}
      </g>
    );
  });

  const monsters = hv.monsters.map((m) => {
    const cx = (m.cell[0] + 0.5) * S;
    const cy = (m.cell[1] + 0.5) * S;
    return (
      <g key={`zm${m.id}`} data-zmonster={m.id}>
        <circle
          cx={cx}
          cy={cy}
          r={13.5}
          fill="var(--green)"
          stroke={color.tokenText}
          strokeWidth={2}
          strokeDasharray="3 2"
        />
        <text
          x={cx}
          y={cy + 4.2}
          textAnchor="middle"
          fill={color.tokenText}
          fontFamily="Bonum"
          fontWeight={700}
          fontSize={11.5}
        >
          {MONSTER_LETTER[m.type]}
        </text>
      </g>
    );
  });

  const traps = hv.traps.map((t) => {
    const cx = (t.cell[0] + 0.5) * S;
    const cy = (t.cell[1] + 0.5) * S;
    return (
      <g key={`zt${t.id}`} data-ztrap={t.id}>
        <polygon
          points={`${cx},${cy - 13} ${cx + 13},${cy + 10} ${cx - 13},${cy + 10}`}
          fill={color.white}
          stroke={color.ink}
          strokeWidth={1.8}
          strokeLinejoin="round"
        />
        <text
          x={cx}
          y={cy + 7}
          textAnchor="middle"
          fill={color.ink}
          fontFamily="Bonum"
          fontWeight={700}
          fontSize={14}
        >
          {TRAP_LETTER[t.kind]}
        </text>
      </g>
    );
  });

  const markers = hv.markers.map((m) => {
    const cx = (m.cell[0] + 0.5) * S;
    const cy = (m.cell[1] + 0.5) * S;
    return (
      <g key={`zk${m.id}`} data-zmarker={m.id}>
        <path
          d={`M ${cx} ${cy - 11} L ${cx + 11} ${cy} L ${cx} ${cy + 11} L ${cx - 11} ${cy} Z`}
          fill={color.ink}
          stroke={color.floor}
          strokeWidth={1.5}
        />
        <text
          x={cx}
          y={cy + 4.5}
          textAnchor="middle"
          fill={color.tokenText}
          fontFamily="Bonum"
          fontWeight={700}
          fontSize={12}
        >
          {m.label.slice(0, 1).toUpperCase()}
        </text>
      </g>
    );
  });

  return (
    <g data-zargon-view pointerEvents="none" opacity={0.7}>
      {floors}
      {walls}
      {blocks}
      {hv.furniture.map((f) => (
        <Furniture key={`zu${f.id}`} f={f} />
      ))}
      {doors}
      {traps}
      {markers}
      {monsters}
    </g>
  );
}
