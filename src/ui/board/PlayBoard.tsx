import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { areaAt, isWallBetween, type Cell } from '../../engine/board/board';
import { cellKey, keyOf, parseKey, type Level } from '../../engine/board/level';
import { lookHintCells } from '../../engine/game/hints';
import type { GameState } from '../../engine/game/state';
import { MONSTER_NAMES } from '../../engine/data/monsters';
import { chestsInView, monstersInPlay, trapsInView } from '../../engine/game/view';
import type { Selection } from '../play/selection';
import { color } from '../shared/tokens';
import type { Fx } from '../store/gameStore';
import { CELL as S } from './BoardView';
import { Furniture } from './Furniture';

const EDGES = [
  [0, -1, 0, 0, 1, 0],
  [1, 0, 1, 0, 1, 1],
  [0, 1, 0, 1, 1, 1],
  [-1, 0, 0, 0, 0, 1],
] as const;

export const reducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Keyboard and screen reader access for a tap area: button role, focusable, Enter or Space. */
function press(label: string, onPress: () => void) {
  return {
    role: 'button' as const,
    tabIndex: 0,
    'aria-label': label,
    onClick: onPress,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onPress();
      }
    },
  };
}

export interface PlayBoardProps {
  level: Level;
  state: GameState;
  fx: Fx | null;
  codes: ReadonlyMap<string, string>;
  selection: Selection | null;
  onSelect(sel: Selection): void;
}

/** The ink wash: a growing white circle in a mask, from the door (650 ms, ease-out). */
function InkCircle({ fx, maxR }: { fx: Fx; maxR: number }) {
  const ref = useRef<SVGCircleElement>(null);
  useEffect(() => {
    const circle = ref.current;
    if (!circle) return;
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / 650);
      circle.setAttribute('r', String((1 - Math.pow(1 - p, 3)) * maxR));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [fx, maxR]);
  return <circle ref={ref} cx={fx.origin[0] * S} cy={fx.origin[1] * S} r={0} fill="white" />;
}

export function PlayBoard({ level, state, fx, codes, selection, onSelect }: PlayBoardProps) {
  const { board } = level;
  const W = board.width;
  const H = board.height;

  const ink = fx !== null && fx.cells.size > 0 && !reducedMotion() ? fx : null;
  const fresh = (k: string) => ink !== null && ink.cells.has(k);

  const blockCells = useMemo(() => {
    const s = new Set<string>();
    for (const b of level.blocks)
      if (state.seenBlocks.has(b.id)) for (const c of b.cells) s.add(keyOf(c));
    return s;
  }, [level, state.seenBlocks]);
  const drawn = (x: number, y: number) =>
    state.seenCells.has(cellKey(x, y)) || blockCells.has(cellKey(x, y));
  const traps = useMemo(() => trapsInView(level, state), [level, state]);
  const trapAt = new Map<string, string>();
  for (const t of traps) if (t.onMap && !t.block) trapAt.set(keyOf(t.cell), t.id);

  const monsters = useMemo(() => monstersInPlay(level, state), [level, state]);
  const hints = useMemo(() => lookHintCells(level, state), [level, state]);
  const monsterAt = new Map<string, string>();
  for (const m of level.quest.monsters)
    if (m.cell && state.seenMonsters.has(m.id)) monsterAt.set(keyOf(m.cell), m.id);

  // Everything that belongs to the board floor, split into "old" and "fresh" (inside the ink mask).
  const layers = { old: [] as ReactNode[], neu: [] as ReactNode[] };
  const into = (isFresh: boolean) => (isFresh ? layers.neu : layers.old);

  const floors = { old: [] as ReactNode[], neu: [] as ReactNode[] };
  const walls = { old: [] as ReactNode[], neu: [] as ReactNode[] };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!drawn(x, y)) continue;
      const k = cellKey(x, y);
      const f = fresh(k);
      const corridor = areaAt(board, x, y) === 'C';
      (f ? floors.neu : floors.old).push(
        <rect
          key={`f${k}`}
          x={x * S}
          y={y * S}
          width={S}
          height={S}
          fill={corridor ? color.corridor : color.floor}
          stroke={color.cellLine}
          strokeWidth={0.8}
        />,
      );
      for (const [dx, dy, ax, ay, bx, by] of EDGES) {
        const nx = x + dx;
        const ny = y + dy;
        if (!isWallBetween(board, [x, y], [nx, ny]) && !level.rock.has(cellKey(nx, ny))) continue;
        (f ? walls.neu : walls.old).push(
          <line
            key={`w${k},${dx},${dy}`}
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

  // Blocked squares that were seen.
  const blockList: Cell[] = [];
  for (const b of level.blocks) if (state.seenBlocks.has(b.id)) blockList.push(...b.cells);
  for (const k of state.placedBlocks) blockList.push(parseKey(k)); // falling block traps
  {
    for (const [x, y] of blockList) {
      const f = fresh(cellKey(x, y));
      const px = x * S;
      const py = y * S;
      const q = (S - 4) / 4;
      into(f).push(
        <g key={`b${x},${y}`} data-block={`${x},${y}`}>
          <rect
            x={px + 2}
            y={py + 2}
            width={S - 4}
            height={S - 4}
            fill={color.white}
            stroke={color.ink}
            strokeWidth={1.5}
          />
          {[1, 2, 3].map((i) => (
            <line
              key={i}
              x1={px + 2}
              y1={py + 2 + i * q}
              x2={px + S - 2}
              y2={py + 2 + i * q}
              stroke={color.ink}
              strokeWidth={1}
            />
          ))}
          <line
            x1={px + S / 2}
            y1={py + 2}
            x2={px + S / 2}
            y2={py + 2 + q}
            stroke={color.ink}
            strokeWidth={1}
          />
          <line
            x1={px + S / 3}
            y1={py + 2 + q}
            x2={px + S / 3}
            y2={py + 2 + 2 * q}
            stroke={color.ink}
            strokeWidth={1}
          />
        </g>,
      );
    }
  }

  // Furniture of revealed rooms.
  for (const f of level.quest.furniture) {
    if (!state.seenFurniture.has(f.id)) continue;
    const first = f.cells[0];
    into(first !== undefined && fresh(keyOf(first))).push(<Furniture key={`u${f.id}`} f={f} />);
  }

  // Doors (seen only). Closed doors get a 44 px tap target, drawn last.
  const doorHits: ReactNode[] = [];
  for (const id of state.seenDoors) {
    const d = level.doors.get(id);
    if (!d) continue;
    const vertical = d.a[1] === d.b[1];
    const ex = vertical ? Math.max(d.a[0], d.b[0]) : d.a[0];
    const ey = vertical ? d.a[1] : Math.max(d.a[1], d.b[1]);
    const cx = (vertical ? ex : ex + 0.5) * S;
    const cy = (vertical ? ey + 0.5 : ey) * S;
    const w = vertical ? 10 : 24;
    const h = vertical ? 24 : 10;
    const open = state.openDoors.has(id);
    const isFresh = fresh(keyOf(d.a)) || fresh(keyOf(d.b));
    const selected = selection?.kind === 'door' && selection.id === id;
    into(isFresh).push(
      <g key={`d${id}`}>
        {selected && <circle cx={cx} cy={cy} r={20} fill={color.sel} className="selring" />}
        <rect
          x={cx - w / 2}
          y={cy - h / 2}
          width={w}
          height={h}
          fill={open ? color.floor : color.white}
          stroke={color.ink}
          strokeWidth={1.6}
        />
        {open ? (
          <line
            x1={cx - (vertical ? 0 : 7)}
            y1={cy - (vertical ? 7 : 0)}
            x2={cx + (vertical ? 0 : 7)}
            y2={cy + (vertical ? 7 : 0)}
            stroke={color.ink}
            strokeWidth={1}
            strokeDasharray="2 2"
          />
        ) : (
          <line
            x1={cx - (vertical ? 0 : 6)}
            y1={cy - (vertical ? 6 : 0)}
            x2={cx + (vertical ? 0 : 6)}
            y2={cy + (vertical ? 6 : 0)}
            stroke={color.ink}
            strokeWidth={2.2}
          />
        )}
      </g>,
    );
    if (!open)
      doorHits.push(
        <rect
          key={`h${id}`}
          className="hit"
          data-hit
          data-door={id}
          x={cx - 22}
          y={cy - 22}
          width={44}
          height={44}
          {...press('Closed door', () => onSelect({ kind: 'door', id }))}
        />,
      );
  }

  // Tap areas of seen squares: corridor squares ("Look from here, search for secret doors") and
  // room squares (searches). Doors, tokens and traps sit on top of these.
  const cellHits: ReactNode[] = [];
  const roomSeen = new Set<string>();
  for (const k of state.seenCells) {
    const [x, y] = parseKey(k);
    if (monsterAt.has(k) || trapAt.has(k) || state.placedBlocks.has(k)) continue;
    const area = areaAt(board, x, y);
    if (area === undefined) continue;
    const common = { className: 'hit', 'data-hit': true, x: x * S, y: y * S, width: S, height: S };
    if (area === 'C') {
      cellHits.push(
        <rect
          key={`c${k}`}
          data-cell={k}
          {...common}
          {...press('Corridor square', () => onSelect({ kind: 'cell', at: [x, y] }))}
        />,
      );
    } else {
      // One keyboard stop per room; the other squares are still tappable.
      const first = !roomSeen.has(area);
      roomSeen.add(area);
      cellHits.push(
        <rect
          key={`r${k}`}
          data-room-cell={k}
          {...common}
          {...press(`Room ${area}`, () => onSelect({ kind: 'room', room: area }))}
          tabIndex={first ? 0 : -1}
        />,
      );
    }
  }

  // Chests: tappable (Search for traps). The hit area is the chest, at least 44 px.
  const chestHits: ReactNode[] = [];
  for (const c of chestsInView(level, state)) {
    const xs = c.cells.map((q) => q[0]);
    const ys = c.cells.map((q) => q[1]);
    const w = (Math.max(...xs) - Math.min(...xs) + 1) * S;
    const h = (Math.max(...ys) - Math.min(...ys) + 1) * S;
    const cx = Math.min(...xs) * S + w / 2;
    const cy = Math.min(...ys) * S + h / 2;
    const hw = Math.max(44, w);
    const hh = Math.max(44, h);
    chestHits.push(
      <rect
        key={`ch${c.id}`}
        className="hit"
        data-hit
        data-chest={c.id}
        x={cx - hw / 2}
        y={cy - hh / 2}
        width={hw}
        height={hh}
        {...press('Chest', () => onSelect({ kind: 'chest', id: c.id }))}
      />,
    );
  }

  // Traps: "?" while armed, a pit tile once a pit sprung, a block once a falling block fell.
  const trapHits: ReactNode[] = [];
  for (const t of traps) {
    if (!t.onMap || t.block) continue;
    const [tx, ty] = t.cell;
    const cx = (tx + 0.5) * S;
    const cy = (ty + 0.5) * S;
    const selected = selection?.kind === 'trap' && selection.id === t.id;
    into(fresh(keyOf(t.cell))).push(
      <g key={`t${t.id}`} data-trap-mark={t.id}>
        {selected && <circle cx={cx} cy={cy} r={19} fill={color.sel} className="selring" />}
        {t.state === 'sprung' ? (
          <>
            <rect
              x={tx * S + 3}
              y={ty * S + 3}
              width={S - 6}
              height={S - 6}
              fill={color.pit}
              stroke={color.ink}
              strokeWidth={1.5}
            />
            <rect
              x={tx * S + 8}
              y={ty * S + 8}
              width={S - 16}
              height={S - 16}
              fill={color.pitDeep}
            />
          </>
        ) : (
          <>
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
              ?
            </text>
          </>
        )}
      </g>,
    );
    trapHits.push(
      <rect
        key={`th${t.id}`}
        className="hit"
        data-hit
        data-trap={t.id}
        x={cx - 22}
        y={cy - 22}
        width={44}
        height={44}
        {...press(t.state === 'sprung' ? 'Pit' : 'Trap', () =>
          onSelect({ kind: 'trap', id: t.id }),
        )}
      />,
    );
  }

  // Monster tokens.
  const freshOrder = fx?.freshMonsters ?? [];
  const tokens: ReactNode[] = [];
  const monsterHits: ReactNode[] = [];
  for (const m of monsters) {
    const def = level.quest.monsters.find((q) => q.id === m.id);
    if (!def?.cell || m.dead) continue;
    const [mx, my] = def.cell;
    const cx = (mx + 0.5) * S;
    const cy = (my + 0.5) * S;
    const selected = selection?.kind === 'monster' && selection.id === m.id;
    const stampIndex = freshOrder.indexOf(m.id);
    const hurt = m.maxBody > 1 && m.body < m.maxBody;
    tokens.push(
      <g key={`m${m.id}`}>
        {selected && <circle cx={cx} cy={cy} r={19} fill={color.sel} className="selring" />}
        <g
          className={'tok' + (stampIndex >= 0 ? ' stamp' : '')}
          style={stampIndex >= 0 ? { animationDelay: `${380 + 70 * stampIndex}ms` } : undefined}
        >
          <circle
            cx={cx}
            cy={cy}
            r={13.5}
            fill="var(--green)"
            stroke={color.tokenText}
            strokeWidth={2}
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
            {codes.get(m.id)}
          </text>
          {hurt && (
            <circle
              cx={cx + 11}
              cy={cy - 11}
              r={5}
              fill={color.ink}
              stroke={color.white}
              strokeWidth={1.2}
            />
          )}
        </g>
      </g>,
    );
    monsterHits.push(
      <rect
        key={`mh${m.id}`}
        className="hit"
        data-hit
        data-monster={m.id}
        x={cx - 22}
        y={cy - 22}
        width={44}
        height={44}
        {...press(`${codes.get(m.id)} ${MONSTER_NAMES[m.type]}`, () =>
          onSelect({ kind: 'monster', id: m.id }),
        )}
      />,
    );
  }

  // The eye glyph on squares where "Look from here" can show more.
  const eyes = hints
    .filter(([x, y]) => !monsterAt.has(cellKey(x, y)))
    .map(([x, y]) => {
      const cx = (x + 0.5) * S;
      const cy = (y + 0.5) * S;
      return (
        <g key={`e${x},${y}`} opacity={0.7} pointerEvents="none" data-eye={`${x},${y}`}>
          <path
            d={`M ${cx - 9} ${cy} Q ${cx} ${cy - 8} ${cx + 9} ${cy} Q ${cx} ${cy + 8} ${cx - 9} ${cy} Z`}
            fill="none"
            stroke={color.ink}
            strokeWidth={1.4}
          />
          <circle cx={cx} cy={cy} r={2.6} fill={color.ink} />
        </g>
      );
    });

  const selCell = selection?.kind === 'cell' ? selection.at : null;
  const selRoom: ReactNode[] = [];
  if (selection?.kind === 'room')
    for (const k of state.seenCells) {
      const [x, y] = parseKey(k);
      if (areaAt(board, x, y) === selection.room)
        selRoom.push(
          <rect
            key={`sr${k}`}
            x={x * S}
            y={y * S}
            width={S}
            height={S}
            fill={color.sel}
            opacity={0.35}
            pointerEvents="none"
          />,
        );
    }

  let maxR = 0;
  if (ink)
    for (const k of ink.cells) {
      const [x, y] = parseKey(k);
      maxR = Math.max(
        maxR,
        Math.hypot((x + 0.5) * S - ink.origin[0] * S, (y + 0.5) * S - ink.origin[1] * S),
      );
    }
  maxR += S;

  const grid: ReactNode[] = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      grid.push(
        <rect
          key={`g${x},${y}`}
          x={x * S}
          y={y * S}
          width={S}
          height={S}
          fill="none"
          stroke={color.rockLine}
          strokeWidth={0.6}
        />,
      );

  return (
    <svg
      id="board"
      role="group"
      aria-label="Quest board"
      width={W * S + 4}
      height={H * S + 4}
      viewBox={`-2 -2 ${W * S + 4} ${H * S + 4}`}
    >
      <defs>
        <pattern
          id="hatch"
          width={6}
          height={6}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width={6} height={6} fill={color.rock} />
          <line x1={0} y1={0} x2={0} y2={6} stroke={color.rockLine} strokeWidth={2} />
        </pattern>
        {ink && (
          <mask
            id="inkmask"
            maskUnits="userSpaceOnUse"
            x={-2}
            y={-2}
            width={W * S + 4}
            height={H * S + 4}
          >
            <rect x={-2} y={-2} width={W * S + 4} height={H * S + 4} fill="black" />
            <InkCircle key={ink.id} fx={ink} maxR={maxR} />
          </mask>
        )}
      </defs>
      <rect x={0} y={0} width={W * S} height={H * S} fill="url(#hatch)" />
      {grid}
      <g>
        {floors.old}
        {walls.old}
        {layers.old}
      </g>
      <g mask={ink ? 'url(#inkmask)' : undefined}>
        {floors.neu}
        {walls.neu}
        {layers.neu}
      </g>
      <rect
        x={0}
        y={0}
        width={W * S}
        height={H * S}
        fill="none"
        stroke={color.ink}
        strokeWidth={3}
      />
      {selCell && (
        <rect
          x={selCell[0] * S + 3}
          y={selCell[1] * S + 3}
          width={S - 6}
          height={S - 6}
          fill="none"
          stroke={color.ink}
          strokeWidth={2}
          strokeDasharray="4 3"
          className="selring"
        />
      )}
      {selRoom}
      {eyes}
      {tokens}
      {cellHits}
      {chestHits}
      {trapHits}
      {monsterHits}
      {doorHits}
    </svg>
  );
}
