/**
 * Tiles of the Frozen Horror (decisions 55 and 88). Every tile is a physical piece of a fixed size,
 * and the box holds a limited number of each: `footprints` are the sizes it comes in (laid turned
 * too) and `maxPerSize` how many of each size one quest may use. A room tile lies over squares, not
 * over one room: it may cover parts of two rooms and corridor squares. The engine only keeps the
 * rule text: hero hits and rolls stay with the players. Texts are our own words.
 */

/** Width and height in squares of a tile as it comes in the box (it can be laid turned). */
export type Footprint = readonly [number, number];

/** Ice tunnels in the box: three pairs, one square each end. */
export const MAX_TUNNEL_PAIRS = 3;
/** An ice slide is a straight run of this many squares. */
export const ICE_SLIDE_LENGTH = 8;

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
  /** The sizes it comes in (width x height). A turned tile swaps the two. */
  readonly footprints: readonly Footprint[];
  /** How many of each size one quest may use. */
  readonly maxPerSize: number;
  /** What the players should remember about this room. */
  readonly rule: readonly string[];
}

export const ROOM_TILES: Readonly<Record<RoomTileType, RoomTileDef>> = {
  iceVault: {
    id: 'iceVault',
    footprints: [
      [3, 2],
      [4, 3],
    ],
    maxPerSize: 1,
    name: 'Ice Vault',
    box: 'Frozen Horror',
    rule: [
      'The cold drains heroes. Each turn a hero enters or stays in this room, roll 1 combat die: a skull costs 1 Body Point.',
      'Monsters do not feel it.',
    ],
  },
  scepterRoom: {
    id: 'scepterRoom',
    footprints: [[4, 4]],
    maxPerSize: 1,
    name: 'Scepter Room',
    box: 'Frozen Horror',
    rule: ['The Frozen Horror hid the Scepter of Glacial Majesty in this room.'],
  },
  livingFog: {
    id: 'livingFog',
    footprints: [[4, 4]],
    maxPerSize: 1,
    name: 'Living Fog Room',
    box: 'Frozen Horror',
    rule: [
      'Swirling fog fills the room. Monsters seem to appear on every side and vanish into the fog when attacked.',
      'The quest notes say how the fog changes an attack.',
    ],
  },
  chasmRoom: {
    id: 'chasmRoom',
    footprints: [[4, 4]],
    maxPerSize: 1,
    name: 'Bottomless Chasm Room',
    box: 'Frozen Horror',
    rule: [
      'A crevasse divides this room. It can be jumped over like a pit.',
      'A hero who falls in is lost for good.',
    ],
  },
  frozenCrypt: {
    id: 'frozenCrypt',
    footprints: [[5, 3]],
    maxPerSize: 1,
    name: 'Frozen Crypt Room',
    box: 'Frozen Horror',
    rule: [
      'Monsters are frozen in thick ice here. They are freed when a hero opens the door the quest names.',
    ],
  },
  seatOfPower: {
    id: 'seatOfPower',
    footprints: [[6, 5]],
    maxPerSize: 1,
    name: 'Seat of Power Room',
    box: 'Frozen Horror',
    rule: ['The Frozen Horror rules from this room.'],
  },
  cageRoom: {
    id: 'cageRoom',
    footprints: [[4, 4]],
    maxPerSize: 1,
    name: 'Cage Room',
    box: 'Frozen Horror',
    rule: ['A prison for servants who displeased the Frozen Horror.'],
  },
  gremlinTreasure: {
    id: 'gremlinTreasure',
    footprints: [[4, 3]],
    maxPerSize: 1,
    name: 'Ice Gremlin Treasure Room',
    box: 'Frozen Horror',
    rule: [
      'The Ice Gremlins keep everything they steal here. Items stolen from the heroes in this quest can be won back.',
    ],
  },
};

/**
 * Tiles that are drawn on squares, not tied to one room (Frozen Horror): the ice cave entrance
 * (the heroes start on it, and it lies over rock) and the terrain. The built-in look is
 * a labeled outline; a texture pack can give them a picture later.
 */
export const BOARD_TILE_TYPES = [
  'iceCaveEntrance',
  'icyRiver',
  'iceLedge',
  'chasm',
  'slipperyIce',
] as const;
export type BoardTileType = (typeof BOARD_TILE_TYPES)[number];

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
  /** How many of each size one quest may use (none: no limit stated). */
  readonly maxPerSize?: number;
  /**
   * Not in the editor palette (decision 94): chasm squares were replaced by the Bottomless Chasm
   * Room tile. Old files that have them still load and play.
   */
  readonly notInPalette?: boolean;
  readonly rule: readonly string[];
}

export const BOARD_TILES: Readonly<Record<BoardTileType, BoardTileDef>> = {
  iceCaveEntrance: {
    id: 'iceCaveEntrance',
    shape: 'fixed',
    footprints: [[6, 5]],
    maxPerSize: 1,
    name: 'Ice cave entrance',
    always: true,
    rule: ['The heroes start here, outside the iron door, and leave here when the quest says so.'],
  },
  icyRiver: {
    id: 'icyRiver',
    shape: 'fixed',
    footprints: [
      [1, 8],
      [1, 3],
    ],
    maxPerSize: 1,
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
    shape: 'fixed',
    footprints: [[5, 3]],
    maxPerSize: 1,
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
    notInPalette: true,
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
};

/** "6 x 5" or "2 x 1 or 2 x 3": the sizes a board tile comes in, for the editor. */
export function footprintText(def: BoardTileDef): string {
  if (def.shape === 'laid') return 'square by square';
  return def.footprints.map(([w, h]) => `${w} x ${h}`).join(' or ');
}

/** The index of the footprint a w x h rectangle matches (turned or not), or -1. */
export function footprintIndex(footprints: readonly Footprint[], w: number, h: number): number {
  return footprints.findIndex(([fw, fh]) => (fw === w && fh === h) || (fw === h && fh === w));
}

/** What a tile type looks like to the limit checks: board tiles and room tiles alike. */
export interface TileSpec {
  readonly group: 'board' | 'room';
  readonly type: string;
  readonly name: string;
  /** `laid` terrain has no size and no limit. */
  readonly laid: boolean;
  readonly footprints: readonly Footprint[];
  readonly maxPerSize: number | undefined;
}

export function tileSpec(group: 'board' | 'room', type: string): TileSpec | undefined {
  if (group === 'room') {
    const d = ROOM_TILES[type as RoomTileType];
    return (
      d && {
        group,
        type,
        name: d.name,
        laid: false,
        footprints: d.footprints,
        maxPerSize: d.maxPerSize,
      }
    );
  }
  const d = BOARD_TILES[type as BoardTileType];
  return (
    d && {
      group,
      type,
      name: d.name,
      laid: d.shape === 'laid',
      footprints: d.footprints,
      maxPerSize: d.maxPerSize,
    }
  );
}

/** "6 x 5" or "3 x 2 and 4 x 3": the sizes of a tile type, for texts. */
export function sizesText(spec: Pick<TileSpec, 'laid' | 'footprints'>): string {
  if (spec.laid) return 'square by square';
  return spec.footprints.map(([w, h]) => `${w} x ${h}`).join(' or ');
}

/** The most of this type one quest may use (undefined: no limit). */
export function tileMax(
  spec: Pick<TileSpec, 'laid' | 'footprints' | 'maxPerSize'>,
): number | undefined {
  return spec.laid || spec.maxPerSize === undefined
    ? undefined
    : spec.maxPerSize * spec.footprints.length;
}

/** "1 of 3 x 2 and 1 of 4 x 3" or "1 of 5 x 3": the limit as the editor and the messages say it. */
export function limitText(spec: Pick<TileSpec, 'laid' | 'footprints' | 'maxPerSize'>): string {
  if (spec.laid || spec.maxPerSize === undefined) return 'no limit';
  return spec.footprints.map(([w, h]) => `${spec.maxPerSize} of ${w} x ${h}`).join(' and ');
}

/** One entry of the editor palette "Board tiles": room tiles and board tiles together (decision 94). */
export type PaletteTile =
  | { readonly group: 'board'; readonly type: BoardTileType }
  | { readonly group: 'room'; readonly type: RoomTileType };

/** Every tile an author can place, in palette order: the map tiles first, then the room tiles. */
export const TILE_PALETTE: readonly PaletteTile[] = [
  ...BOARD_TILE_TYPES.filter((t) => !BOARD_TILES[t].notInPalette).map((type): PaletteTile => ({
    group: 'board',
    type,
  })),
  ...ROOM_TILE_TYPES.map((type): PaletteTile => ({ group: 'room', type })),
];
