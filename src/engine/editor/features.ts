/**
 * Editor operations for the board features of expansion quests (Frozen Horror): ice tunnels, board
 * tiles, room tiles, edge doors, door flags, the way the heroes leave. Same style as `ops.ts`: pure,
 * the input is never changed, half done work comes back as warnings.
 */
import { board, inBoard, type Cell } from '../board/board';
import { outsideOf } from '../board/level';
import { forEachEffect } from '../quest/effects';
import { BOARD_TILE_TYPES, MAX_TUNNEL_PAIRS, ROOM_TILE_TYPES } from '../data/roomTiles';
import { EDGE_DOOR_KINDS, type Quest } from '../quest/schema';
import { referencesTo } from './refs';
import { clean, fail, isRockCell, newIssues, nextId, ok, type EditResult } from './result';

type BoardTileType = (typeof BOARD_TILE_TYPES)[number];
type RoomTileType = (typeof ROOM_TILE_TYPES)[number];
type EdgeKind = (typeof EDGE_DOOR_KINDS)[number];

const WIDTH = 26;
const HEIGHT = 19;
const onBoard = ([x, y]: Cell) =>
  Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT;

/**
 * Squares typed by a person: "3,4" squares split by spaces or semicolons, or a block "2,3-5,4"
 * (both corners). Returns undefined for text that is not squares.
 */
export function parseCells(text: string): Cell[] | undefined {
  const out: Cell[] = [];
  for (const part of text.split(/[;\s]+/).filter(Boolean)) {
    const block = /^(\d+),(\d+)-(\d+),(\d+)$/.exec(part);
    if (block) {
      const [x0, y0, x1, y1] = block.slice(1).map(Number) as [number, number, number, number];
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
        for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) out.push([x, y]);
      continue;
    }
    const one = /^(\d+),(\d+)$/.exec(part);
    if (!one) return undefined;
    out.push([Number(one[1]), Number(one[2])]);
  }
  return out.length > 0 ? out : undefined;
}

/** How the heroes leave when the stairs are not the way ("through the cave"). Empty clears it. */
export function setLeave(q: Quest, text: string): EditResult {
  const t = text.trim();
  const rest: Partial<Quest> = { ...q };
  delete rest.leave;
  const quest = (t === '' ? rest : { ...rest, leave: t }) as Quest;
  return ok(quest, newIssues(q, quest));
}

/** The texture pack the quest looks best with (an id). Only a hint. Empty clears it. */
export function setSuggestedPack(q: Quest, id: string): EditResult {
  const t = id.trim();
  const rest: Partial<Quest> = { ...q };
  delete rest.suggestedPack;
  const quest = (t === '' ? rest : { ...rest, suggestedPack: t }) as Quest;
  return ok(quest, newIssues(q, quest));
}

export function addTunnel(q: Quest, input: { design: number; a: Cell; b: Cell }): EditResult {
  if (q.tunnels.length >= MAX_TUNNEL_PAIRS)
    return fail(
      `Ice tunnels: the box has ${MAX_TUNNEL_PAIRS} pairs, and this quest uses them all.`,
    );
  if (!onBoard(input.a) || !onBoard(input.b)) return fail('A tunnel end must be on the board.');
  if (input.a[0] === input.b[0] && input.a[1] === input.b[1])
    return fail('The two ends of a tunnel must be different squares.');
  if (isRockCell(q, input.a) || isRockCell(q, input.b))
    return fail('A tunnel end must be on a floor square, not on rock.');
  if (!Number.isInteger(input.design) || input.design < 1 || input.design > 9)
    return fail('The design number is 1 to 9.');
  if (q.tunnels.some((t) => t.design === input.design))
    return fail(`Design ${input.design} is used by another tunnel.`);
  const id = nextId(
    'tun',
    q.tunnels.map((t) => t.id),
  );
  const tunnel = {
    id,
    design: input.design,
    a: [input.a[0], input.a[1]] as [number, number],
    b: [input.b[0], input.b[1]] as [number, number],
  };
  const quest = { ...q, tunnels: [...q.tunnels, tunnel] };
  return ok(quest, newIssues(q, quest));
}

/** The lowest design number (1 to 9) no tunnel uses yet, or undefined when all nine are used. */
export function nextTunnelDesign(q: Quest): number | undefined {
  for (let d = 1; d <= 9; d++) if (!q.tunnels.some((t) => t.design === d)) return d;
  return undefined;
}

/** The design the next tunnel gets: `wanted` when no tunnel uses it, else the first free one. */
export function pickTunnelDesign(q: Quest, wanted: number): number {
  return q.tunnels.some((t) => t.design === wanted) ? (nextTunnelDesign(q) ?? wanted) : wanted;
}

/** Give a tunnel another design number (1 to 9) that no other tunnel uses. */
export function setTunnelDesign(q: Quest, id: string, design: number): EditResult {
  const t = q.tunnels.find((x) => x.id === id);
  if (!t) return fail(`There is no tunnel ${id}.`);
  if (!Number.isInteger(design) || design < 1 || design > 9)
    return fail('The design number is 1 to 9.');
  if (q.tunnels.some((x) => x.id !== id && x.design === design))
    return fail(`Design ${design} is used by another tunnel.`);
  const quest = { ...q, tunnels: q.tunnels.map((x) => (x.id === id ? { ...x, design } : x)) };
  return ok(quest, newIssues(q, quest));
}

export function removeTunnel(q: Quest, id: string): EditResult {
  if (!q.tunnels.some((t) => t.id === id)) return fail(`There is no tunnel ${id}.`);
  const quest = { ...q, tunnels: q.tunnels.filter((t) => t.id !== id) };
  return ok(quest, newIssues(q, quest));
}

export function addBoardTile(
  q: Quest,
  input: { type: BoardTileType; cells: Cell[]; hiddenWhen?: string; blocks?: boolean },
): EditResult {
  if (!BOARD_TILE_TYPES.includes(input.type)) return fail('That is not a board tile.');
  if (input.cells.length === 0 || !input.cells.every(onBoard))
    return fail('A tile needs squares that are on the board.');
  const hiddenWhen = input.hiddenWhen?.trim() || undefined;
  if (input.blocks && !hiddenWhen)
    return fail('A tile that blocks needs a flag that takes it away.');
  const tile = clean({
    type: input.type,
    cells: input.cells.map((c) => [c[0], c[1]] as [number, number]),
    hiddenWhen,
    blocks: input.blocks || undefined,
  });
  const quest = { ...q, boardTiles: [...q.boardTiles, tile] };
  return ok(quest, newIssues(q, quest));
}

export function removeBoardTile(q: Quest, index: number): EditResult {
  if (!q.boardTiles[index]) return fail('There is no such tile.');
  const quest = { ...q, boardTiles: q.boardTiles.filter((_, i) => i !== index) };
  return ok(quest, newIssues(q, quest));
}

/** Put a tile in a room, or take it away (`null`). One tile per room. */
export function setRoomTile(q: Quest, area: string, type: RoomTileType | null): EditResult {
  if (!/^R\d\d$/.test(area)) return fail(`${area} is not a room.`);
  if (type !== null && !ROOM_TILE_TYPES.includes(type)) return fail('That is not a room tile.');
  const rest = q.roomTiles.filter((t) => t.area !== area);
  const quest = { ...q, roomTiles: type === null ? rest : [...rest, { type, area }] };
  return ok(quest, newIssues(q, quest));
}

/**
 * The exterior door an edge between two neighbouring squares asks for: the square that holds the
 * door and the side it faces. It works when one square is floor and the other is rock (the ice
 * cave lies over rock). Undefined for any other edge.
 */
export function exteriorSideOf(
  q: Quest,
  a: Cell,
  b: Cell,
): { cell: Cell; side: 'n' | 'e' | 's' | 'w' } | undefined {
  const [floor, rock] = isRockCell(q, b) && !isRockCell(q, a) ? [a, b] : [b, a];
  if (!isRockCell(q, rock) || isRockCell(q, floor)) return undefined;
  const dx = rock[0] - floor[0];
  const dy = rock[1] - floor[1];
  if (Math.abs(dx) + Math.abs(dy) !== 1) return undefined;
  return { cell: floor, side: dx === 1 ? 'e' : dx === -1 ? 'w' : dy === 1 ? 's' : 'n' };
}

const EDGE_ID: Record<EdgeKind, string> = { ironEntry: 'in', woodenExit: 'out' };

/** First free id of the form `in`, `in2`, `in3`... across every door of the quest. */
function freeDoorId(q: Quest, base: string): string {
  const taken = new Set(
    [...q.doors, ...q.secretDoors, ...q.falseDoors, ...q.edgeDoors].map((d) => d.id),
  );
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}${n}`)) n++;
  return `${base}${n}`;
}

/** Why a square and side cannot hold an exterior door, or undefined. */
function edgeDoorProblem(
  q: Quest,
  cell: Cell,
  side: 'n' | 'e' | 's' | 'w',
  kind: EdgeKind,
  skipId?: string,
): string | undefined {
  if (!onBoard(cell)) return 'The door square must be on the board.';
  const out = outsideOf(cell, side);
  if (inBoard(board, out[0], out[1]) && !isRockCell(q, out))
    return 'An exterior door goes on the outer edge of the board, or on an edge that touches rock.';
  if (isRockCell(q, cell)) return 'An exterior door cannot sit on a rock square.';
  if (
    q.edgeDoors.some(
      (e) => e.id !== skipId && e.cell[0] === cell[0] && e.cell[1] === cell[1] && e.side === side,
    )
  )
    return 'There is an exterior door on that edge already.';
  if (kind === 'ironEntry' && q.edgeDoors.some((e) => e.id !== skipId && e.kind === 'ironEntry'))
    return 'The quest has an iron entry door already. There is only one.';
  return undefined;
}

/** An exterior door: an iron entry or a wooden exit on the outer edge of a square. */
export function addEdgeDoor(
  q: Quest,
  input: { cell: Cell; side: 'n' | 'e' | 's' | 'w'; kind: EdgeKind },
): EditResult {
  if (!EDGE_DOOR_KINDS.includes(input.kind)) return fail('That is not an exterior door.');
  const problem = edgeDoorProblem(q, input.cell, input.side, input.kind);
  if (problem) return fail(problem);
  const id = freeDoorId(q, EDGE_ID[input.kind]);
  const quest = {
    ...q,
    edgeDoors: [
      ...q.edgeDoors,
      { id, ...input, cell: [input.cell[0], input.cell[1]] as [number, number] },
    ],
  };
  return ok(quest, newIssues(q, quest));
}

/** Change an exterior door between iron entry and wooden exit. The start door must stay iron. */
export function setEdgeDoorKind(q: Quest, id: string, kind: EdgeKind): EditResult {
  const e = q.edgeDoors.find((x) => x.id === id);
  if (!e) return fail(`There is no exterior door ${id}.`);
  if (e.kind === kind) return ok(q);
  if (kind !== 'ironEntry' && q.start.door === id)
    return fail('The heroes start outside this door. Pick another start first.');
  const problem = edgeDoorProblem(q, e.cell, e.side, kind, id);
  if (problem) return fail(problem);
  const quest = {
    ...q,
    edgeDoors: q.edgeDoors.map((x) => (x.id === id ? { ...x, kind } : x)),
  };
  return ok(quest, newIssues(q, quest));
}

export function removeEdgeDoor(q: Quest, id: string): EditResult {
  if (!q.edgeDoors.some((e) => e.id === id)) return fail(`There is no edge door ${id}.`);
  const quest = { ...q, edgeDoors: q.edgeDoors.filter((e) => e.id !== id) };
  return ok(quest, [...referencesTo(quest, 'door', id), ...newIssues(q, quest)]);
}

/** Where the heroes start: outside an edge door, or in a room (stairway, or an ice cave tile). */
export function setStart(
  q: Quest,
  start: { door: string } | { area: string; kind?: 'stairway' | 'tile' },
): EditResult {
  if ('door' in start) {
    const door = q.edgeDoors.find((e) => e.id === start.door);
    if (!door) return fail(`There is no edge door ${start.door}.`);
    if (door.kind !== 'ironEntry') return fail('The heroes start outside an iron entry door.');
  }
  const quest = { ...q, start: clean(start) } as Quest;
  return ok(quest, newIssues(q, quest));
}

/** A door that is hidden or locked until a flag is set. An empty text clears the flag. */
export function setDoorFlags(
  q: Quest,
  doorId: string,
  flags: { hiddenUntil?: string; lockedUntil?: string },
): EditResult {
  const lists = ['doors', 'secretDoors', 'falseDoors'] as const;
  const list = lists.find((l) => q[l].some((d) => d.id === doorId));
  if (!list) return fail(`There is no door ${doorId}.`);
  const door = q[list].find((d) => d.id === doorId)!;
  const pick = (v: string | undefined, old: string | undefined) =>
    v === undefined ? old : v.trim() || undefined;
  const next = clean({
    ...door,
    hiddenUntil: pick(flags.hiddenUntil, door.hiddenUntil),
    lockedUntil: pick(flags.lockedUntil, door.lockedUntil),
  });
  const quest = { ...q, [list]: q[list].map((d) => (d.id === doorId ? next : d)) };
  return ok(quest, newIssues(q, quest));
}

/** The flags the quest's actions set, sorted. Suggestions for a flag field. */
export function knownFlags(q: Quest): string[] {
  const out = new Set<string>();
  forEachEffect(q, (e) => {
    if (e.type === 'setFlag') out.add(e.flag);
  });
  return [...out].sort();
}
