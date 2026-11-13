import type { AreaId } from '../board/board';
import type { CellKey } from '../board/level';
import type { Hero } from '../data/heroes';
import type { MonsterType } from '../quest/schema';

export type TrapKindName = 'pit' | 'fallingBlock' | 'spear' | 'chest' | 'scripted';

/** Messages for the UI, produced by the reducer. */
export type Prompt =
  /** Something new is now visible. `cells` are the newly known squares, `origin` is where the
   *  reveal starts, in board units (a cell center is x + 0.5, y + 0.5). */
  | {
      readonly kind: 'revealed';
      readonly cells: readonly CellKey[];
      readonly origin: readonly [number, number];
    }
  /** The action showed nothing new. */
  | { readonly kind: 'nothingNew' }
  /** A quest note fired (search notes for now). `texts` are its showText and giveItem texts. */
  | {
      readonly kind: 'note';
      readonly noteId: string;
      readonly letter?: string | undefined;
      readonly texts: readonly string[];
      readonly consumesTreasure: boolean;
    }
  /** The search gave no special treasure: the players draw a treasure card. */
  | { readonly kind: 'drawCard' }
  /** A trap sprung. The kind is told now. `effect` is the quest's text for it, if any. */
  | {
      readonly kind: 'trapSprung';
      readonly trap: string;
      readonly trapKind: TrapKindName;
      readonly via: 'jump' | 'disarm' | 'step' | 'search';
      readonly effect?: string | undefined;
    }
  | { readonly kind: 'trapJumped'; readonly trap: string }
  | { readonly kind: 'trapDisarmed'; readonly trap: string; readonly trapKind: TrapKindName }
  /** A wandering monster joined the roster, with no square. The UI phrases the placement rule:
   *  next to `hero`, attacks that hero at once; if no square is free, the closest square in
   *  `room`, and it acts on the next Zargon turn. */
  | {
      readonly kind: 'wanderingMonster';
      readonly monster: string;
      readonly monsterType: MonsterType;
      readonly hero: Hero;
      readonly room: AreaId;
      readonly placement: {
        readonly nextToHero: Hero;
        readonly attacksAtOnce: true;
        readonly ifNoFreeSquare: {
          readonly closestInRoom: AreaId;
          readonly actsNextZargonTurn: true;
        };
      };
    }
  /** The quest's wandering monster is a text, not a monster. */
  | { readonly kind: 'wanderingText'; readonly text: string }
  /** A search of a chest found a trap. Its kind and effect stay hidden. */
  | { readonly kind: 'trapFound'; readonly furniture: string; readonly trap: string }
  | { readonly kind: 'noTrap'; readonly furniture: string }
  | { readonly kind: 'secretDoorsFound'; readonly doors: readonly string[] }
  | { readonly kind: 'nothingFound' };
