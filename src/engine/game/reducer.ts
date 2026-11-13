/**
 * The reducer: the only way the game state changes.
 *
 *   reduce(level, state, event) -> { state, prompts }
 *
 * Pure: no clock, no Math.random. The input state is never modified. An invalid event throws an
 * EventError (before anything is changed), so a bad tap can never corrupt the state; the caller
 * decides whether to show the message. A stored event log only ever holds valid events.
 *
 * Undo is "drop the last event and replay" (see `undo`).
 */
import { inBoard, areaAt, type Cell } from '../board/board';
import { keyOf, type CellKey, type Level } from '../board/level';
import type { GameEvent } from './events';
import { progress, revealFrom, revealRoom } from './reveal';
import { draftOf, emptyState, type Draft, type GameState } from './state';

/** Messages for the UI, produced by the reducer. */
export type Prompt =
  /** Something new is now visible. `cells` are the newly known squares, `origin` is where the
   *  reveal starts, in board units (a cell center is x + 0.5, y + 0.5). */
  | {
      readonly kind: 'revealed';
      readonly cells: readonly CellKey[];
      readonly origin: readonly [number, number];
    }
  /** The action showed nothing new. */
  | { readonly kind: 'nothingNew' };

export interface Reduced {
  readonly state: GameState;
  readonly prompts: readonly Prompt[];
}

export type EventErrorCode =
  'UNKNOWN_DOOR' | 'DOOR_NOT_SEEN' | 'ALREADY_OPEN' | 'BAD_CELL' | 'NOT_A_SEEN_CORRIDOR_CELL';

export class EventError extends Error {
  readonly code: EventErrorCode;
  constructor(code: EventErrorCode, message: string) {
    super(message);
    this.name = 'EventError';
    this.code = code;
  }
}

/** State at the start of the quest: the start room is revealed. */
export function initialState(level: Level, seed: number): GameState {
  const d = draftOf(emptyState(seed));
  revealRoom(level, d, level.quest.start.area);
  return d;
}

export function reduce(level: Level, state: GameState, event: GameEvent): Reduced {
  switch (event.type) {
    case 'OPEN_DOOR':
      return openDoor(level, state, event.door);
    case 'LOOK_FROM':
      return lookFrom(level, state, event.cell);
    default: {
      const never: never = event;
      throw new Error(`Unhandled event ${JSON.stringify(never)}`);
    }
  }
}

/** Rebuild the state from the start. Throws if an event is invalid. */
export function replay(level: Level, seed: number, events: readonly GameEvent[]): GameState {
  let state = initialState(level, seed);
  for (const e of events) state = reduce(level, state, e).state;
  return state;
}

/** Drop the last event and replay. With no events, nothing changes. */
export function undo(
  level: Level,
  seed: number,
  events: readonly GameEvent[],
): { events: readonly GameEvent[]; state: GameState } {
  const rest = events.slice(0, -1);
  return { events: rest, state: replay(level, seed, rest) };
}

function finish(
  d: Draft,
  before: number,
  cells: CellKey[],
  origin: [number, number],
  quiet: boolean,
): Reduced {
  if (progress(d) !== before || cells.length > 0)
    return { state: d, prompts: [{ kind: 'revealed', cells, origin }] };
  return { state: d, prompts: quiet ? [] : [{ kind: 'nothingNew' }] };
}

function openDoor(level: Level, state: GameState, doorId: string): Reduced {
  const door = level.doors.get(doorId);
  if (!door) throw new EventError('UNKNOWN_DOOR', `Unknown door ${doorId}`);
  if (!state.seenDoors.has(doorId))
    throw new EventError('DOOR_NOT_SEEN', `Door ${doorId} has not been seen yet`);
  if (state.openDoors.has(doorId))
    throw new EventError('ALREADY_OPEN', `Door ${doorId} is already open`);

  const d = draftOf(state);
  const origin: [number, number] = [
    (door.a[0] + door.b[0] + 1) / 2,
    (door.a[1] + door.b[1] + 1) / 2,
  ];
  const before = progress(d);
  d.openDoors.add(doorId);
  // A false door looks like a door but nothing is behind it: it opens, shows nothing, still blocks.
  if (door.kind === 'false') return { state: d, prompts: [{ kind: 'nothingNew' }] };

  // A room on either side that is not revealed whole is revealed now. A corridor square is
  // looked from when the other side is a room the heroes already stand in (the square beyond
  // the door), unless it was looked from before.
  const sides = [door.a, door.b];
  const roomSeenBefore = sides.map((c) => {
    const area = areaAt(level.board, c[0], c[1]);
    return area !== undefined && area !== 'C' && d.revealedRooms.has(area);
  });
  const cells: CellKey[] = [];
  sides.forEach((c, i) => {
    const area = areaAt(level.board, c[0], c[1]);
    if (area === undefined) return;
    if (area !== 'C') {
      if (!d.revealedRooms.has(area)) cells.push(...revealRoom(level, d, area).cells);
    } else if (roomSeenBefore[1 - i] && !d.looked.has(keyOf(c))) {
      d.looked.add(keyOf(c));
      cells.push(...revealFrom(level, d, c).cells);
    }
  });
  return finish(d, before, cells, origin, true);
}

function lookFrom(level: Level, state: GameState, cell: Cell): Reduced {
  const [x, y] = cell;
  if (!Number.isInteger(x) || !Number.isInteger(y) || !inBoard(level.board, x, y))
    throw new EventError('BAD_CELL', `Cell ${x},${y} is outside the board`);
  if (areaAt(level.board, x, y) !== 'C' || !state.seenCells.has(keyOf(cell)))
    throw new EventError(
      'NOT_A_SEEN_CORRIDOR_CELL',
      `Cell ${x},${y} is not a seen corridor square`,
    );

  const d = draftOf(state);
  const before = progress(d);
  d.looked.add(keyOf(cell));
  const { cells } = revealFrom(level, d, cell);
  return finish(d, before, cells, [x + 0.5, y + 0.5], false);
}
