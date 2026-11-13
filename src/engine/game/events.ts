import type { Cell } from '../board/board';

/**
 * Every change to the game is one of these events. The event log is the save file:
 * state = replay(level, seed, events). Events are plain JSON.
 *
 * Later milestones add: SEARCH_TREASURE, SEARCH_SECRET_DOORS, TRAP_JUMP, TRAP_DISARM, TRAP_STEP,
 * WANDERING_MONSTER, SQUARE_TRIGGER, AREA_ENTER,
 * ZARGON_TURN_START, NOTE_ACK, END_QUEST. Add them to this union and handle
 * them in reducer.ts, and add them to EventSchema in src/persist/saves.ts (it will not compile
 * until you do).
 */
export type GameEvent =
  /** Open a door that was seen. `door` is a door id from the quest (normal, secret or false). */
  | { readonly type: 'OPEN_DOOR'; readonly door: string }
  /** Show what a hero standing on a seen corridor square can see. */
  | { readonly type: 'LOOK_FROM'; readonly cell: Cell }
  /** A seen monster loses Body Points (integer >= 1). At 0 it is dead. */
  | { readonly type: 'MONSTER_DAMAGE'; readonly monster: string; readonly amount: number }
  /** A seen, living monster regains Body Points, up to its maximum. */
  | { readonly type: 'MONSTER_HEAL'; readonly monster: string; readonly amount: number }
  /** A seen monster dies at once (body 0). */
  | { readonly type: 'MONSTER_KILL'; readonly monster: string }
  /** End of a Zargon turn: the turn counter goes up by one. */
  | { readonly type: 'ZARGON_TURN_END' };

export type EventType = GameEvent['type'];
