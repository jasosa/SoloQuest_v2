/**
 * Editor operations for the board features of expansion quests (Frozen Horror): ice tunnels, board
 * tiles, room tiles, edge doors, door flags, the way the heroes leave. Same style as `ops.ts`: pure,
 * the input is never changed, half done work comes back as warnings.
 */
import type { Cell } from '../board/board';
import { BOARD_TILE_TYPES, ROOM_TILE_TYPES } from '../data/roomTiles';
import { EDGE_DOOR_KINDS, type Quest } from '../quest/schema';
import { clean, fail, newIssues, nextId, ok, type EditResult } from './result';

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
  if (!onBoard(input.a) || !onBoard(input.b)) return fail('A tunnel end must be on the board.');
  if (input.a[0] === input.b[0] && input.a[1] === input.b[1])
    return fail('The two ends of a tunnel must be different squares.');
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

export function addEdgeDoor(
  q: Quest,
  input: { cell: Cell; side: 'n' | 'e' | 's' | 'w'; kind: EdgeKind },
): EditResult {
  if (!onBoard(input.cell)) return fail('The door square must be on the board.');
  if (!EDGE_DOOR_KINDS.includes(input.kind)) return fail('That is not an edge door.');
  const id = nextId(
    'e',
    q.edgeDoors.map((e) => e.id),
  );
  const quest = {
    ...q,
    edgeDoors: [
      ...q.edgeDoors,
      { id, ...input, cell: [input.cell[0], input.cell[1]] as [number, number] },
    ],
  };
  return ok(quest, newIssues(q, quest));
}

export function removeEdgeDoor(q: Quest, id: string): EditResult {
  if (!q.edgeDoors.some((e) => e.id === id)) return fail(`There is no edge door ${id}.`);
  const quest = { ...q, edgeDoors: q.edgeDoors.filter((e) => e.id !== id) };
  return ok(quest, newIssues(q, quest));
}

/** Where the heroes start: outside an edge door, or in a room (stairway, or an ice cave tile). */
export function setStart(
  q: Quest,
  start: { door: string } | { area: string; kind?: 'stairway' | 'tile' },
): EditResult {
  if ('door' in start && !q.edgeDoors.some((e) => e.id === start.door))
    return fail(`There is no edge door ${start.door}.`);
  const quest = { ...q, start: clean(start) } as Quest;
  return ok(quest, newIssues(q, quest));
}

/** A door that is hidden or locked until a flag is set. An empty text clears the flag. */
export function setDoorFlags(
  q: Quest,
  doorId: string,
  flags: { hiddenUntil?: string; lockedUntil?: string },
): EditResult {
  const door = q.doors.find((d) => d.id === doorId);
  if (!door) return fail(`There is no door ${doorId}.`);
  const pick = (v: string | undefined, old: string | undefined) =>
    v === undefined ? old : v.trim() || undefined;
  const next = clean({
    ...door,
    hiddenUntil: pick(flags.hiddenUntil, door.hiddenUntil),
    lockedUntil: pick(flags.lockedUntil, door.lockedUntil),
  });
  const quest = { ...q, doors: q.doors.map((d) => (d.id === doorId ? next : d)) };
  return ok(quest, newIssues(q, quest));
}
