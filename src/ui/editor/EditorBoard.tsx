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
  addMonsterOfEnemy,
  addEdgeDoor,
  addTrap,
  addTunnel,
  boardTileAt,
  exteriorSideOf,
  pickTunnelDesign,
  placeBoardTile,
  placeRoomTile,
  roomTileCellsFor,
  roomTileIndexAt,
  tileCellsFor,
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
import { roomTileCells } from '../../engine/quest/roomTileCells';
import { BoardTileArt, ExteriorDoorArt, RoomTileArt, TunnelEndArt } from './TileArt';
import { color } from '../shared/tokens';
import type { EditorStore, EditSelection } from './editorStore';
import { ZOOM_STRIP, ZoomLayer } from '../play/ZoomLayer';
import { addAction } from './addAction';
import { useTheme } from '../theme/activeTheme';
import { boxOfMonster, pictureTypeOf } from '../../engine/data/enemies';
import { boxTokenFill } from '../shared/boxColor';
import { isThemeToken, monsterPicture } from '../theme/theme';
import {
  BoardArt,
  blockPiece,
  doorPiece,
  floorCell,
  RockPattern,
  squarePiece,
  tokenBox,
  wallSegment,
} from '../theme/draw';
import { shownImage, shownLetter } from './monsterLabel';
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
  nearestOuterEdge,
  toCell,
  type OuterEdge,
} from './geometry';
import { t } from '../../i18n/t';

/** Editor squares are drawn in board units and scaled down by the svg viewBox. */
export const EDITOR_CELL_PX = 26;
/** The editor board as drawn (px): what the zoom fits to the area. */
const EDITOR_CONTENT = { w: BOARD_W * EDITOR_CELL_PX + 4, h: BOARD_H * EDITOR_CELL_PX + 4 };
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
  outer?: OuterEdge,
): ((q: Quest) => EditResult) | undefined {
  const { tool, opts, pendingBlock, pendingTunnel, quest } = store.getState();
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
    case 'doors': {
      const kind = opts.doorKind;
      if (kind === 'tunnel')
        return pendingTunnel
          ? (q) =>
              addTunnel(q, {
                design: pickTunnelDesign(q, opts.tunnelDesign),
                a: pendingTunnel,
                b: cell,
              })
          : undefined;
      if (kind === 'ironEntry' || kind === 'woodenExit') {
        const target = outer ?? (edge ? exteriorSideOf(quest, edge.a, edge.b) : undefined);
        return target ? (q) => addEdgeDoor(q, { ...target, kind }) : undefined;
      }
      return edge ? (q) => addDoor(q, edge.a, edge.b, kind) : undefined;
    }
    case 'tiles': {
      const picked = opts.tile;
      if (picked.group === 'room')
        return (q) =>
          placeRoomTile(q, {
            type: picked.type,
            at: cell,
            variant: opts.tileVariant,
            turned: opts.tileTurned,
          });
      return (q) =>
        placeBoardTile(q, {
          type: picked.type,
          at: cell,
          variant: opts.tileVariant,
          turned: opts.tileTurned,
        });
    }
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
      return opts.monsterEnemy
        ? (q) =>
            addMonsterOfEnemy(q, opts.monsterEnemy!.def, cell, {
              fromLibrary: opts.monsterEnemy!.fromLibrary,
              lib: opts.monsterEnemy!.lib,
            })
        : (q) => addMonster(q, opts.monsterType, cell);
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
  const { quest, tool, opts, selection, pendingBlock, pendingTunnel, picking, flash } =
    useStore(store);
  const theme = useTheme();
  const level = useMemo(() => buildLevel(quest), [quest]);
  const board = level.board;
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<{
    cell: Cell;
    edge: Edge | undefined;
    outer: OuterEdge | undefined;
  } | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [cursor, setCursor] = useState<{
    cell: Cell;
    edge: Edge | undefined;
    outer?: OuterEdge | undefined;
  } | null>(null);
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
  const pick = (cell: Cell, edge: Edge | undefined, outer?: OuterEdge): EditSelection => {
    if (edge) {
      const d = level.doorAtEdge.get(edgeKey(edge.a, edge.b));
      if (d) return { kind: 'door', id: d.id };
    }
    if (outer) {
      const e = quest.edgeDoors.find(
        (x) => sameCell(x.cell as Cell, outer.cell) && x.side === outer.side,
      );
      if (e) return { kind: 'door', id: e.id };
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
    const tun = quest.tunnels.find(
      (t) => sameCell(t.a as Cell, cell) || sameCell(t.b as Cell, cell),
    );
    if (tun) return { kind: 'tunnel', id: tun.id, end: sameCell(tun.a as Cell, cell) ? 'a' : 'b' };
    const ti = boardTileAt(quest, cell);
    if (ti >= 0) return { kind: 'tile', index: ti };
    const zone = quest.zones.find((z) => z.cells.some((c) => sameCell(c as Cell, cell)));
    if (zone) return { kind: 'zone', id: zone.id };
    const rt = roomTileIndexAt(quest, cell);
    if (rt >= 0) return { kind: 'roomTile', index: rt };
    return null;
  };

  /** A click (or Enter) on a square or edge. */
  const act = (cell: Cell | undefined, edge: Edge | undefined, outer?: OuterEdge) => {
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
      s.select(pick(cell, edge, outer));
      return;
    }
    if (s.tool === 'doors' && s.opts.doorKind === 'tunnel') {
      const end = quest.tunnels.find(
        (t) => sameCell(t.a as Cell, cell) || sameCell(t.b as Cell, cell),
      );
      if (end && !s.pendingTunnel) {
        s.select({ kind: 'tunnel', id: end.id, end: sameCell(end.a as Cell, cell) ? 'a' : 'b' });
        return;
      }
      if (!s.pendingTunnel) {
        s.setPendingTunnel(cell);
        return;
      }
      const first = s.pendingTunnel;
      s.setPendingTunnel(null);
      if (sameCell(first, cell)) return;
      if (
        s.apply((q) =>
          addTunnel(q, { design: pickTunnelDesign(q, s.opts.tunnelDesign), a: first, b: cell }),
        )
      ) {
        const now = store.getState().quest;
        const made = now.tunnels.at(-1);
        if (made) s.select({ kind: 'tunnel', id: made.id, end: 'a' });
      }
      return;
    }
    if (
      s.tool === 'doors' &&
      (s.opts.doorKind === 'ironEntry' || s.opts.doorKind === 'woodenExit')
    ) {
      const hit = pick(cell, edge, outer);
      if (hit?.kind === 'door') {
        s.select(hit);
        return;
      }
      const op = previewOp(store, cell, edge, outer);
      if (!op) {
        s.say('Tap the outer edge of a square on the board border, or an edge that touches rock.');
        return;
      }
      if (s.apply(op)) {
        const made = store.getState().quest.edgeDoors.at(-1);
        if (made) s.select({ kind: 'door', id: made.id });
      }
      return;
    }
    if (s.tool === 'doors' && edge) {
      const d = level.doorAtEdge.get(edgeKey(edge.a, edge.b));
      if (d) {
        s.select({ kind: 'door', id: d.id });
        return;
      }
    }
    if (s.tool === 'tiles') {
      const picked = s.opts.tile;
      const ti = boardTileAt(quest, cell);
      const rt = roomTileIndexAt(quest, cell);
      if (picked.group === 'board' && ti >= 0) {
        s.select({ kind: 'tile', index: ti });
        return;
      }
      if (picked.group === 'room' && rt >= 0 && quest.roomTiles[rt]?.type === picked.type) {
        s.select({ kind: 'roomTile', index: rt });
        return;
      }
      const op = previewOp(store, cell, edge, outer);
      if (op && s.apply(op)) {
        const now = store.getState().quest;
        if (picked.group === 'board') {
          const made = boardTileAt(now, cell);
          if (made >= 0) s.select({ kind: 'tile', index: made });
        } else {
          const made = roomTileIndexAt(now, cell);
          if (made >= 0) s.select({ kind: 'roomTile', index: made });
        }
      }
      return;
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
    if (s.tool === 'doors' && s.opts.doorKind !== 'tunnel' && !edge) {
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
    const exterior =
      tool === 'doors' && (opts.doorKind === 'ironEntry' || opts.doorKind === 'woodenExit');
    const edge =
      (tool === 'doors' && opts.doorKind !== 'tunnel') ||
      tool === 'select' ||
      picking?.kind === 'door' ||
      picking?.kind === 'secretDoor'
        ? nearestEdge(ux, uy)
        : undefined;
    const outer = exterior || tool === 'select' ? nearestOuterEdge(ux, uy) : undefined;
    return { cell, edge, outer };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    svgRef.current?.focus();
    if (tool !== 'select' || picking) return;
    const { cell, edge, outer } = position(e);
    if (!cell) return;
    const hit = pick(cell, edge, outer);
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
    const { cell, edge, outer } = position(e);
    setHover(cell ? { cell, edge, outer } : null);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const { cell, edge, outer } = position(e);
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
    act(cell, edge, outer);
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
        const e2 = edgeOfCell(cur.cell, d[2]);
        setCursor({
          cell: cur.cell,
          edge: e2,
          outer: e2 ? undefined : { cell: cur.cell, side: d[2] },
        });
        return;
      }
      const next: Cell = [
        Math.max(0, Math.min(BOARD_W - 1, cur.cell[0] + d[0])),
        Math.max(0, Math.min(BOARD_H - 1, cur.cell[1] + d[1])),
      ];
      setCursor({ cell: next, edge: undefined, outer: undefined });
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const wantsDoor =
        (tool === 'doors' && opts.doorKind !== 'tunnel') ||
        picking?.kind === 'door' ||
        picking?.kind === 'secretDoor';
      const edge = cur.edge ?? (wantsDoor ? edgeOfCell(cur.cell, 'e') : undefined);
      act(cur.cell, cur.outer ? undefined : edge, cur.outer);
    }
  };

  // ---- hints and ghosts

  const active = hover ?? (focused && cursor ? cursor : null);
  const previewFn =
    active && !picking ? previewOp(store, active.cell, active.edge, active.outer) : undefined;
  const preview = previewFn ? previewFn(quest) : undefined;
  const hint = picking
    ? picking.hint
    : tool === 'doors' &&
        opts.doorKind === 'tunnel' &&
        pendingTunnel &&
        (!active || sameCell(active.cell, pendingTunnel) || !(preview && !preview.ok))
      ? 'Pick the other end of the tunnel.'
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
      cells.push(floorCell(theme, x, y, U, corridor, `f${k}`, 'ed-board-art'));
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
        if (theme.board && isWallBetween(board, [x, y], [x + dx, y + dy])) continue; // in the picture
        walls.push(
          wallSegment(
            theme,
            `w${k},${dx},${dy}`,
            (x + ax) * U,
            (y + ay) * U,
            (x + bx) * U,
            (y + by) * U,
          ),
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
    if (d.edge) continue; // exterior doors have their own drawing
    const vertical = d.a[1] === d.b[1];
    const ex = vertical ? Math.max(d.a[0], d.b[0]) : d.a[0];
    const ey = vertical ? d.a[1] : Math.max(d.a[1], d.b[1]);
    const cx = (vertical ? ex : ex + 0.5) * U;
    const cy = (vertical ? ey + 0.5 : ey) * U;
    const w = vertical ? 10 : 24;
    const h = vertical ? 24 : 10;
    const sel = selection?.kind === 'door' && selection.id === d.id;
    // a texture pack gives a door its picture (a false door has none: it keeps its cross)
    const doorArt =
      d.kind === 'false'
        ? null
        : doorPiece(theme, d.kind === 'secret' ? 'secret' : 'closed', cx, cy, vertical, U);
    doors.push(
      <g key={`d${d.id}`} data-door={d.id}>
        {sel && <circle cx={cx} cy={cy} r={20} fill={color.sel} className="selring" />}
        {doorArt ? (
          doorArt
        ) : (
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
        )}
        {doorArt ? null : d.kind === 'false' ? (
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

  // Frozen Horror board features: tiles under the walls, tunnels and exterior doors on top.
  const tileArt: ReactNode[] = [];
  quest.roomTiles.forEach((rt, i) => {
    const cs = roomTileCells(quest, rt);
    if (cs.length === 0) return;
    tileArt.push(
      <RoomTileArt
        key={`rt${i}`}
        type={rt.type}
        index={i}
        cells={cs}
        selected={selection?.kind === 'roomTile' && selection.index === i}
        U={U}
      />,
    );
  });
  quest.boardTiles.forEach((t, i) =>
    tileArt.push(
      <BoardTileArt
        key={`bt${i}`}
        tile={t}
        index={i}
        selected={selection?.kind === 'tile' && selection.index === i}
        U={U}
      />,
    ),
  );
  const featureArt: ReactNode[] = [];
  for (const e of quest.edgeDoors)
    featureArt.push(
      <ExteriorDoorArt
        key={`ed${e.id}`}
        id={e.id}
        cell={e.cell as Cell}
        side={e.side}
        kind={e.kind}
        selected={selection?.kind === 'door' && selection.id === e.id}
        start={quest.start.door === e.id}
        U={U}
      />,
    );
  for (const t of quest.tunnels)
    for (const end of ['a', 'b'] as const)
      featureArt.push(
        <TunnelEndArt
          key={`tn${t.id}${end}`}
          tunnel={t.id}
          end={end}
          design={t.design}
          cell={t[end] as Cell}
          selected={selection?.kind === 'tunnel' && selection.id === t.id && selection.end === end}
          U={U}
        />,
      );

  const blockArt: ReactNode[] = [];
  for (const b of level.blocks) {
    // a texture pack draws a block of two squares as one picture (in its first square's group)
    const together = blockPiece(theme, b.cells, U, `bb${b.cells[0]?.join(',')}`);
    b.cells.forEach(([bx, by], i) => {
      const q = (U - 4) / 4;
      const sel = selection?.kind === 'block' && sameCell(selection.cell, [bx, by]);
      const single = together
        ? null
        : squarePiece(theme, { group: 'block', key: 'single' }, bx, by, U, 'block');
      blockArt.push(
        <g key={`b${bx},${by}`} data-block={`${bx},${by}`}>
          {sel && (
            <rect x={bx * U} y={by * U} width={U} height={U} fill={color.sel} className="selring" />
          )}
          {together
            ? i === 0
              ? together
              : null
            : (single ?? (
                <>
                  <rect
                    x={bx * U + 2}
                    y={by * U + 2}
                    width={U - 4}
                    height={U - 4}
                    fill={color.white}
                    stroke={color.ink}
                    strokeWidth={1.5}
                  />
                  {[1, 2, 3].map((n) => (
                    <line
                      key={n}
                      x1={bx * U + 2}
                      y1={by * U + 2 + n * q}
                      x2={bx * U + U - 2}
                      y2={by * U + 2 + n * q}
                      stroke={color.ink}
                      strokeWidth={1}
                    />
                  ))}
                </>
              ))}
        </g>,
      );
    });
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
        <Furniture f={f} board={board} />
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
    // the author sees the kind of every trap, so a pack's picture of that kind is used
    const trapArt = squarePiece(theme, { group: 'trap', key: t.kind }, c[0], c[1], U, 'trap');
    things.push(
      <g key={`t${t.id}`} data-trap={t.id} opacity={0.65}>
        {sel && <circle cx={cx} cy={cy} r={19} fill={color.sel} className="selring" />}
        {trapArt ?? (
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
  }
  for (const m of quest.monsters) {
    if (!m.cell) continue;
    const cx = (m.cell[0] + 0.5) * U;
    const cy = (m.cell[1] + 0.5) * U;
    const sel = selection?.kind === 'monster' && selection.id === m.id;
    const pt = pictureTypeOf(m, quest.enemyDefs);
    const bx = boxOfMonster(m, quest.enemyDefs);
    things.push(
      <g key={`m${m.id}`} data-monster={m.id}>
        {sel && <circle cx={cx} cy={cy} r={19} fill={color.sel} className="selring" />}
        {!isThemeToken(theme, shownImage(quest, m), pt) && (
          <circle
            cx={cx}
            cy={cy}
            r={13.5}
            fill={boxTokenFill(bx)}
            stroke={color.tokenText}
            strokeWidth={2}
            opacity={m.state === 'dormant' ? 0.55 : 1}
          />
        )}
        {isThemeToken(theme, shownImage(quest, m), pt) ? (
          <image
            href={monsterPicture(theme, shownImage(quest, m), pt)}
            {...tokenBox(theme, m.type, cx, cy, U)}
            preserveAspectRatio="xMidYMid meet"
            opacity={m.state === 'dormant' ? 0.55 : 1}
            data-token-image={m.id}
            data-themed="token"
          />
        ) : monsterPicture(theme, shownImage(quest, m), pt) ? (
          <>
            <clipPath id={`eclip-${m.id}`}>
              <circle cx={cx} cy={cy} r={12.5} />
            </clipPath>
            <image
              href={monsterPicture(theme, shownImage(quest, m), pt)}
              x={cx - 12.5}
              y={cy - 12.5}
              width={25}
              height={25}
              preserveAspectRatio="xMidYMid slice"
              clipPath={`url(#eclip-${m.id})`}
              opacity={m.state === 'dormant' ? 0.55 : 1}
              data-token-image={m.id}
            />
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
            {shownLetter(quest, m)}
          </text>
        )}
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
  for (const [li, l] of editorLetters(quest).entries()) {
    // A letter on its furniture or marker sits in the corner, so the piece can still be tapped.
    const cx = (l.at[0] + 0.5) * U + (l.onThing ? 11 : 0);
    const cy = (l.at[1] + 0.5) * U - (l.onThing ? 11 : 0);
    const missing = l.note === undefined;
    letterMarks.push(
      <g
        key={`lt${li}${l.letter}`}
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
            aria-label={
              missing
                ? t('editor.EditorBoard.letterNoNoteYet', 'Letter {letter}, no note yet', {
                    letter: l.letter,
                  })
                : t('editor.EditorBoard.questNote', 'Quest note {letter}', { letter: l.letter })
            }
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => {
              e.stopPropagation();
              // A letter with an action opens it; a letter with none gets its action made now.
              // The board stays on screen either way (the popup opens over it).
              const st = store.getState();
              if (l.note) st.setNoteId(l.note);
              else
                addAction(
                  store,
                  { kind: 'area', id: store.getState().quest.start.area ?? 'R01' },
                  l.letter,
                );
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
  let ghostSeq = 0; // one key per ghost square: two ghosts can cover the same square
  const ghostCells = (cs: readonly Cell[], valid: boolean) =>
    cs.map((c) => (
      <rect
        key={`g${ghostSeq++}`}
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
  else if (active && tool === 'tiles' && opts.tile.group === 'board')
    ghost.push(
      ...ghostCells(
        tileCellsFor(opts.tile.type, active.cell, opts.tileVariant, opts.tileTurned),
        preview?.ok ?? false,
      ),
    );
  else if (active && tool === 'tiles' && opts.tile.group === 'room')
    ghost.push(
      ...ghostCells(
        roomTileCellsFor(opts.tile.type, active.cell, opts.tileVariant, opts.tileTurned),
        preview?.ok ?? false,
      ),
    );
  else if (active && tool === 'doors' && opts.doorKind === 'tunnel')
    ghost.push(...ghostCells([active.cell], pendingTunnel ? (preview?.ok ?? false) : true));
  else if (active && ['monsters', 'markers', 'blocks', 'traps'].includes(tool) && preview)
    ghost.push(...ghostCells([active.cell], preview.ok));
  else if (active && tool === 'rock' && preview && !opts.rockRoom)
    ghost.push(...ghostCells([active.cell], preview.ok));
  if (tool === 'blocks' && pendingBlock) ghost.push(...ghostCells([pendingBlock], true));
  if (tool === 'doors' && opts.doorKind === 'tunnel' && pendingTunnel)
    ghost.push(...ghostCells([pendingTunnel], true));
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
  if (
    active &&
    tool === 'doors' &&
    (opts.doorKind === 'ironEntry' || opts.doorKind === 'woodenExit')
  ) {
    const target = active.outer
      ? active.outer
      : active.edge
        ? exteriorSideOf(quest, active.edge.a, active.edge.b)
        : undefined;
    if (target) {
      const [cx, cy] = target.cell;
      const x1 = target.side === 'e' ? cx + 1 : cx;
      const y1 = target.side === 's' ? cy + 1 : cy;
      const horizontal = target.side === 'n' || target.side === 's';
      ghost.push(
        <line
          key="outer"
          x1={x1 * U}
          y1={y1 * U}
          x2={(horizontal ? x1 + 1 : x1) * U}
          y2={(horizontal ? y1 : y1 + 1) * U}
          stroke={preview?.ok === false ? color.text : color.ink}
          strokeWidth={5}
          opacity={0.7}
          pointerEvents="none"
        />,
      );
    }
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
    <div className="ed-boardarea">
      <ZoomLayer
        className="ed-zoom"
        content={EDITOR_CONTENT}
        padding="0"
        onePointerPan={false}
        wheelPan
        strip={ZOOM_STRIP}
        fitHeight
      >
        <div className="ed-boardwrap">
          <svg
            ref={svgRef}
            data-flash-id={flash?.id}
            id="editor-board"
            role="application"
            aria-label={t(
              'editor.EditorBoard.questBoardArrowKeys',
              'Quest board. Arrow keys move the cursor, Enter acts.',
            )}
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
              <RockPattern id="ed-hatch" theme={theme} size={U} />
              <BoardArt id="ed-board-art" theme={theme} w={BOARD_W} h={BOARD_H} size={U} />
              {bad}
            </defs>
            {cells}
            {startTint}
            {zoneArt}
            {tileArt}
            {walls}
            {blockArt}
            {things}
            {doors}
            {featureArt}
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
        </div>
      </ZoomLayer>
      <p className="ed-hint" role="status">
        {hint}
      </p>
    </div>
  );
}
