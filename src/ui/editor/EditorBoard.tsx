import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useStore } from 'zustand';
import { areaAt, board as boardData, isWallBetween, roomIds } from '../../engine/board/board';
import { buildLevel, cellKey, edgeKey } from '../../engine/board/level';
import {
  addBlock,
  addZone,
  toggleZoneCell,
  addDoor,
  addFurniture,
  addMarker,
  addMonster,
  addTrap,
  moveFurniture,
  moveMonster,
  setRockCell,
  setRockRoom,
  setStartArea,
  type Cell,
  type EditResult,
} from '../../engine/editor';
import type { Quest } from '../../engine/quest/schema';
import { Furniture } from '../board/Furniture';
import { MONSTER_LETTER } from '../play/monsterCodes';
import { color } from '../shared/tokens';
import type { EditorStore, EditSelection } from './editorStore';
import { addAction } from './addAction';
import { editorLetters } from './noteLetters';
import { ReferenceLayer, type ReferenceApi } from './ReferenceImage';
import {
  BOARD_H,
  BOARD_W,
  U,
  adjacent,
  edgeOfCell,
  footprintCells,
  nearestEdge,
  toCell,
} from './geometry';

/** Editor squares are drawn in board units and scaled down by the svg viewBox. */
export const EDITOR_CELL_PX = 26;
const VBW = BOARD_W * U + 4;
const VBH = BOARD_H * U + 4;

type Edge = { a: Cell; b: Cell };
type Drag = { kind: 'furniture' | 'monster'; id: string; grab: Cell; first: Cell };

const sameCell = (a: Cell, b: Cell) => a[0] === b[0] && a[1] === b[1];

/** What the next click would do at this square (or edge), as an engine result. Used for the ghost, the hint and the click. */
export function previewOp(
  store: EditorStore,
  cell: Cell | undefined,
  edge: Edge | undefined,
): ((q: Quest) => EditResult) | undefined {
  const { tool, opts, pendingBlock, quest } = store.getState();
  if (!cell) return undefined;
  switch (tool) {
    case 'rock': {
      const room = areaAt(boardData, cell[0], cell[1]);
      if (opts.rockRoom && room && room !== 'C') {
        const on = !quest.rock.rooms.includes(room);
        return (q) => setRockRoom(q, room, on);
      }
      if (opts.rockRoom) return undefined;
      const inRoom = room && quest.rock.rooms.includes(room);
      if (inRoom) return (q) => setRockRoom(q, room, false);
      const on = !quest.rock.cells.some((c) => sameCell(c as Cell, cell));
      return (q) => setRockCell(q, cell, on);
    }
    case 'doors':
      return edge ? (q) => addDoor(q, edge.a, edge.b, opts.doorKind) : undefined;
    case 'blocks':
      if (opts.blockDouble)
        return pendingBlock && adjacent(pendingBlock, cell)
          ? (q) => addBlock(q, [pendingBlock, cell])
          : undefined;
      return (q) => addBlock(q, [cell]);
    case 'furniture':
      return (q) =>
        addFurniture(
          q,
          opts.furnitureType,
          footprintCells(opts.furnitureType, cell, opts.furnitureTurned),
        );
    case 'monsters':
      return (q) => addMonster(q, opts.monsterType, cell);
    case 'traps':
      if (opts.trapKind === 'chest') {
        const chest = quest.furniture.find(
          (f) => f.type === 'chest' && f.cells.some((c) => sameCell(c as Cell, cell)),
        );
        return chest ? (q) => addTrap(q, 'chest', { furniture: chest.id }) : undefined;
      }
      return (q) => addTrap(q, opts.trapKind, { cell });
    case 'markers':
      return (q) => addMarker(q, opts.markerLabel, cell, opts.markerVisible);
    case 'start': {
      const room = areaAt(boardData, cell[0], cell[1]);
      return room && room !== 'C' ? (q) => setStartArea(q, room) : undefined;
    }
    default:
      return undefined;
  }
}

export function EditorBoard({
  store,
  reference,
}: {
  store: EditorStore;
  reference?: ReferenceApi;
}) {
  const { quest, tool, opts, selection, pendingBlock, picking, flash } = useStore(store);
  const level = useMemo(() => buildLevel(quest), [quest]);
  const board = level.board;
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<{ cell: Cell; edge: Edge | undefined } | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [cursor, setCursor] = useState<{ cell: Cell; edge: Edge | undefined } | null>(null);
  const [focused, setFocused] = useState(false);

  // The flash goes away on its own (and stays still with reduced motion).
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => store.getState().clearFlash(), 1800);
    return () => clearTimeout(t);
  }, [flash, store]);

  const toUnits = (e: { clientX: number; clientY: number }): [number, number] => {
    const r = svgRef.current!.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * VBW - 2, ((e.clientY - r.top) / r.height) * VBH - 2];
  };

  /** Things at a square, topmost first, for the Select tool. */
  const pick = (cell: Cell, edge: Edge | undefined): EditSelection => {
    if (edge) {
      const d = level.doorAtEdge.get(edgeKey(edge.a, edge.b));
      if (d) return { kind: 'door', id: d.id };
    }
    const marker = quest.markers.find((m) => sameCell(m.cell as Cell, cell));
    if (marker) return { kind: 'marker', id: marker.id };
    const mon = quest.monsters.find((m) => m.cell && sameCell(m.cell as Cell, cell));
    if (mon) return { kind: 'monster', id: mon.id };
    const trap = quest.traps.find((t) => t.cell && sameCell(t.cell as Cell, cell));
    if (trap) return { kind: 'trap', id: trap.id };
    const fur = quest.furniture.find((f) => f.cells.some((c) => sameCell(c as Cell, cell)));
    if (fur) {
      const t = quest.traps.find((x) => x.furniture === fur.id);
      return t && sameCell(fur.cells[0] as Cell, cell)
        ? { kind: 'trap', id: t.id }
        : { kind: 'furniture', id: fur.id };
    }
    const blk = level.blockAt.get(cellKey(cell[0], cell[1]));
    if (blk) return { kind: 'block', cell };
    const zone = quest.zones.find((z) => z.cells.some((c) => sameCell(c as Cell, cell)));
    if (zone) return { kind: 'zone', id: zone.id };
    return null;
  };

  /** A click (or Enter) on a square or edge. */
  const act = (cell: Cell | undefined, edge: Edge | undefined) => {
    const s = store.getState();
    if (!cell) return;
    if (s.picking) {
      const req = s.picking;
      if (req.kind === 'cell') {
        s.setPicking(null);
        req.onPick([cell[0], cell[1]]);
        return;
      }
      if (req.kind === 'door' || req.kind === 'secretDoor') {
        const d = edge ? level.doorAtEdge.get(edgeKey(edge.a, edge.b)) : undefined;
        const secret = d ? quest.secretDoors.some((x) => x.id === d.id) : false;
        if (!d || (req.kind === 'secretDoor') !== secret) {
          s.say(
            req.kind === 'secretDoor'
              ? 'Click a secret door. Doors show at the edge of a square.'
              : 'Click a door. Click close to its edge.',
          );
          return;
        }
        s.setPicking(null);
        req.onPick(d.id);
        return;
      }
      const area = areaAt(board, cell[0], cell[1]);
      if (!area || (req.kind === 'room' && area === 'C')) {
        s.say('Click a room.');
        return;
      }
      s.setPicking(null);
      req.onPick(area);
      return;
    }
    if (s.tool === 'select') {
      s.select(pick(cell, edge));
      return;
    }
    if (s.tool === 'doors' && edge) {
      const d = level.doorAtEdge.get(edgeKey(edge.a, edge.b));
      if (d) {
        s.select({ kind: 'door', id: d.id });
        return;
      }
    }
    if (s.tool === 'blocks') {
      const blk = level.blockAt.get(cellKey(cell[0], cell[1]));
      if (blk) {
        s.select({ kind: 'block', cell });
        return;
      }
      if (s.opts.blockDouble) {
        if (!s.pendingBlock || !adjacent(s.pendingBlock, cell)) {
          if (s.pendingBlock) s.say('Pick a square next to the first one.');
          s.setPendingBlock(cell);
          return;
        }
        const first = s.pendingBlock;
        s.setPendingBlock(null);
        s.apply((q) => addBlock(q, [first, cell]));
        return;
      }
    }
    if (s.tool === 'zones') {
      // A square of another zone makes that zone the active one; any other square is added to
      // the active zone, or starts a new zone when none is active.
      const here = quest.zones.find((z) => z.cells.some((c) => sameCell(c as Cell, cell)));
      if (here && here.id !== s.opts.zoneId) {
        s.setOpts({ zoneId: here.id });
        s.select({ kind: 'zone', id: here.id });
        return;
      }
      const active = quest.zones.find((z) => z.id === s.opts.zoneId);
      if (active) {
        s.apply((q) => toggleZoneCell(q, active.id, cell));
        return;
      }
      if (s.apply((q) => addZone(q, cell))) {
        const made = store.getState().quest.zones.at(-1);
        if (made) {
          s.setOpts({ zoneId: made.id });
          s.select({ kind: 'zone', id: made.id });
        }
      }
      return;
    }
    if (s.tool === 'doors' && !edge) {
      s.say('Click near the edge between two squares.');
      return;
    }
    if (s.tool === 'traps' && s.opts.trapKind === 'chest' && !previewOp(store, cell, edge)) {
      s.say('Click a chest to put a chest trap on it.');
      return;
    }
    if (s.tool === 'rock' && s.opts.rockRoom && areaAt(board, cell[0], cell[1]) === 'C') {
      s.say('Whole room is on: click a room, not the corridor.');
      return;
    }
    if (s.tool === 'start' && areaAt(board, cell[0], cell[1]) === 'C') {
      s.say('The start is a room. Click a room.');
      return;
    }
    const op = previewOp(store, cell, edge);
    if (op) s.apply(op);
  };

  // ---- pointer

  const position = (e: React.PointerEvent) => {
    const [ux, uy] = toUnits(e);
    const cell = toCell(ux, uy);
    const edge =
      tool === 'doors' ||
      tool === 'select' ||
      picking?.kind === 'door' ||
      picking?.kind === 'secretDoor'
        ? nearestEdge(ux, uy)
        : undefined;
    return { cell, edge };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    svgRef.current?.focus();
    if (tool !== 'select' || picking) return;
    const { cell, edge } = position(e);
    if (!cell) return;
    const hit = pick(cell, edge);
    if (hit && (hit.kind === 'furniture' || hit.kind === 'monster')) {
      const first =
        hit.kind === 'furniture'
          ? (quest.furniture.find((f) => f.id === hit.id)!.cells[0] as Cell)
          : (quest.monsters.find((m) => m.id === hit.id)!.cell as Cell);
      setDrag({ kind: hit.kind, id: hit.id, grab: cell, first });
      svgRef.current?.setPointerCapture(e.pointerId);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const { cell, edge } = position(e);
    setHover(cell ? { cell, edge } : null);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const { cell, edge } = position(e);
    if (drag) {
      const d = drag;
      setDrag(null);
      if (cell && !sameCell(cell, d.grab)) {
        const to: Cell = [d.first[0] + cell[0] - d.grab[0], d.first[1] + cell[1] - d.grab[1]];
        store
          .getState()
          .apply((q) =>
            d.kind === 'furniture' ? moveFurniture(q, d.id, to) : moveMonster(q, d.id, to),
          );
        store.getState().select({ kind: d.kind, id: d.id });
        return;
      }
    }
    act(cell, edge);
  };

  // ---- keyboard cursor

  const onKeyDown = (e: React.KeyboardEvent) => {
    const dirs: Record<string, [number, number, 'n' | 'e' | 's' | 'w']> = {
      ArrowUp: [0, -1, 'n'],
      ArrowDown: [0, 1, 's'],
      ArrowLeft: [-1, 0, 'w'],
      ArrowRight: [1, 0, 'e'],
    };
    const d = dirs[e.key];
    const cur = cursor ?? { cell: [1, 14] as Cell, edge: undefined };
    if (d) {
      e.preventDefault();
      if (e.shiftKey) {
        setCursor({ cell: cur.cell, edge: edgeOfCell(cur.cell, d[2]) });
        return;
      }
      const next: Cell = [
        Math.max(0, Math.min(BOARD_W - 1, cur.cell[0] + d[0])),
        Math.max(0, Math.min(BOARD_H - 1, cur.cell[1] + d[1])),
      ];
      setCursor({ cell: next, edge: undefined });
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const wantsDoor =
        tool === 'doors' || picking?.kind === 'door' || picking?.kind === 'secretDoor';
      const edge = cur.edge ?? (wantsDoor ? edgeOfCell(cur.cell, 'e') : undefined);
      act(cur.cell, edge);
    }
  };

  // ---- hints and ghosts

  const active = hover ?? (focused && cursor ? cursor : null);
  const previewFn = active && !picking ? previewOp(store, active.cell, active.edge) : undefined;
  const preview = previewFn ? previewFn(quest) : undefined;
  const hint = picking
    ? picking.hint
    : tool !== 'select' && preview && !preview.ok
      ? preview.error
      : '';

  // ---- drawing

  const rockSet = level.rock;
  const cells: ReactNode[] = [];
  const walls: ReactNode[] = [];
  for (let y = 0; y < BOARD_H; y++)
    for (let x = 0; x < BOARD_W; x++) {
      const k = cellKey(x, y);
      if (rockSet.has(k)) {
        cells.push(
          <rect
            key={`r${k}`}
            x={x * U}
            y={y * U}
            width={U}
            height={U}
            fill="url(#ed-hatch)"
            stroke={color.rockLine}
            strokeWidth={0.6}
          />,
        );
        continue;
      }
      const corridor = areaAt(board, x, y) === 'C';
      cells.push(
        <rect
          key={`f${k}`}
          x={x * U}
          y={y * U}
          width={U}
          height={U}
          fill={corridor ? color.corridor : color.floor}
          stroke={color.cellLine}
          strokeWidth={0.8}
        />,
      );
      for (const [dx, dy, ax, ay, bx, by] of [
        [0, -1, 0, 0, 1, 0],
        [1, 0, 1, 0, 1, 1],
        [0, 1, 0, 1, 1, 1],
        [-1, 0, 0, 0, 0, 1],
      ] as const) {
        if (
          !isWallBetween(board, [x, y], [x + dx, y + dy]) &&
          !rockSet.has(cellKey(x + dx, y + dy))
        )
          continue;
        walls.push(
          <line
            key={`w${k},${dx},${dy}`}
            x1={(x + ax) * U}
            y1={(y + ay) * U}
            x2={(x + bx) * U}
            y2={(y + by) * U}
            stroke={color.ink}
            strokeWidth={3.2}
            strokeLinecap="square"
          />,
        );
      }
    }

  const startTint: ReactNode[] = [];
  for (let y = 0; y < BOARD_H; y++)
    for (let x = 0; x < BOARD_W; x++)
      if (areaAt(board, x, y) === quest.start.area && !rockSet.has(cellKey(x, y)))
        startTint.push(
          <rect
            key={`s${x},${y}`}
            x={x * U}
            y={y * U}
            width={U}
            height={U}
            fill={color.sel}
            opacity={0.4}
            pointerEvents="none"
          />,
        );

  // Zones (decision 68): their squares tinted, the id at the first square. The active one is stronger.
  const zoneArt: ReactNode[] = [];
  for (const z of quest.zones) {
    const on =
      (selection?.kind === 'zone' && selection.id === z.id) ||
      (tool === 'zones' && opts.zoneId === z.id);
    z.cells.forEach((c, i) => {
      zoneArt.push(
        <rect
          key={`z${z.id}:${i}`}
          data-zone-cell={z.id}
          x={c[0] * U + 1.5}
          y={c[1] * U + 1.5}
          width={U - 3}
          height={U - 3}
          fill={color.sel}
          opacity={on ? 0.85 : 0.55}
          stroke={color.ink}
          strokeWidth={on ? 2 : 1}
          strokeDasharray="4 3"
          pointerEvents="none"
        />,
      );
    });
    const first = z.cells[0];
    if (first)
      zoneArt.push(
        <text
          key={`zt${z.id}`}
          x={first[0] * U + 4}
          y={first[1] * U + 11}
          fill={color.ink}
          fontFamily="Bonum"
          fontWeight={700}
          fontSize={10}
          pointerEvents="none"
        >
          {z.id}
        </text>,
      );
  }

  const doors: ReactNode[] = [];
  for (const d of level.doors.values()) {
    const vertical = d.a[1] === d.b[1];
    const ex = vertical ? Math.max(d.a[0], d.b[0]) : d.a[0];
    const ey = vertical ? d.a[1] : Math.max(d.a[1], d.b[1]);
    const cx = (vertical ? ex : ex + 0.5) * U;
    const cy = (vertical ? ey + 0.5 : ey) * U;
    const w = vertical ? 10 : 24;
    const h = vertical ? 24 : 10;
    const sel = selection?.kind === 'door' && selection.id === d.id;
    doors.push(
      <g key={`d${d.id}`} data-door={d.id}>
        {sel && <circle cx={cx} cy={cy} r={20} fill={color.sel} className="selring" />}
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
        {d.kind === 'false' ? (
          <path
            d={`M ${cx - 5} ${cy - 5} L ${cx + 5} ${cy + 5} M ${cx + 5} ${cy - 5} L ${cx - 5} ${cy + 5}`}
            stroke={color.ink}
            strokeWidth={1.6}
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
  }

  const blockArt: ReactNode[] = [];
  for (const b of level.blocks)
    for (const [bx, by] of b.cells) {
      const q = (U - 4) / 4;
      const sel = selection?.kind === 'block' && sameCell(selection.cell, [bx, by]);
      blockArt.push(
        <g key={`b${bx},${by}`} data-block={`${bx},${by}`}>
          {sel && (
            <rect x={bx * U} y={by * U} width={U} height={U} fill={color.sel} className="selring" />
          )}
          <rect
            x={bx * U + 2}
            y={by * U + 2}
            width={U - 4}
            height={U - 4}
            fill={color.white}
            stroke={color.ink}
            strokeWidth={1.5}
          />
          {[1, 2, 3].map((i) => (
            <line
              key={i}
              x1={bx * U + 2}
              y1={by * U + 2 + i * q}
              x2={bx * U + U - 2}
              y2={by * U + 2 + i * q}
              stroke={color.ink}
              strokeWidth={1}
            />
          ))}
        </g>,
      );
    }

  const things: ReactNode[] = [];
  for (const f of quest.furniture) {
    const sel = selection?.kind === 'furniture' && selection.id === f.id;
    things.push(
      <g key={`u${f.id}`} data-furniture={f.id}>
        {sel &&
          f.cells.map((c) => (
            <rect
              key={cellKey(c[0], c[1])}
              x={c[0] * U}
              y={c[1] * U}
              width={U}
              height={U}
              fill={color.sel}
              className="selring"
            />
          ))}
        <Furniture f={f} />
      </g>,
    );
  }
  for (const t of quest.traps) {
    const furn = t.furniture ? quest.furniture.find((f) => f.id === t.furniture) : undefined;
    const c = (t.cell ?? furn?.cells[0]) as Cell | undefined;
    if (!c) continue;
    const cx = (c[0] + 0.5) * U;
    const cy = (c[1] + 0.5) * U;
    const sel = selection?.kind === 'trap' && selection.id === t.id;
    things.push(
      <g key={`t${t.id}`} data-trap={t.id} opacity={0.65}>
        {sel && <circle cx={cx} cy={cy} r={19} fill={color.sel} className="selring" />}
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
      </g>,
    );
  }
  for (const m of quest.monsters) {
    if (!m.cell) continue;
    const cx = (m.cell[0] + 0.5) * U;
    const cy = (m.cell[1] + 0.5) * U;
    const sel = selection?.kind === 'monster' && selection.id === m.id;
    things.push(
      <g key={`m${m.id}`} data-monster={m.id}>
        {sel && <circle cx={cx} cy={cy} r={19} fill={color.sel} className="selring" />}
        <circle
          cx={cx}
          cy={cy}
          r={13.5}
          fill="var(--green)"
          stroke={color.tokenText}
          strokeWidth={2}
          opacity={m.state === 'dormant' ? 0.55 : 1}
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
      </g>,
    );
  }
  for (const m of quest.markers) {
    const cx = (m.cell[0] + 0.5) * U;
    const cy = (m.cell[1] + 0.5) * U;
    const sel = selection?.kind === 'marker' && selection.id === m.id;
    things.push(
      <g key={`k${m.id}`} data-marker={m.id}>
        {sel && <circle cx={cx} cy={cy} r={17} fill={color.sel} className="selring" />}
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
      </g>,
    );
  }

  // Quest-note letters, as in play. A letter on the map with no note is dashed and white.
  // With the Select tool a tap on one opens the Notes tab (its own hit square, 44 units, 18 in the corner of a piece).
  const letterMarks: ReactNode[] = [];
  const tappable = tool === 'select' && !picking;
  for (const l of editorLetters(quest)) {
    // A letter on its furniture or marker sits in the corner, so the piece can still be tapped.
    const cx = (l.at[0] + 0.5) * U + (l.onThing ? 11 : 0);
    const cy = (l.at[1] + 0.5) * U - (l.onThing ? 11 : 0);
    const missing = l.note === undefined;
    letterMarks.push(
      <g
        key={`lt${l.letter}`}
        data-letter={l.letter}
        data-note={l.note}
        data-missing={missing ? 'true' : undefined}
      >
        <rect
          x={cx - 11}
          y={cy - 11}
          width={22}
          height={22}
          fill={missing ? color.white : color.ink}
          stroke={missing ? color.ink : color.floor}
          strokeWidth={missing ? 2 : 1.5}
          strokeDasharray={missing ? '4 3' : undefined}
          pointerEvents="none"
        />
        <text
          x={cx}
          y={cy + 5.5}
          textAnchor="middle"
          fill={missing ? color.ink : color.tokenText}
          fontFamily="Bonum"
          fontWeight={700}
          fontSize={15}
          pointerEvents="none"
        >
          {l.letter}
        </text>
        {tappable && (
          <rect
            data-letter-hit={l.letter}
            x={cx - (l.onThing ? 9 : 22)}
            y={cy - (l.onThing ? 9 : 22)}
            width={l.onThing ? 18 : 44}
            height={l.onThing ? 18 : 44}
            fill="transparent"
            style={{ cursor: 'pointer' }}
            role="button"
            aria-label={missing ? `Letter ${l.letter}, no note yet` : `Quest note ${l.letter}`}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => {
              e.stopPropagation();
              // A letter with an action opens it; a letter with none gets its action made now.
              // The board stays on screen either way (the popup opens over it).
              const st = store.getState();
              if (l.note) st.setNoteId(l.note);
              else
                addAction(store, { kind: 'area', id: store.getState().quest.start.area }, l.letter);
            }}
          />
        )}
      </g>,
    );
  }

  // The flash after a jump from the Problems panel: the squares and areas an issue names.
  const flashMarks: ReactNode[] = [];
  if (flash) {
    for (const id of flash.areas)
      for (let y = 0; y < BOARD_H; y++)
        for (let x = 0; x < BOARD_W; x++)
          if (areaAt(board, x, y) === id)
            flashMarks.push(
              <rect
                key={`fa${x},${y}`}
                x={x * U}
                y={y * U}
                width={U}
                height={U}
                fill={color.sel}
                opacity={0.5}
                className="selring"
                pointerEvents="none"
              />,
            );
    for (const [x, y] of flash.cells)
      flashMarks.push(
        <rect
          key={`fc${x},${y}`}
          data-flash={`${x},${y}`}
          x={x * U + 1}
          y={y * U + 1}
          width={U - 2}
          height={U - 2}
          fill="none"
          stroke={color.ink}
          strokeWidth={3}
          className="selring"
          pointerEvents="none"
        />,
      );
  }

  const roomLabels: ReactNode[] = [];
  if (opts.roomIds)
    for (const id of roomIds(board)) {
      const cs: Cell[] = [];
      for (let y = 0; y < BOARD_H; y++)
        for (let x = 0; x < BOARD_W; x++) if (areaAt(board, x, y) === id) cs.push([x, y]);
      const cx = cs.reduce((s, c) => s + c[0], 0) / cs.length + 0.5;
      const cy = cs.reduce((s, c) => s + c[1], 0) / cs.length + 0.5;
      roomLabels.push(
        <text
          key={`rl${id}`}
          x={cx * U}
          y={cy * U}
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="Bonum"
          fontSize={13}
          fill={color.ink}
          opacity={0.7}
          pointerEvents="none"
        >
          {id}
        </text>,
      );
    }

  // The ghost of what a click would do, or of the piece being dragged.
  const ghost: ReactNode[] = [];
  const bad = (
    <pattern
      id="ed-bad"
      width={6}
      height={6}
      patternUnits="userSpaceOnUse"
      patternTransform="rotate(45)"
    >
      <rect width={6} height={6} fill={color.ink} opacity={0.25} />
      <line x1={0} y1={0} x2={0} y2={6} stroke={color.ink} strokeWidth={2} />
    </pattern>
  );
  const ghostCells = (cs: readonly Cell[], valid: boolean) =>
    cs.map((c) => (
      <rect
        key={`g${c[0]},${c[1]}`}
        x={c[0] * U + 1}
        y={c[1] * U + 1}
        width={U - 2}
        height={U - 2}
        fill={valid ? color.sel : 'url(#ed-bad)'}
        stroke={color.ink}
        strokeWidth={1.5}
        strokeDasharray="4 3"
        opacity={0.85}
        pointerEvents="none"
      />
    ));
  if (drag && hover) {
    const to: Cell = [
      drag.first[0] + hover.cell[0] - drag.grab[0],
      drag.first[1] + hover.cell[1] - drag.grab[1],
    ];
    const r =
      drag.kind === 'furniture'
        ? moveFurniture(quest, drag.id, to)
        : moveMonster(quest, drag.id, to);
    const f = quest.furniture.find((x) => x.id === drag.id);
    const shape: Cell[] = f
      ? f.cells.map((c) => [c[0] - drag.first[0] + to[0], c[1] - drag.first[1] + to[1]] as Cell)
      : [to];
    ghost.push(...ghostCells(shape, r.ok));
  } else if (active && tool === 'furniture')
    ghost.push(
      ...ghostCells(
        footprintCells(opts.furnitureType, active.cell, opts.furnitureTurned),
        preview?.ok ?? false,
      ),
    );
  else if (active && ['monsters', 'markers', 'blocks', 'traps'].includes(tool) && preview)
    ghost.push(...ghostCells([active.cell], preview.ok));
  else if (active && tool === 'rock' && preview && !opts.rockRoom)
    ghost.push(...ghostCells([active.cell], preview.ok));
  if (tool === 'blocks' && pendingBlock) ghost.push(...ghostCells([pendingBlock], true));
  if (active?.edge && tool === 'doors') {
    const { a, b } = active.edge;
    const vertical = a[1] === b[1];
    const ex = vertical ? Math.max(a[0], b[0]) : a[0];
    const ey = vertical ? a[1] : Math.max(a[1], b[1]);
    ghost.push(
      <line
        key="edge"
        x1={(vertical ? ex : ex) * U}
        y1={(vertical ? ey : ey) * U}
        x2={(vertical ? ex : ex + 1) * U}
        y2={(vertical ? ey + 1 : ey) * U}
        stroke={preview?.ok === false ? color.text : color.ink}
        strokeWidth={5}
        opacity={0.7}
        pointerEvents="none"
      />,
    );
  }
  if (tool === 'select' && hover && !drag)
    ghost.push(
      <rect
        key="hv"
        x={hover.cell[0] * U + 1}
        y={hover.cell[1] * U + 1}
        width={U - 2}
        height={U - 2}
        fill="none"
        stroke={color.ink}
        strokeWidth={1}
        opacity={0.5}
        pointerEvents="none"
      />,
    );
  if (focused && cursor)
    ghost.push(
      <rect
        key="kb"
        x={cursor.cell[0] * U + 2}
        y={cursor.cell[1] * U + 2}
        width={U - 4}
        height={U - 4}
        fill="none"
        stroke={color.text}
        strokeWidth={2}
        strokeDasharray="3 3"
        pointerEvents="none"
      />,
    );

  return (
    <div className="ed-boardwrap">
      <svg
        ref={svgRef}
        data-flash-id={flash?.id}
        id="editor-board"
        role="application"
        aria-label="Quest board. Arrow keys move the cursor, Enter acts."
        tabIndex={0}
        width={BOARD_W * EDITOR_CELL_PX + 4}
        height={BOARD_H * EDITOR_CELL_PX + 4}
        viewBox={`-2 -2 ${VBW} ${VBH}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => setHover(null)}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      >
        <defs>
          <pattern
            id="ed-hatch"
            width={6}
            height={6}
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width={6} height={6} fill={color.rock} />
            <line x1={0} y1={0} x2={0} y2={6} stroke={color.rockLine} strokeWidth={2} />
          </pattern>
          {bad}
        </defs>
        {cells}
        {startTint}
        {zoneArt}
        {walls}
        {blockArt}
        {things}
        {doors}
        {letterMarks}
        <rect
          x={0}
          y={0}
          width={BOARD_W * U}
          height={BOARD_H * U}
          fill="none"
          stroke={color.ink}
          strokeWidth={3}
        />
        {roomLabels}
        {flashMarks}
        {ghost}
      </svg>
      {reference && <ReferenceLayer api={reference} />}
      <p className="ed-hint" role="status">
        {hint}
      </p>
    </div>
  );
}
