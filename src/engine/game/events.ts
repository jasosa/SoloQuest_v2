import type { Cell } from '../board/board';
import type { Hero } from '../data/heroes';

/**
 * Every change to the game is one of these events. The event log is the save file:
 * state = replay(level, seed, events). Events are plain JSON.
 *
 * To add an event: add it to this union, handle it in reducer.ts, and add it to EventSchema in
 * src/persist/saves.ts (it will not compile until you do).
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
      readonly area?: string | undefined;
      readonly cell?: Cell | undefined;
      readonly override?: boolean | undefined;
    }
  /** Search a chest for traps (chests only, once per chest, any hero). `override` skips the
   *  "monsters in the room" guard. */
  | {
      readonly type: 'SEARCH_TRAPS';
      readonly furniture: string;
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
  | { readonly type: 'TRAP_STEP'; readonly trap: string }
  /** A hero entered a revealed room that has an `areaEntered` note. */
  | { readonly type: 'AREA_ENTER'; readonly area: string }
  /** A hero is on a seen square that has a `squareEntered` note. */
  | { readonly type: 'SQUARE_TRIGGER'; readonly cell: Cell }
  /** The players pressed the confirm button of an objective (Quest sheet). */
  | { readonly type: 'CONFIRM_OBJECTIVE'; readonly objective: string }
  /** The players pressed the button of a `manual` note. */
  | { readonly type: 'MANUAL_TRIGGER'; readonly note: string }
  /** The players picked option number `option` (0-based) of a pending `promptChoice`. */
  | { readonly type: 'CHOOSE'; readonly note: string; readonly option: number }
  /** A named monster cast one of its Dread spells (once per quest per listing; `onePerTurn` limits a turn). */
  | { readonly type: 'SPELL_CAST'; readonly monster: string; readonly spell: string }
  /** A hero died (decision 32). Only the fact is tracked. Once per hero; undo to take it back. */
  | { readonly type: 'HERO_DIED'; readonly hero: Hero }
  /** The players said this spell could not be cast this turn. The order offers the next one. */
  | { readonly type: 'SPELL_FAILED'; readonly monster: string; readonly spell: string }
  /** The players carried out the order of a monster this Zargon turn. Once per monster per turn. */
  | { readonly type: 'MONSTER_DONE'; readonly monster: string }
  /** The quest is over: the heroes left by the stairs, or all of them fell. Only once. */
  | { readonly type: 'END_QUEST'; readonly outcome: 'stairs' | 'fell' }
  /** The quest is over by one of the quest's own endings (`quest.endings`), for example an NPC died. */
  | { readonly type: 'END_QUEST'; readonly outcome: 'ending'; readonly ending: string };

export type EventType = GameEvent['type'];
