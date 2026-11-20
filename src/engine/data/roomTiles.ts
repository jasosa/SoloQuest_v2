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

/**
 * Tiles that are drawn on squares, not tied to one room (Frozen Horror): the ice cave entrance
 * (the heroes start on it, and it lies over rock) and the cage of a cage room. The built-in look is
 * a labeled outline; a texture pack can give them a picture later.
 */
export const BOARD_TILE_TYPES = [
  'iceCaveEntrance',
  'cage',
  'icyRiver',
  'iceLedge',
  'chasm',
  'slipperyIce',
] as const;
export type BoardTileType = (typeof BOARD_TILE_TYPES)[number];

/** Width and height in squares of a tile as it comes in the box (it can be laid turned). */
export type Footprint = readonly [number, number];

export interface BoardTileDef {
  readonly id: BoardTileType;
  readonly name: string;
  /**
   * `fixed`: a tile of one of the `footprints` (a rectangle, laid on the board with a quarter turn
   * if the author wants). `laid`: terrain laid square by square, any shape; one square is its
   * footprint.
   */
  readonly shape: 'fixed' | 'laid';
  /** The sizes it comes in (width x height). A turned tile swaps the two. */
  readonly footprints: readonly Footprint[];
  /** Drawn from the start, even on squares the heroes have not seen (the cave under the start). */
  readonly always: boolean;
  /** Terrain: it changes no sight, but its rule is a reminder the players may want (decision 57). */
  readonly terrain?: boolean;
  readonly rule: readonly string[];
}

export const BOARD_TILES: Readonly<Record<BoardTileType, BoardTileDef>> = {
  iceCaveEntrance: {
    id: 'iceCaveEntrance',
    shape: 'fixed',
    footprints: [[6, 5]],
    name: 'Ice cave entrance',
    always: true,
    rule: ['The heroes start here, outside the iron door, and leave here when the quest says so.'],
  },
  icyRiver: {
    id: 'icyRiver',
    shape: 'laid',
    footprints: [[1, 1]],
    name: 'Icy river',
    always: false,
    terrain: true,
    rule: [
      'Each square of the river counts as 2 squares for movement.',
      'Each time a hero enters an icy river square, roll 1 combat die: a white shield costs 1 Body Point to the cold.',
      'Monsters feel neither the extra cost nor the cold.',
    ],
  },
  iceLedge: {
    id: 'iceLedge',
    shape: 'laid',
    footprints: [[1, 1]],
    name: 'Ice ledge',
    always: false,
    terrain: true,
    rule: [
      'The ledge around the crevasse is very slippery. When a hero steps through a door onto their first square here, roll 1 combat die: a skull or a white shield is safe, so keep moving.',
      'A black shield: the hero starts to slip and loses 1 Body Point, then rolls another die at once. A second black shield: the hero falls into the crevasse and is lost for good. Any other roll: back to the square they came in on, and the turn ends.',
      'At the start of any turn in which a hero is on the ledge, they must make this roll first.',
    ],
  },
  chasm: {
    id: 'chasm',
    shape: 'laid',
    footprints: [[1, 1]],
    name: 'Chasm',
    always: false,
    terrain: true,
    rule: ['A crevasse. It can be jumped over like a pit. A hero who falls in is lost for good.'],
  },
  slipperyIce: {
    id: 'slipperyIce',
    shape: 'fixed',
    footprints: [
      [1, 1],
      [2, 1],
      [3, 1],
      [3, 2],
    ],
    name: 'Slippery ice',
    always: false,
    terrain: true,
    rule: [
      'Put the slippery ice tile over these squares. It cannot be found or disarmed, and monsters are not affected by it.',
      'Whenever a hero moves onto one of its squares, roll 1 combat die. On a white shield the hero falls and the turn ends. A fallen hero cannot act or defend until their next turn. Roll again for every ice square moved onto.',
    ],
  },
  cage: {
    id: 'cage',
    shape: 'fixed',
    footprints: [[2, 2]],
    name: 'Cage',
    always: false,
    rule: ['Nobody can enter the cage and it blocks line of sight, until the quest opens it.'],
  },
};

/** "6 x 5" or "2 x 1 or 2 x 3": the sizes a board tile comes in, for the editor. */
export function footprintText(def: BoardTileDef): string {
  if (def.shape === 'laid') return 'square by square';
  return def.footprints.map(([w, h]) => `${w} x ${h}`).join(' or ');
}
