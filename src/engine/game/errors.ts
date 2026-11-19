export type EventErrorCode =
  | 'UNKNOWN_DOOR'
  | 'UNKNOWN_ZONE'
  | 'ZONE_NOT_SEEN'
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
  | 'UNKNOWN_TUNNEL'
  | 'TUNNEL_NOT_SEEN'
  | 'TRAP_GONE'
  | 'TRAP_CANNOT'
  | 'BAD_RESULT'
  | 'UNKNOWN_ENDING'
  | 'UNKNOWN_FURNITURE'
  | 'NOT_A_CHEST'
  | 'FURNITURE_NOT_SEEN'
  | 'QUEST_ENDED'
  | 'NOT_A_TRIGGER'
  | 'CELL_NOT_SEEN'
  | 'UNKNOWN_NOTE'
  | 'NO_PENDING_CHOICE'
  | 'BAD_OPTION'
  | 'UNKNOWN_SPELL'
  | 'SPELL_USED'
  | 'SPELL_LIMIT'
  | 'MONSTER_INACTIVE'
  | 'ALREADY_DONE'
  | 'SPELL_DECLINED'
  | 'ALREADY_DEAD'
  | 'HERO_DEAD'
  | 'NOT_A_LOOK_SQUARE'
  | 'UNKNOWN_LINK'
  | 'WRONG_MAP';

export class EventError extends Error {
  readonly code: EventErrorCode;
  constructor(code: EventErrorCode, message: string) {
    super(message);
    this.name = 'EventError';
    this.code = code;
  }
}
