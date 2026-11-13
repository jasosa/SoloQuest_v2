export type EventErrorCode =
  | 'UNKNOWN_DOOR'
  | 'DOOR_NOT_SEEN'
  | 'ALREADY_OPEN'
  | 'BAD_CELL'
  | 'NOT_A_SEEN_CORRIDOR_CELL'
  | 'UNKNOWN_MONSTER'
  | 'MONSTER_NOT_SEEN'
  | 'MONSTER_DEAD'
  | 'BAD_AMOUNT'
  | 'UNKNOWN_HERO'
  | 'NOT_A_ROOM'
  | 'BAD_AREA'
  | 'ROOM_NOT_REVEALED'
  | 'ALREADY_SEARCHED'
  | 'MONSTERS_IN_ROOM'
  | 'BAD_TARGET'
  | 'NO_WANDERING'
  | 'UNKNOWN_TRAP'
  | 'TRAP_NOT_SEEN'
  | 'TRAP_GONE'
  | 'TRAP_CANNOT'
  | 'BAD_RESULT';

export class EventError extends Error {
  readonly code: EventErrorCode;
  constructor(code: EventErrorCode, message: string) {
    super(message);
    this.name = 'EventError';
    this.code = code;
  }
}
