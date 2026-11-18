/**
 * Room tiles of the Frozen Horror (decision 55): a room with its own look and its own rule. A quest
 * says which room holds which tile (`roomTiles`). The engine only keeps the rule text for the room
 * note: hero hits and rolls stay with the players. Texts are our own words.
 */

export const ROOM_TILE_TYPES = [
  'iceVault',
  'scepterRoom',
  'livingFog',
  'chasmRoom',
  'frozenCrypt',
  'seatOfPower',
  'cageRoom',
  'gremlinTreasure',
] as const;
export type RoomTileType = (typeof ROOM_TILE_TYPES)[number];

export interface RoomTileDef {
  readonly id: RoomTileType;
  readonly name: string;
  /** The box it comes from. */
  readonly box: string;
  /** What the players should remember about this room. */
  readonly rule: readonly string[];
}

export const ROOM_TILES: Readonly<Record<RoomTileType, RoomTileDef>> = {
  iceVault: {
    id: 'iceVault',
    name: 'Ice Vault',
    box: 'Frozen Horror',
    rule: [
      'The cold drains heroes. Each turn a hero enters or stays in this room, roll 1 combat die: a skull costs 1 Body Point.',
      'Monsters do not feel it.',
    ],
  },
  scepterRoom: {
    id: 'scepterRoom',
    name: 'Scepter Room',
    box: 'Frozen Horror',
    rule: ['The Frozen Horror hid the Scepter of Glacial Majesty in this room.'],
  },
  livingFog: {
    id: 'livingFog',
    name: 'Living Fog Room',
    box: 'Frozen Horror',
    rule: [
      'Swirling fog fills the room. Monsters seem to appear on every side and vanish into the fog when attacked.',
      'The quest notes say how the fog changes an attack.',
    ],
  },
  chasmRoom: {
    id: 'chasmRoom',
    name: 'Bottomless Chasm Room',
    box: 'Frozen Horror',
    rule: [
      'A crevasse divides this room. It can be jumped over like a pit.',
      'A hero who falls in is lost for good.',
    ],
  },
  frozenCrypt: {
    id: 'frozenCrypt',
    name: 'Frozen Crypt Room',
    box: 'Frozen Horror',
    rule: [
      'Monsters are frozen in thick ice here. They are freed when a hero opens the door the quest names.',
    ],
  },
  seatOfPower: {
    id: 'seatOfPower',
    name: 'Seat of Power Room',
    box: 'Frozen Horror',
    rule: ['The Frozen Horror rules from this room.'],
  },
  cageRoom: {
    id: 'cageRoom',
    name: 'Cage Room',
    box: 'Frozen Horror',
    rule: ['A prison for servants who displeased the Frozen Horror.'],
  },
  gremlinTreasure: {
    id: 'gremlinTreasure',
    name: 'Ice Gremlin Treasure Room',
    box: 'Frozen Horror',
    rule: [
      'The Ice Gremlins keep everything they steal here. Items stolen from the heroes in this quest can be won back.',
    ],
  },
};

/** The tile of a room in a quest (the room after merges), or undefined. */
export function roomTileOf(
  quest: { readonly roomTiles: readonly { readonly type: RoomTileType; readonly area: string }[] },
  area: string,
): RoomTileDef | undefined {
  const t = quest.roomTiles.find((x) => x.area === area);
  return t ? ROOM_TILES[t.type] : undefined;
}
