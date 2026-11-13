import type { Cell } from '../board/board';
import type { Hero } from '../data/heroes';

/**
 * Every change to the game is one of these events. The event log is the save file:
 * state = replay(level, seed, events). Events are plain JSON.
 *
 * Later milestones add: SQUARE_TRIGGER, AREA_ENTER,
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
  | { readonly type: 'ZARGON_TURN_END' }
  /** A hero searches a revealed room for treasure (once per hero per room). `override` skips the
   *  "monsters in the room" guard: the players confirm the room is clear. */
  | {
      readonly type: 'SEARCH_TREASURE';
      readonly room: string;
      readonly hero: Hero;
      readonly override?: boolean | undefined;
    }
  /** A treasure card said "wandering monster": the quest's wandering monster joins the roster. */
  | { readonly type: 'WANDERING_MONSTER'; readonly room: string; readonly hero: Hero }
  /** Search for secret doors in a room (`area`) or in a corridor in sight of `cell`. */
  | {
      readonly type: 'SEARCH_SECRET_DOORS';
      readonly hero: Hero;
      readonly area?: string | undefined;
      readonly cell?: Cell | undefined;
      readonly override?: boolean | undefined;
    }
  /** Jump a seen trap: one combat die, a skull springs it. */
  | { readonly type: 'TRAP_JUMP'; readonly trap: string; readonly result: 'skull' | 'ok' }
  /** Disarm a seen trap. The Dwarf fails on a black shield, a tool kit fails on a skull. */
  | {
      readonly type: 'TRAP_DISARM';
      readonly trap: string;
      readonly by: 'dwarf' | 'toolkit';
      readonly result: 'skull' | 'blackShield' | 'other';
    }
  /** A hero steps on a seen trap: it springs. */
  | { readonly type: 'TRAP_STEP'; readonly trap: string };

export type EventType = GameEvent['type'];
