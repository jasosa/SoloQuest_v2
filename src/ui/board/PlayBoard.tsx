import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { areaAt, isWallBetween, type Cell } from '../../engine/board/board';
import { cellKey, keyOf, parseKey, type Level } from '../../engine/board/level';
import { lookHintCells } from '../../engine/game/hints';
import type { GameState } from '../../engine/game/state';
import { MONSTER_NAMES } from '../../engine/data/monsters';
import {
  chestsInView,
  dormantFigures,
  roomLabelAreas,
  mapLetters,
  monstersInPlay,
  squareMarkers,
  zoneLabels,
  trapsInView,
} from '../../engine/game/view';
import { monsterTip } from '../play/monsterTip';
import type { Selection } from '../play/selection';
import { color } from '../shared/tokens';
import type { Fx } from '../store/gameStore';
import { CELL as S } from './BoardView';
import { useTheme } from '../theme/activeTheme';
import { isThemeToken, monsterPicture } from '../theme/theme';
import {
  BoardArt,
  blockPiece,
  doorPiece,
  floorCell,
  RockPattern,
  squarePiece,
  wallSegment,
} from '../theme/draw';
import { ZargonOverlay } from './ZargonOverlay';
import { Furniture } from './Furniture';
import { furnitureName } from './furnitureNames';

const EDGES = [
  [0, -1, 0, 0, 1, 0],
  [1, 0, 1, 0, 1, 1],
  [0, 1, 0, 1, 1, 1],
  [-1, 0, 0, 0, 0, 1],
] as const;

export const reducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Keyboard and screen reader access for a tap area: button role, focusable, Enter or Space. */
/** The points of a five-pointed star centered at (cx, cy) with outer radius r. */
function starPoints(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.45;
    pts.push(`${(cx + rad * Math.cos(a)).toFixed(2)},${(cy + rad * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(' ');
}

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
  /** Tap on a quest note letter: read it again. */
  onLetter(note: string): void;
  /** Squares to point out (a monster to put there). */
  highlight?: readonly Cell[];
  /** While set, every square the heroes know is tappable and the tap goes here (adding a monster). */
  onPickCell?: (cell: Cell) => void;
  /** Playtest only: also draw everything the heroes have not seen (a view, not a game change). */
  zargonView?: boolean;
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

export function PlayBoard({
  level,
  state,
  fx,
  codes,
  selection,
  onSelect,
  onLetter,
  highlight = [],
  onPickCell,
  zargonView = false,
}: PlayBoardProps) {
  const theme = useTheme();
  const { board } = level;
  const W = board.width;
  const H = board.height;

  // The name label of the furniture under the pointer or keyboard focus.
  const [hoverF, setHoverF] = useState<string | null>(null);
  const hoverProps = (id: string) => ({
    onMouseEnter: () => setHoverF(id),
    onMouseLeave: () => setHoverF((h) => (h === id ? null : h)),
    onFocus: () => setHoverF(id),
    onBlur: () => setHoverF((h) => (h === id ? null : h)),
  });

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
  for (const m of monsters) if (m.cell && !m.dead) monsterAt.set(keyOf(m.cell), m.id);
  for (const m of level.quest.monsters)
    if (state.seenMonsters.has(m.id)) {
      const c = state.placedMonsterCells[m.id] ?? m.cell;
      if (c) monsterAt.set(keyOf(c), m.id);
    }

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
      (f ? floors.neu : floors.old).push(floorCell(theme, x, y, S, corridor, `f${k}`));
      for (const [dx, dy, ax, ay, bx, by] of EDGES) {
        const nx = x + dx;
        const ny = y + dy;
        if (!isWallBetween(board, [x, y], [nx, ny]) && !level.rock.has(cellKey(nx, ny))) continue;
        if (theme.board && isWallBetween(board, [x, y], [nx, ny])) continue; // already in the picture
        (f ? walls.neu : walls.old).push(
          wallSegment(
            theme,
            `w${k},${dx},${dy}`,
            (x + ax) * S,
            (y + ay) * S,
            (x + bx) * S,
            (y + by) * S,
          ),
        );
      }
    }

  // Blocked squares that were seen: a block of one or two squares, or a block a falling-block trap left.
  const blockGroups: { cells: readonly Cell[]; fallen: boolean }[] = [];
  for (const b of level.blocks)
    if (state.seenBlocks.has(b.id)) blockGroups.push({ cells: b.cells, fallen: false });
  for (const k of state.placedBlocks) blockGroups.push({ cells: [parseKey(k)], fallen: true });
  for (const g of blockGroups) {
    const first = g.cells[0];
    if (!first) continue;
    const together = g.fallen ? null : blockPiece(theme, g.cells, S, `bb${first[0]},${first[1]}`);
    if (together) {
      into(fresh(cellKey(first[0], first[1]))).push(
        <g key={`b${first[0]},${first[1]}`} data-block={`${first[0]},${first[1]}`}>
          {together}
        </g>,
      );
      continue;
    }
    for (const [x, y] of g.cells) {
      const f = fresh(cellKey(x, y));
      const px = x * S;
      const py = y * S;
      const q = (S - 4) / 4;
      const href = g.fallen
        ? (theme.trap?.fallingBlock ?? theme.block?.single)
        : theme.block?.single;
      into(f).push(
        <g key={`b${x},${y}`} data-block={`${x},${y}`}>
          {squarePiece(href, x, y, S, 'block') ?? (
            <>
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
            </>
          )}
        </g>,
      );
    }
  }

  // Furniture of revealed rooms.
  for (const f of level.quest.furniture) {
    if (!state.seenFurniture.has(f.id)) continue;
    const first = f.cells[0];
    into(first !== undefined && fresh(keyOf(first))).push(
      <Furniture key={`u${f.id}`} f={f} board={board} />,
    );
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
        {doorPiece(
          theme,
          // a found secret door keeps its own picture, closed or open
          d.kind === 'secret' && theme.door?.secret ? 'secret' : open ? 'open' : 'closed',
          cx,
          cy,
          vertical,
          S,
        ) ?? (
          <>
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
          </>
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

  // Furniture (not chests): tap opens the room note, headed by its name. Hover or focus shows the name.
  const furnitureHits: ReactNode[] = [];
  const bbox = (cells: readonly Cell[]) => {
    const xs = cells.map((q) => q[0]);
    const ys = cells.map((q) => q[1]);
    return {
      x: Math.min(...xs) * S,
      y: Math.min(...ys) * S,
      w: (Math.max(...xs) - Math.min(...xs) + 1) * S,
      h: (Math.max(...ys) - Math.min(...ys) + 1) * S,
    };
  };
  for (const f of level.quest.furniture) {
    if (f.type === 'chest' || !state.seenFurniture.has(f.id)) continue;
    const first = f.cells[0];
    const room = first ? areaAt(board, first[0], first[1]) : undefined;
    if (!first || room === undefined || room === 'C') continue;
    const b = bbox(f.cells);
    furnitureHits.push(
      <rect
        key={`fh${f.id}`}
        className="hit"
        data-hit
        data-furniture={f.id}
        x={b.x}
        y={b.y}
        width={b.w}
        height={b.h}
        {...press(furnitureName(f.type), () =>
          onSelect({ kind: 'room', room, furniture: f.type, furnitureId: f.id }),
        )}
        {...hoverProps(f.id)}
      />,
    );
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
        {...hoverProps(c.id)}
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
        {squarePiece(
          t.state === 'sprung' ? (t.kind ? theme.trap?.[t.kind] : undefined) : theme.trap?.armed,
          tx,
          ty,
          S,
          'trap',
        ) ??
          (t.state === 'sprung' ? (
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
          ))}
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
    const at = def ? (state.placedMonsterCells[m.id] ?? def.cell) : m.cell;
    if (!at || m.dead) continue;
    const [mx, my] = at;
    const cx = (mx + 0.5) * S;
    const cy = (my + 0.5) * S;
    const selected = selection?.kind === 'monster' && selection.id === m.id;
    const stampIndex = freshOrder.indexOf(m.id);
    const hurt = m.maxBody > 1 && m.body < m.maxBody;
    const pic = monsterPicture(theme, m.image, m.type);
    const whole = isThemeToken(theme, m.image, m.type); // a theme token has its own frame
    tokens.push(
      <g key={`m${m.id}`}>
        {selected && <circle cx={cx} cy={cy} r={19} fill={color.sel} className="selring" />}
        <g
          className={'tok' + (stampIndex >= 0 ? ' stamp' : '')}
          style={stampIndex >= 0 ? { animationDelay: `${380 + 70 * stampIndex}ms` } : undefined}
        >
          {!whole && (
            <circle
              cx={cx}
              cy={cy}
              r={13.5}
              fill="var(--green)"
              stroke={color.tokenText}
              strokeWidth={2}
            />
          )}
          {pic ? (
            <>
              {whole ? (
                <image
                  href={pic}
                  x={cx - 16}
                  y={cy - 16}
                  width={32}
                  height={32}
                  preserveAspectRatio="xMidYMid meet"
                  data-token-image={m.id}
                  data-themed="token"
                />
              ) : (
                <>
                  <clipPath id={`clip-${m.id}`}>
                    <circle cx={cx} cy={cy} r={12.5} />
                  </clipPath>
                  <image
                    href={pic}
                    x={cx - 12.5}
                    y={cy - 12.5}
                    width={25}
                    height={25}
                    preserveAspectRatio="xMidYMid slice"
                    clipPath={`url(#clip-${m.id})`}
                    data-token-image={m.id}
                  />
                </>
              )}
              <rect
                x={cx - 9}
                y={cy + 5}
                width={18}
                height={9}
                fill={color.ink}
                stroke={color.tokenText}
                strokeWidth={0.8}
              />
              <text
                x={cx}
                y={cy + 12.2}
                textAnchor="middle"
                fill={color.tokenText}
                fontFamily="Bonum"
                fontWeight={700}
                fontSize={7.5}
              >
                {codes.get(m.id)}
              </text>
            </>
          ) : (
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
          )}
          {m.special && (
            <g data-special={m.id} pointerEvents="none">
              <circle cx={cx} cy={cy} r={17.5} fill="none" stroke={color.ink} strokeWidth={2.5} />
              <polygon
                points={starPoints(cx - 12, cy - 12, 6.5)}
                fill={color.sel}
                stroke={color.ink}
                strokeWidth={1.2}
                strokeLinejoin="round"
              />
            </g>
          )}
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
      >
        <title>{monsterTip(m, codes.get(m.id) ?? '')}</title>
      </rect>,
    );
  }

  // Dormant statues: neutral line art, never tappable as a monster (decision 28).
  for (const f of dormantFigures(level, state)) {
    const [sx, sy] = f.cell;
    const cx = (sx + 0.5) * S;
    const cy = (sy + 0.5) * S;
    into(fresh(keyOf(f.cell))).push(
      <g key={`st${f.id}`} data-statue={f.id} pointerEvents="none">
        <rect
          x={sx * S + 6}
          y={sy * S + 24}
          width={S - 12}
          height={7}
          fill={color.white}
          stroke={color.ink}
          strokeWidth={1.4}
        />
        <path
          d={`M ${cx - 7} ${sy * S + 24} L ${cx - 5} ${cy - 2} L ${cx + 5} ${cy - 2} L ${cx + 7} ${sy * S + 24} Z`}
          fill={color.white}
          stroke={color.ink}
          strokeWidth={1.4}
        />
        <circle cx={cx} cy={cy - 8} r={5} fill={color.white} stroke={color.ink} strokeWidth={1.4} />
      </g>,
    );
  }

  // Squares and rooms that wait for the players ("did a hero step here?", "a hero enters").
  const markerMarks: ReactNode[] = [];
  const markerHits: ReactNode[] = [];
  for (const m of squareMarkers(level, state)) {
    const cx = (m.cell[0] + 0.5) * S;
    const cy = (m.cell[1] + 0.5) * S;
    markerMarks.push(
      <g key={`sq${m.cell[0]},${m.cell[1]}`} opacity={0.75} pointerEvents="none">
        <circle
          cx={cx}
          cy={cy}
          r={9}
          fill="none"
          stroke={color.ink}
          strokeWidth={1.5}
          strokeDasharray="3 2.5"
        />
        <circle cx={cx} cy={cy} r={2} fill={color.ink} />
      </g>,
    );
    markerHits.push(
      <rect
        key={`sqh${m.cell[0]},${m.cell[1]}`}
        className="hit"
        data-hit
        data-square={`${m.cell[0]},${m.cell[1]}`}
        x={cx - 22}
        y={cy - 22}
        width={44}
        height={44}
        {...press('Square with a note', () =>
          onSelect({ kind: 'square', at: [m.cell[0], m.cell[1]] }),
        )}
      />,
    );
  }
  for (const room of roomLabelAreas(level, state)) {
    let best: [number, number] | undefined;
    for (const k of state.seenCells) {
      const [x, y] = parseKey(k);
      if (areaAt(board, x, y) !== room) continue;
      if (!best || y < best[1] || (y === best[1] && x < best[0])) best = [x, y];
    }
    if (!best) continue;
    const cx = (best[0] + 0.5) * S;
    const cy = (best[1] + 0.5) * S;
    markerMarks.push(
      <g key={`en${room}`} opacity={0.7} pointerEvents="none" data-enter={room}>
        <path
          d={`M ${cx - 7} ${cy + 6} L ${cx - 7} ${cy - 6} L ${cx + 7} ${cy} Z`}
          fill="none"
          stroke={color.ink}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
      </g>,
    );
  }

  // Zones with something waiting (decision 68): one small label on the first seen square.
  for (const z of zoneLabels(level, state)) {
    // Every seen square of the zone carries the same dashed ring and dot as every other square
    // marker (quest 12, falling blocks), and a tap on any of them opens the zone's note.
    markerMarks.push(
      <g key={`zn${z.zone}`} opacity={0.75} pointerEvents="none" data-zone-label={z.zone}>
        {z.cells.map((c) => (
          <g key={`${c[0]},${c[1]}`}>
            <circle
              cx={(c[0] + 0.5) * S}
              cy={(c[1] + 0.5) * S}
              r={9}
              fill="none"
              stroke={color.ink}
              strokeWidth={1.5}
              strokeDasharray="3 2.5"
            />
            <circle cx={(c[0] + 0.5) * S} cy={(c[1] + 0.5) * S} r={2} fill={color.ink} />
          </g>
        ))}
      </g>,
    );
    z.cells.forEach((c, i) =>
      markerHits.push(
        <rect
          key={`znh${z.zone}-${i}`}
          className="hit"
          data-hit
          data-zone={z.zone}
          x={c[0] * S}
          y={c[1] * S}
          width={S}
          height={S}
          {...press('Zone with something waiting', () =>
            onSelect({ kind: 'zone', id: z.zone, at: [c[0], c[1]] }),
          )}
        />,
      ),
    );
  }

  // Letters of notes that were read, where they happened (tap to read again).
  const letterMarks: ReactNode[] = [];
  const letterHits: ReactNode[] = [];
  for (const l of mapLetters(level, state)) {
    const cx = (l.at[0] + 0.5) * S;
    const cy = (l.at[1] + 0.5) * S;
    letterMarks.push(
      <g key={`lt${l.note}`} pointerEvents="none">
        <rect
          x={cx - 11}
          y={cy - 11}
          width={22}
          height={22}
          fill={color.ink}
          stroke={color.floor}
          strokeWidth={1.5}
        />
        <text
          x={cx}
          y={cy + 5.5}
          textAnchor="middle"
          fill={color.tokenText}
          fontFamily="Bonum"
          fontWeight={700}
          fontSize={15}
        >
          {l.letter}
        </text>
      </g>,
    );
    letterHits.push(
      <rect
        key={`lth${l.note}`}
        className="hit"
        data-hit
        data-letter={l.note}
        x={cx - 22}
        y={cy - 22}
        width={44}
        height={44}
        {...press(`Quest note ${l.letter}`, () => onLetter(l.note))}
      />,
    );
  }

  const highlights = highlight.map(([hx, hy]) => (
    <rect
      key={`hl${hx},${hy}`}
      x={hx * S + 2}
      y={hy * S + 2}
      width={S - 4}
      height={S - 4}
      fill="none"
      stroke={color.ink}
      strokeWidth={3}
      className="selring"
      pointerEvents="none"
    />
  ));

  // The eye glyph on squares where "Look from here" can show more.
  // A square with a marker of its own shows the ring only: "Look from here" is in its note.
  const ringCells = new Set(squareMarkers(level, state).map((m) => cellKey(m.cell[0], m.cell[1])));
  // Only crossings get the eye (3 or more corridor neighbors), so the board stays calm.
  const isCrossing = (x: number, y: number) =>
    [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ].filter(([dx = 0, dy = 0]) => areaAt(board, x + dx, y + dy) === 'C').length >= 3;
  const eyes = hints
    .filter(
      ([x, y]) =>
        isCrossing(x, y) && !monsterAt.has(cellKey(x, y)) && !ringCells.has(cellKey(x, y)),
    )
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

  // Adding a monster: every known floor square takes the tap (it sits above everything else).
  const pickLayer: ReactNode[] = [];
  if (onPickCell)
    for (const k of state.seenCells) {
      const [x, y] = parseKey(k);
      pickLayer.push(
        <rect
          key={`pk${k}`}
          className="hit pickcell"
          data-hit
          data-pick-cell={`${x},${y}`}
          x={x * S}
          y={y * S}
          width={S}
          height={S}
          fill={color.sel}
          fillOpacity={0.18}
          {...press(`Square ${x}, ${y}`, () => onPickCell([x, y]))}
        />,
      );
    }

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

  let hoverLabel: ReactNode = null;
  const hf = hoverF ? level.quest.furniture.find((f) => f.id === hoverF) : undefined;
  if (hf && state.seenFurniture.has(hf.id)) {
    const b = bbox(hf.cells);
    const text = furnitureName(hf.type);
    const w = text.length * 7.4 + 16;
    const lx = Math.max(2, Math.min(b.x + b.w / 2 - w / 2, W * S - w - 2));
    const ly = Math.max(2, b.y - 24);
    hoverLabel = (
      <g pointerEvents="none" data-furniture-label={hf.id}>
        <rect x={lx} y={ly} width={w} height={20} fill={color.text} />
        <text
          x={lx + w / 2}
          y={ly + 14}
          textAnchor="middle"
          fill={color.paper}
          fontFamily="Pagella"
          fontSize={13}
        >
          {text}
        </text>
      </g>
    );
  }

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
        <RockPattern id="hatch" theme={theme} size={S} />
        <BoardArt id="board-art" theme={theme} w={W} h={H} size={S} />
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
      {zargonView && <ZargonOverlay level={level} state={state} />}
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
      {markerMarks}
      {letterMarks}
      {highlights}
      {tokens}
      {cellHits}
      {furnitureHits}
      {chestHits}
      {markerHits}
      {trapHits}
      {monsterHits}
      {letterHits}
      {doorHits}
      {pickLayer}
      {hoverLabel}
    </svg>
  );
}
