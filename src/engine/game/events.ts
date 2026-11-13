import type { Cell } from '../board/board';

/**
 * Every change to the game is one of these events. The event log is the save file:
 * state = replay(level, seed, events). Events are plain JSON.
 *
 * Later milestones add: SEARCH_TREASURE, SEARCH_SECRET_DOORS, TRAP_JUMP, TRAP_DISARM, TRAP_STEP,
 * MONSTER_DAMAGE, MONSTER_KILL, WANDERING_MONSTER, SQUARE_TRIGGER, AREA_ENTER,
 * ZARGON_TURN_START, ZARGON_TURN_END, NOTE_ACK, END_QUEST. Add them to this union and handle
 * them in reducer.ts.
 */
export type GameEvent =
  /** Open a door that was seen. `door` is a door id from the quest (normal, secret or false). */
  | { readonly type: 'OPEN_DOOR'; readonly door: string }
  /** Show what a hero standing on a seen corridor square can see. */
  | { readonly type: 'LOOK_FROM'; readonly cell: Cell };

export type EventType = GameEvent['type'];
