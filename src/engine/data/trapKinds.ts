/**
 * Trap kinds as data (decision 44). The engine reads this table, so a new kind needs no new code
 * path: what can be done with it, whether it stays, and what the players are told. Texts are our
 * own words; the game effect is exact. Frozen Horror kinds are marked with their box.
 */

export const TRAP_KIND_NAMES = [
  'pit',
  'fallingBlock',
  'spear',
  'chest',
  'scripted',
  'stalactite',
  'swingingAxe',
  'wanderingTrap',
  'slipperyIce',
  'iceSlide',
] as const;
export type TrapKindName = (typeof TRAP_KIND_NAMES)[number];

export interface TrapKindDef {
  readonly id: TrapKindName;
  /** "pit trap", in sentences. */
  readonly name: string;
  /** The heading when it springs. */
  readonly title: string;
  /** The box it comes from. Missing means the base game. */
  readonly box?: string;
  /** The trap is on a piece of furniture (a chest), not on a square. */
  readonly onFurniture?: boolean;
  /** The quest notes run it: the app does nothing with it. */
  readonly scripted?: boolean;
  /** A hero can jump it (needs a square on the map). */
  readonly jumpable: boolean;
  /** A disarm can work. False: the book says it cannot be found or disarmed, so a try always springs it (decision 41). */
  readonly disarmable: boolean;
  /** It is still armed after it sprang: it springs again for the next hero (a pit, an axe). */
  readonly stays: boolean;
  /** It can be disarmed after it sprang (an axe: "until it is disarmed"). */
  readonly disarmAfterSpring?: boolean;
  /** Springing leaves a permanent block on the square. */
  readonly leavesBlock?: boolean;
  /** Springing brings the quest's wandering monsters next to the hero. */
  readonly bringsWanderers?: boolean;
  /** Springing, or a good jump, shows the whole slide (decision 42). Needs a `path` on the trap. */
  readonly slide?: boolean;
  /** What happens, for the players. */
  readonly lines: readonly string[];
}

export const TRAP_KINDS_DATA: Readonly<Record<TrapKindName, TrapKindDef>> = {
  pit: {
    id: 'pit',
    name: 'pit trap',
    title: 'Pit trap!',
    jumpable: true,
    disarmable: true,
    stays: true,
    lines: [
      'The hero falls in and loses 1 Body Point. Put a pit tile on this square. The turn ends.',
      'In the pit, roll 1 fewer combat die to attack and defend (at least 1). Climbing out takes the next turn.',
    ],
  },
  fallingBlock: {
    id: 'fallingBlock',
    name: 'falling block trap',
    title: 'Falling block!',
    jumpable: true,
    disarmable: true,
    stays: false,
    leavesBlock: true,
    lines: [
      'Roll 3 combat dice. The hero loses 1 Body Point for each skull and cannot defend.',
      'The block stays here as a wall for the rest of the quest. Move the hero to a free square ahead or back. The turn ends.',
    ],
  },
  spear: {
    id: 'spear',
    name: 'spear trap',
    title: 'Spear trap!',
    jumpable: true,
    disarmable: true,
    stays: false,
    lines: [
      'Roll 1 combat die. A skull costs 1 Body Point and the turn ends. A shield means the spear missed and the hero moves on.',
      'The trap is gone either way.',
    ],
  },
  chest: {
    id: 'chest',
    name: 'chest trap',
    title: 'Chest trap!',
    onFurniture: true,
    jumpable: false,
    disarmable: true,
    stays: false,
    lines: [],
  },
  scripted: {
    id: 'scripted',
    name: 'trap',
    title: 'Trap!',
    scripted: true,
    jumpable: false,
    disarmable: false,
    stays: false,
    lines: [],
  },
  stalactite: {
    id: 'stalactite',
    name: 'stalactite trap',
    title: 'Stalactite!',
    box: 'Frozen Horror',
    jumpable: true,
    disarmable: true,
    stays: false,
    lines: [
      'A spike of ice falls on the hero, who loses 1 Body Point and cannot defend.',
      'It only falls on the first hero. The trap is gone.',
    ],
  },
  swingingAxe: {
    id: 'swingingAxe',
    name: 'swinging axe trap',
    title: 'Swinging axe!',
    box: 'Frozen Horror',
    jumpable: true,
    disarmable: true,
    stays: true,
    disarmAfterSpring: true,
    lines: [
      'Roll 2 combat dice. The hero loses 1 Body Point for each skull and cannot defend.',
      'The axe stays armed and hits every hero who steps here, until someone disarms it.',
    ],
  },
  wanderingTrap: {
    id: 'wanderingTrap',
    name: 'wandering monster trap',
    title: 'Wandering monsters!',
    box: 'Frozen Horror',
    jumpable: true,
    disarmable: false,
    stays: false,
    bringsWanderers: true,
    lines: [
      "The hero must stop here. The quest's wandering monsters appear on free squares next to the hero, or as close as possible, and attack at once. The hero defends.",
      'A hero who has not acted yet this turn may act after defending. This trap works only once.',
    ],
  },
  slipperyIce: {
    id: 'slipperyIce',
    name: 'slippery ice',
    title: 'Slippery ice!',
    box: 'Frozen Horror',
    jumpable: true,
    disarmable: false,
    stays: true,
    lines: [
      'Put a slippery ice tile on this square. It cannot be found or disarmed, and monsters are not affected by it.',
      'Whenever a hero moves onto it, roll 1 combat die. On a white shield the hero falls and the turn ends. A fallen hero cannot act or defend until their next turn. Roll again for every ice square moved onto.',
      'Now that it is placed, a hero can jump over it like a pit.',
    ],
  },
  iceSlide: {
    id: 'iceSlide',
    name: 'ice slide',
    title: 'Ice slide!',
    box: 'Frozen Horror',
    jumpable: true,
    disarmable: false,
    stays: true,
    slide: true,
    lines: [
      'Put the ice slide tile down. The hero is whisked along the arrow to the last square of the slide at once, and the turn ends. Several heroes may stand on the last square.',
      'Roll 1 combat die: on a white shield the hero loses 1 Body Point.',
      'Monsters cannot move onto the slide, and heroes cannot climb up it against the arrow.',
    ],
  },
};

export const trapKind = (k: TrapKindName): TrapKindDef => TRAP_KINDS_DATA[k];
