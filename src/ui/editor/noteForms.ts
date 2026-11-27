/** Pure helpers of the note builder: defaults, labels and small parsers. No React. */
import { tr } from '../../i18n/translate';
import { board, cellsOf } from '../../engine/board/board';
import type { Condition, Effect, Note, Quest, Trigger } from '../../engine/quest/schema';
import { SPELL_KEYS } from '../../engine/zargon/spells';

export const TRIGGER_TYPES: readonly { type: Trigger['type']; label: string }[] = [
  {
    type: 'manual',
    get label() {
      return tr('editor.noteForms.aButtonOnTheQuestPanel', 'A button on the quest panel');
    },
  },
  {
    type: 'questStart',
    get label() {
      return tr('editor.noteForms.theQuestStarts', 'The quest starts');
    },
  },
  {
    type: 'areaRevealed',
    get label() {
      return tr('editor.noteForms.anAreaIsRevealed', 'An area is revealed');
    },
  },
  {
    type: 'doorOpened',
    get label() {
      return tr('editor.noteForms.aDoorIsOpened', 'A door is opened');
    },
  },
  {
    type: 'areaEntered',
    get label() {
      return tr('editor.noteForms.aHeroEntersAnArea', 'A hero enters an area');
    },
  },
  {
    type: 'zoneEntered',
    get label() {
      return tr('editor.noteForms.aHeroEntersAZone', 'A hero enters a zone');
    },
  },
  {
    type: 'squareEntered',
    get label() {
      return tr('editor.noteForms.aHeroIsOnASquare', 'A hero is on a square');
    },
  },
  {
    type: 'treasureSearch',
    get label() {
      return tr('editor.noteForms.searchForTreasure', 'Search for treasure');
    },
  },
  {
    type: 'secretDoorSearch',
    get label() {
      return tr('editor.noteForms.searchForSecretDoors', 'Search for secret doors');
    },
  },
  {
    type: 'trapSprung',
    get label() {
      return tr('editor.noteForms.aTrapIsSprung', 'A trap is sprung');
    },
  },
  {
    type: 'trapDisarmed',
    get label() {
      return tr('editor.noteForms.aTrapIsDisarmed', 'A trap is disarmed');
    },
  },
  {
    type: 'monsterSeen',
    get label() {
      return tr('editor.noteForms.aMonsterComesIntoView', 'A monster comes into view');
    },
  },
  {
    type: 'monsterKilled',
    get label() {
      return tr('editor.noteForms.aMonsterIsSlain', 'A monster is slain');
    },
  },
  {
    type: 'monsterLeft',
    get label() {
      return tr('editor.noteForms.aMonsterEscapesOrIsFreed', 'A monster escapes or is freed');
    },
  },
  {
    type: 'allKilled',
    get label() {
      return tr('editor.noteForms.allOfSomeMonstersAreSlain', 'All of some monsters are slain');
    },
  },
  {
    type: 'spellCast',
    get label() {
      return tr('editor.noteForms.aSpellIsCast', 'A spell is cast');
    },
  },
  {
    type: 'zargonTurn',
    get label() {
      return tr('editor.noteForms.zargonSTurnEnds', "Zargon's turn ends");
    },
  },
  {
    type: 'questEnds',
    get label() {
      return tr('editor.noteForms.theQuestEnds', 'The quest ends');
    },
  },
];

export const EFFECT_TYPES: readonly { type: Effect['type']; label: string }[] = [
  {
    type: 'showText',
    get label() {
      return tr('editor.noteForms.showText', 'Show text');
    },
  },
  {
    type: 'revealArea',
    get label() {
      return tr('editor.noteForms.revealARoom', 'Reveal a room');
    },
  },
  {
    type: 'revealAll',
    get label() {
      return tr('editor.noteForms.revealEverything', 'Reveal everything');
    },
  },
  {
    type: 'openAllDoors',
    get label() {
      return tr('editor.noteForms.openAllDoors', 'Open all doors');
    },
  },
  {
    type: 'placeMonster',
    get label() {
      return tr('editor.noteForms.placeAMonster', 'Place a monster');
    },
  },
  {
    type: 'setMonsterState',
    get label() {
      return tr('editor.noteForms.setAMonsterState', 'Set a monster state');
    },
  },
  {
    type: 'addSecretDoor',
    get label() {
      return tr('editor.noteForms.showASecretDoor', 'Show a secret door');
    },
  },
  {
    type: 'removeDoor',
    get label() {
      return tr('editor.noteForms.removeADoor', 'Remove a door');
    },
  },
  {
    type: 'crossMap',
    get label() {
      return tr('editor.noteForms.crossToTheOtherMap', 'Cross to the other map');
    },
  },
  {
    type: 'lookFrom',
    get label() {
      return tr('editor.noteForms.lookFromASquare', 'Look from a square');
    },
  },
  {
    type: 'replaceFurnitureWithDoor',
    get label() {
      return tr('editor.noteForms.replaceFurnitureWithADoor', 'Replace furniture with a door');
    },
  },
  {
    type: 'placeBlock',
    get label() {
      return tr('editor.noteForms.placeABlock', 'Place a block');
    },
  },
  {
    type: 'giveItem',
    get label() {
      return tr('editor.noteForms.giveAnItem', 'Give an item');
    },
  },
  {
    type: 'setFlag',
    get label() {
      return tr('editor.noteForms.setAFlag', 'Set a flag');
    },
  },
  {
    type: 'addCounter',
    get label() {
      return tr('editor.noteForms.addToACounter', 'Add to a counter');
    },
  },
  {
    type: 'completeObjective',
    get label() {
      return tr('editor.noteForms.completeAnObjective', 'Complete an objective');
    },
  },
  {
    type: 'spawnNpc',
    get label() {
      return tr('editor.noteForms.bringInACharacter', 'Bring in a character');
    },
  },
  {
    type: 'blockSearch',
    get label() {
      return tr('editor.noteForms.searchingHereIsNot', 'Searching here is not possible');
    },
  },
  {
    type: 'promptChoice',
    get label() {
      return tr('editor.noteForms.askThePlayers', 'Ask the players');
    },
  },
];

export const CONDITION_TYPES = [
  {
    key: 'flag',
    get label() {
      return tr('editor.noteForms.aFlagIsSet', 'A flag is set');
    },
  },
  {
    key: 'counter',
    get label() {
      return tr('editor.noteForms.aCounterIsAtLeast', 'A counter is at least');
    },
  },
  {
    key: 'monster',
    get label() {
      return tr('editor.noteForms.aMonsterIsAliveOrSlain', 'A monster is alive or slain');
    },
  },
  {
    key: 'monstersAliveIn',
    get label() {
      return tr('editor.noteForms.monstersAliveInAnArea', 'Monsters alive in an area');
    },
  },
  {
    key: 'areaRevealed',
    get label() {
      return tr('editor.noteForms.aRoomIsRevealed', 'A room is revealed');
    },
  },
  {
    key: 'doorOpened',
    get label() {
      return tr('editor.noteForms.aDoorIsOpen', 'A door is open');
    },
  },
  {
    key: 'monsterSeen',
    get label() {
      return tr('editor.noteForms.aMonsterWasSeen', 'A monster was seen');
    },
  },
  {
    key: 'lookDone',
    get label() {
      return tr('editor.noteForms.lookingFromASquareIsDone', 'Looking from a square is done');
    },
  },
  {
    key: 'firstTime',
    get label() {
      return tr('editor.noteForms.firstTimeOnly', 'First time only');
    },
  },
] as const;
export type ConditionKey = (typeof CONDITION_TYPES)[number]['key'];

export function conditionKey(c: Condition): ConditionKey {
  if ('flag' in c) return 'flag';
  if ('counter' in c) return 'counter';
  if ('monster' in c) return 'monster';
  if ('monstersAliveIn' in c) return 'monstersAliveIn';
  if ('areaRevealed' in c) return 'areaRevealed';
  if ('doorOpened' in c) return 'doorOpened';
  if ('monsterSeen' in c) return 'monsterSeen';
  if ('lookDone' in c) return 'lookDone';
  return 'firstTime';
}

const firstCell = (q: Quest): [number, number] => {
  const c = cellsOf(board, q.start.area ?? 'R01')[0];
  return c ? [c[0], c[1]] : [0, 0];
};

export type Made<T> = { ok: true; value: T } | { ok: false; error: string };
const good = <T>(value: T): Made<T> => ({ ok: true, value });
const bad = <T>(error: string): Made<T> => ({ ok: false, error });

/** A trigger of this type that the schema accepts, or the reason there is none yet. */
export function defaultTrigger(q: Quest, type: Trigger['type']): Made<Trigger> {
  const area = q.start.area ?? 'R01';
  switch (type) {
    case 'questStart':
      return good({ type });
    case 'manual':
      return good({ type, label: 'Manual note' });
    case 'areaRevealed':
    case 'areaEntered':
    case 'secretDoorSearch':
    case 'treasureSearch':
      return good({ type, area });
    case 'doorOpened': {
      const d = q.doors[0] ?? q.edgeDoors[0] ?? q.secretDoors[0];
      return d
        ? good({ type, door: d.id })
        : bad(tr('editor.noteForms.addADoorFirst', 'Add a door first.'));
    }
    case 'zoneEntered': {
      const z = q.zones[0];
      // a zone asks "a hero enters" on every tap by default; "Fires every time" can be turned off
      return z
        ? good({ type, zone: z.id, repeat: true })
        : bad(tr('editor.noteForms.addAZoneFirst', 'Add a zone first.'));
    }
    case 'squareEntered':
      return good({ type, cell: firstCell(q) });
    case 'trapSprung':
    case 'trapDisarmed': {
      const t = q.traps[0];
      return t
        ? good({ type, trap: t.id })
        : bad(tr('editor.noteForms.addATrapFirst', 'Add a trap first.'));
    }
    case 'monsterSeen':
    case 'monsterKilled':
    case 'monsterLeft': {
      const m = q.monsters[0];
      return m
        ? good({ type, monster: m.id })
        : bad(tr('editor.noteForms.addAMonsterFirst', 'Add a monster first.'));
    }
    case 'allKilled': {
      const m = q.monsters[0];
      return m
        ? good({ type, monsters: [m.id] })
        : bad(tr('editor.noteForms.addAMonsterFirst', 'Add a monster first.'));
    }
    case 'spellCast':
      return good({ type });
    case 'zargonTurn':
      return good({ type, n: 1 });
    case 'questEnds':
      return good({ type });
  }
}

/** An effect of this type that the schema accepts, or the reason there is none yet. */
export function defaultEffect(q: Quest, type: Effect['type']): Made<Effect> {
  switch (type) {
    case 'showText':
      return good({ type, text: 'Write the text here.' });
    case 'revealArea':
      return good({ type, area: q.start.area ?? 'R01' });
    case 'revealAll':
    case 'openAllDoors':
    case 'blockSearch':
      return good({ type });
    case 'placeMonster': {
      const m = q.monsters.find((x) => x.hidden) ?? q.monsters[0];
      return m
        ? good({ type, monster: m.id })
        : bad(tr('editor.noteForms.addAMonsterFirst', 'Add a monster first.'));
    }
    case 'setMonsterState': {
      const m = q.monsters[0];
      return m
        ? good({ type, monster: m.id, state: 'active' })
        : bad(tr('editor.noteForms.addAMonsterFirst', 'Add a monster first.'));
    }
    case 'addSecretDoor': {
      const d = q.secretDoors[0];
      return d
        ? good({ type, door: d.id })
        : bad(tr('editor.noteForms.addASecretDoorFirst', 'Add a secret door first.'));
    }
    case 'lookFrom':
      return good({ type, cell: firstCell(q) });
    case 'replaceFurnitureWithDoor': {
      const f = q.furniture[0];
      const d = q.doors[0];
      return f && d
        ? good({ type, furniture: f.id, door: d.id })
        : bad(
            tr(
              'editor.noteForms.addAPieceOfFurnitureAnd',
              'Add a piece of furniture and a door first.',
            ),
          );
    }
    case 'removeDoor': {
      const d = q.doors[0];
      return d
        ? good({ type, door: d.id })
        : bad(tr('editor.noteForms.addADoorFirst', 'Add a door first.'));
    }
    case 'crossMap': {
      const l = q.links?.[0];
      return l
        ? good({ type, link: l.id })
        : bad(tr('editor.noteForms.addALinkBetweenTwoMaps', 'Add a link between two maps first.'));
    }
    case 'placeBlock':
      return good({ type, cells: [firstCell(q)] });
    case 'giveItem':
      return good({ type, text: 'Name the item here.' });
    case 'setFlag':
      return good({ type, flag: 'flag', value: true });
    case 'addCounter':
      return good({ type, counter: 'counter', by: 1 });
    case 'completeObjective': {
      const o = q.objectives[0];
      return o
        ? good({ type, objective: o.id })
        : bad(tr('editor.noteForms.addAnObjectiveFirst', 'Add an objective first.'));
    }
    case 'spawnNpc': {
      const n = q.npcs[0];
      return n
        ? good({ type, npc: n.id })
        : bad(tr('editor.noteForms.addACharacterFirst', 'Add a character first.'));
    }
    case 'promptChoice':
      return good({
        type,
        text: 'Ask the players here.',
        options: [{ label: 'Yes', effects: [] }],
      });
  }
}

export function defaultCondition(q: Quest, key: ConditionKey): Made<Condition> {
  switch (key) {
    case 'flag':
      return good({ flag: 'flag', is: true });
    case 'counter':
      return good({ counter: 'counter', gte: 1 });
    case 'monster': {
      const m = q.monsters[0];
      return m
        ? good({ monster: m.id, alive: false })
        : bad(tr('editor.noteForms.addAMonsterFirst', 'Add a monster first.'));
    }
    case 'monstersAliveIn':
      return good({ monstersAliveIn: q.start.area ?? 'R01', is: 0 });
    case 'areaRevealed':
      return good({ areaRevealed: q.start.area ?? 'R01' });
    case 'doorOpened': {
      const d = q.doors[0] ?? q.edgeDoors[0] ?? q.secretDoors[0];
      return d
        ? good({ doorOpened: d.id })
        : bad(tr('editor.noteForms.addADoorFirst', 'Add a door first.'));
    }
    case 'monsterSeen': {
      const m = q.monsters[0];
      return m
        ? good({ monsterSeen: m.id })
        : bad(tr('editor.noteForms.addAMonsterFirst', 'Add a monster first.'));
    }
    case 'lookDone':
      return good({ lookDone: firstCell(q) });
    case 'firstTime':
      return good({ firstTime: true });
  }
}

/** Replace the item at `i`. A new list, the input is not changed. */
export function replaceAt<T>(list: readonly T[], i: number, item: T): T[] {
  return list.map((x, j) => (j === i ? item : x));
}
export function removeAt<T>(list: readonly T[], i: number): T[] {
  return list.filter((_, j) => j !== i);
}

/** A whole number from a text field. Empty gives `undefined` when `optional`. */
export function parseWhole(
  text: string,
  opts: { min?: number; optional?: boolean; negative?: boolean } = {},
): Made<number | undefined> {
  const t = text.trim();
  if (t === '')
    return opts.optional
      ? good(undefined)
      : bad(tr('editor.noteForms.typeANumber', 'Type a number.'));
  const re = opts.negative ? /^-?\d+$/ : /^\d+$/;
  if (!re.test(t))
    return bad(tr('editor.noteForms.thatMustBeAWholeNumber', 'That must be a whole number.'));
  const n = Number(t);
  if (opts.min !== undefined && n < opts.min)
    return bad(
      tr('editor.noteForms.theSmallestNumberIs', 'The smallest number is {min}.', {
        min: opts.min,
      }),
    );
  return good(n);
}

/** One capital letter A..Z, but never X (X marks a spot on the map). Empty clears. */
export function parseMapLetter(text: string): Made<string | null> {
  const t = text.trim().toUpperCase();
  if (t === '') return good(null);
  if (!/^[A-WYZ]$/.test(t))
    return bad(
      tr('editor.noteForms.aLetterIsOneCapitalFrom', 'A letter is one capital from A to Z, not X.'),
    );
  return good(t);
}

export const cellText = (c: readonly [number, number]) => `${c[0]}, ${c[1]}`;

const spellOk = (s: string) => (SPELL_KEYS as readonly string[]).includes(s);

/** A short line that says when a note fires. */
export function triggerSummary(t: Trigger): string {
  switch (t.type) {
    case 'questStart':
      return tr('editor.noteForms.questStarts', 'Quest starts');
    case 'manual':
      return `Button: ${t.label}`;
    case 'areaRevealed':
      return `${t.area} revealed`;
    case 'areaEntered':
      return tr('editor.noteForms.heroEnters', 'Hero enters {area}', { area: t.area });
    case 'zoneEntered':
      return tr('editor.noteForms.heroEntersZone', 'Hero enters zone {zone}', { zone: t.zone });
    case 'doorOpened':
      return tr('editor.noteForms.doorOpened', 'Door {door} opened', { door: t.door });
    case 'squareEntered':
      return tr('editor.noteForms.heroOn', 'Hero on {cellText}', { cellText: cellText(t.cell) });
    case 'treasureSearch':
      return tr('editor.noteForms.treasureSearchIn', 'Treasure search in {area}', { area: t.area });
    case 'secretDoorSearch':
      return tr('editor.noteForms.secretDoorSearchIn', 'Secret door search in {area}', {
        area: t.area,
      });
    case 'trapSprung':
      return tr('editor.noteForms.trapSprung', 'Trap {trap} sprung', { trap: t.trap });
    case 'trapDisarmed':
      return tr('editor.noteForms.trapDisarmed', 'Trap {trap} disarmed', { trap: t.trap });
    case 'monsterSeen':
      return `Seen: ${t.monster ?? t.monsterType ?? 'any monster'}`;
    case 'monsterKilled':
      return `Slain: ${t.monster ?? t.monsterType ?? 'any monster'}`;
    case 'monsterLeft':
      return `Left${t.reason ? ` (${t.reason})` : ''}: ${t.monster ?? t.monsterType ?? 'any monster'}`;
    case 'allKilled':
      return tr('editor.noteForms.allSlain', 'All slain: {join}', { join: t.monsters.join(', ') });
    case 'spellCast':
      return tr('editor.noteForms.spellCast', 'Spell cast{value}', {
        value: t.spell && spellOk(t.spell) ? `: ${t.spell}` : '',
      });
    case 'questEnds':
      return t.outcome
        ? tr('editor.noteForms.theQuestEnds2', 'The quest ends ({outcome})', { outcome: t.outcome })
        : tr('editor.noteForms.theQuestEnds', 'The quest ends');
    case 'zargonTurn':
      return t.every
        ? tr('editor.noteForms.everyZargonTurns', 'Every {every} Zargon turns', { every: t.every })
        : tr('editor.noteForms.zargonTurn', 'Zargon turn {value}', { value: t.n ?? 'any' });
  }
}

/** Notes in list order: lettered A..Z first, then the ones without a letter, in file order. */
export function orderedNotes(q: Quest): Note[] {
  const lettered = q.notes
    .filter((n) => n.letter)
    .sort((a, b) => a.letter!.localeCompare(b.letter!));
  return [...lettered, ...q.notes.filter((n) => !n.letter)];
}

/** The text of the first `showText` effect (the note's main text). */
export function mainText(n: Note): string {
  const e = n.effects.find((x) => x.type === 'showText');
  return e && e.type === 'showText' ? e.text : '';
}

/** Index of the first `showText` effect, or -1. */
export function mainTextIndex(n: Note): number {
  return n.effects.findIndex((x) => x.type === 'showText');
}
