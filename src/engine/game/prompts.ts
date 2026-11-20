import type { AreaId } from '../board/board';
import type { CellKey } from '../board/level';
import type { MonsterType } from '../quest/schema';

export type { TrapKindName } from '../data/trapKinds';
import type { TrapKindName } from '../data/trapKinds';

/** Messages for the UI, produced by the reducer. */
export type Prompt =
  /** Something new is now visible. `cells` are the newly known squares, `origin` is where the
   *  reveal starts, in board units (a cell center is x + 0.5, y + 0.5). */
  | {
      readonly kind: 'revealed';
      readonly cells: readonly CellKey[];
      readonly origin: readonly [number, number];
    }
  /** Show room drew these squares, layout only. */
  | { readonly kind: 'layoutShown'; readonly cells: readonly CellKey[] }
  /** The heroes crossed to another map of the quest. The arrival room is revealed. */
  | { readonly kind: 'crossed'; readonly map: string; readonly name?: string | undefined }
  /** The players tried a false door: it cannot be opened. Nothing changed. */
  | { readonly kind: 'doorStuck'; readonly door: string }
  /** The action showed nothing new. */
  | { readonly kind: 'nothingNew' }
  /** A hero died (decision 32). */
  | { readonly kind: 'heroDied'; readonly hero: string }
  /** A quest note fired. `texts` are its showText and giveItem texts. `title` is the title of
   *  its first showText that has one. Sent when the note has texts, a letter, or takes the
   *  treasure. */
  | {
      readonly kind: 'note';
      readonly noteId: string;
      readonly letter?: string | undefined;
      readonly at?: readonly [number, number] | undefined;
      readonly title?: string | undefined;
      readonly texts: readonly string[];
      readonly consumesTreasure: boolean;
      /** Present (true) on a note that blocks the search: no card, the hero may search elsewhere. */
      readonly blocksSearch?: true;
    }
  /** A note asks the players to choose. Answer with CHOOSE {note, option}. */
  | {
      readonly kind: 'choice';
      readonly noteId: string;
      readonly text: string;
      readonly options: readonly string[];
    }
  /** A hidden monster joined the roster. `cell` is the square the quest names, if any. */
  | {
      readonly kind: 'monsterPlaced';
      readonly monster: string;
      readonly monsterType: MonsterType;
      readonly name: string;
      readonly cell?: readonly [number, number] | undefined;
    }
  /** A seen monster changed state (woke up, turned to stone, stone wore off). */
  | {
      readonly kind: 'monsterState';
      readonly monster: string;
      readonly name: string;
      readonly state: 'active' | 'dormant' | 'stone' | 'away' | 'passive';
      readonly turns?: number | undefined;
    }
  /** A note opened doors on the map. */
  | { readonly kind: 'doorsOpened'; readonly doors: readonly string[] }
  /** A note put a secret door on the map (closed). */
  | { readonly kind: 'secretDoorAdded'; readonly door: string }
  /** A note put blocked squares on the map. */
  | { readonly kind: 'blockPlaced'; readonly cells: readonly (readonly [number, number])[] }
  /** A quest counter changed (shown as text, for example a bounty). */
  | {
      readonly kind: 'counter';
      readonly counter: string;
      readonly by: number;
      readonly value: number;
    }
  /** A quest NPC appeared. Text only. */
  | {
      readonly kind: 'npcSpawned';
      readonly npc: string;
      readonly name: string;
      readonly cell: readonly [number, number];
      readonly defend: number;
      readonly text: string;
    }
  | { readonly kind: 'objectiveDone'; readonly objective: string; readonly text: string }
  /** Every objective is done: bring the heroes back to the stairs. */
  | { readonly kind: 'goalDone' }
  | {
      readonly kind: 'questEnded';
      readonly outcome: 'stairs' | 'fell' | 'ending';
      /** The id of the quest ending, when `outcome` is 'ending'. */
      readonly ending?: string;
      readonly goalDone: boolean;
    }
  /** The notes engine stopped a chain of notes that went on too long. */
  | { readonly kind: 'loopStopped' }
  /** The search gave no special treasure: the players draw a treasure card. */
  | { readonly kind: 'drawCard' }
  /** A trap sprung. The kind is told now. `effect` is the quest's text for it, if any. */
  | {
      readonly kind: 'trapSprung';
      readonly trap: string;
      readonly trapKind: TrapKindName;
      readonly via: 'jump' | 'disarm' | 'step' | 'search';
      readonly effect?: string | undefined;
      /** A wandering monster trap: the monsters that joined the roster, with no square. */
      readonly spawned?: readonly {
        readonly monster: string;
        readonly monsterType: MonsterType;
        readonly name?: string;
      }[];
    }
  /** A jump worked. A jumped ice slide shows its whole path (decision 42). */
  | { readonly kind: 'trapJumped'; readonly trap: string; readonly slide?: boolean }
  /** A hero used an ice tunnel and comes out at `to` (the other end of the pair). */
  | {
      readonly kind: 'tunnelUsed';
      readonly tunnel: string;
      readonly design: number;
      readonly to: readonly [number, number];
    }
  | { readonly kind: 'trapDisarmed'; readonly trap: string; readonly trapKind: TrapKindName }
  /** A wandering monster joined the roster, with no square. The UI phrases the placement rule:
   *  next to `hero`, attacks that hero at once; if no square is free, the closest square in
   *  `room`, and it acts on the next Zargon turn. */
  | {
      readonly kind: 'wanderingMonster';
      readonly monster: string;
      readonly monsterType: MonsterType;
      /** Its name and attack dice when it is an enemy of the quest (an Ice Gremlin). */
      readonly name?: string;
      readonly attackDice?: number;
      readonly hero: string;
      readonly room: AreaId;
      /** When the card brings several monsters: this is number `number` of `of`. */
      readonly number?: number;
      readonly of?: number;
      readonly placement: {
        readonly nextToHero: string;
        readonly attacksAtOnce: true;
      };
    }
  /** The quest's wandering monster is a text, not a monster. */
  | { readonly kind: 'wanderingText'; readonly text: string }
  /** A search of a chest found a trap. Its kind and effect stay hidden. */
  | { readonly kind: 'trapFound'; readonly furniture: string; readonly trap: string }
  | { readonly kind: 'noTrap'; readonly furniture: string }
  | { readonly kind: 'secretDoorsFound'; readonly doors: readonly string[] }
  | { readonly kind: 'nothingFound' };
