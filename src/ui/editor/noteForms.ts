/** Pure helpers of the note builder: defaults, labels and small parsers. No React. */
import { board, cellsOf } from '../../engine/board/board';
import type { Condition, Effect, Note, Quest, Trigger } from '../../engine/quest/schema';
import { SPELL_KEYS } from '../../engine/zargon/spells';

export const TRIGGER_TYPES: readonly { type: Trigger['type']; label: string }[] = [
  { type: 'manual', label: 'A button on the quest panel' },
  { type: 'questStart', label: 'The quest starts' },
  { type: 'areaRevealed', label: 'An area is revealed' },
  { type: 'doorOpened', label: 'A door is opened' },
  { type: 'areaEntered', label: 'A hero enters an area' },
  { type: 'squareEntered', label: 'A hero is on a square' },
  { type: 'treasureSearch', label: 'Search for treasure' },
  { type: 'secretDoorSearch', label: 'Search for secret doors' },
  { type: 'trapSprung', label: 'A trap is sprung' },
  { type: 'trapDisarmed', label: 'A trap is disarmed' },
  { type: 'monsterKilled', label: 'A monster is slain' },
  { type: 'allKilled', label: 'All of some monsters are slain' },
  { type: 'spellCast', label: 'A spell is cast' },
  { type: 'zargonTurn', label: "Zargon's turn ends" },
];

export const EFFECT_TYPES: readonly { type: Effect['type']; label: string }[] = [
  { type: 'showText', label: 'Show text' },
  { type: 'revealArea', label: 'Reveal a room' },
  { type: 'revealAll', label: 'Reveal everything' },
  { type: 'openAllDoors', label: 'Open all doors' },
  { type: 'placeMonster', label: 'Place a monster' },
  { type: 'setMonsterState', label: 'Set a monster state' },
  { type: 'addSecretDoor', label: 'Show a secret door' },
  { type: 'placeBlock', label: 'Place a block' },
  { type: 'giveItem', label: 'Give an item' },
  { type: 'setFlag', label: 'Set a flag' },
  { type: 'addCounter', label: 'Add to a counter' },
  { type: 'completeObjective', label: 'Complete an objective' },
  { type: 'spawnNpc', label: 'Bring in a character' },
  { type: 'promptChoice', label: 'Ask the players' },
];

export const CONDITION_TYPES = [
  { key: 'flag', label: 'A flag is set' },
  { key: 'counter', label: 'A counter is at least' },
  { key: 'monster', label: 'A monster is alive or slain' },
  { key: 'monstersAliveIn', label: 'Monsters alive in an area' },
  { key: 'firstTime', label: 'First time only' },
] as const;
export type ConditionKey = (typeof CONDITION_TYPES)[number]['key'];

export function conditionKey(c: Condition): ConditionKey {
  if ('flag' in c) return 'flag';
  if ('counter' in c) return 'counter';
  if ('monster' in c) return 'monster';
  if ('monstersAliveIn' in c) return 'monstersAliveIn';
  return 'firstTime';
}

const firstCell = (q: Quest): [number, number] => {
  const c = cellsOf(board, q.start.area)[0];
  return c ? [c[0], c[1]] : [0, 0];
};

export type Made<T> = { ok: true; value: T } | { ok: false; error: string };
const good = <T>(value: T): Made<T> => ({ ok: true, value });
const bad = <T>(error: string): Made<T> => ({ ok: false, error });

/** A trigger of this type that the schema accepts, or the reason there is none yet. */
export function defaultTrigger(q: Quest, type: Trigger['type']): Made<Trigger> {
  const area = q.start.area;
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
      const d = q.doors[0] ?? q.secretDoors[0];
      return d ? good({ type, door: d.id }) : bad('Add a door first.');
    }
    case 'squareEntered':
      return good({ type, cell: firstCell(q) });
    case 'trapSprung':
    case 'trapDisarmed': {
      const t = q.traps[0];
      return t ? good({ type, trap: t.id }) : bad('Add a trap first.');
    }
    case 'monsterKilled': {
      const m = q.monsters[0];
      return m ? good({ type, monster: m.id }) : bad('Add a monster first.');
    }
    case 'allKilled': {
      const m = q.monsters[0];
      return m ? good({ type, monsters: [m.id] }) : bad('Add a monster first.');
    }
    case 'spellCast':
      return good({ type });
    case 'zargonTurn':
      return good({ type, n: 1 });
  }
}

/** An effect of this type that the schema accepts, or the reason there is none yet. */
export function defaultEffect(q: Quest, type: Effect['type']): Made<Effect> {
  switch (type) {
    case 'showText':
      return good({ type, text: 'Write the text here.' });
    case 'revealArea':
      return good({ type, area: q.start.area });
    case 'revealAll':
    case 'openAllDoors':
      return good({ type });
    case 'placeMonster': {
      const m = q.monsters.find((x) => x.hidden) ?? q.monsters[0];
      return m ? good({ type, monster: m.id }) : bad('Add a monster first.');
    }
    case 'setMonsterState': {
      const m = q.monsters[0];
      return m ? good({ type, monster: m.id, state: 'active' }) : bad('Add a monster first.');
    }
    case 'addSecretDoor': {
      const d = q.secretDoors[0];
      return d ? good({ type, door: d.id }) : bad('Add a secret door first.');
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
      return o ? good({ type, objective: o.id }) : bad('Add an objective first.');
    }
    case 'spawnNpc': {
      const n = q.npcs[0];
      return n ? good({ type, npc: n.id }) : bad('Add a character first.');
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
      return m ? good({ monster: m.id, alive: false }) : bad('Add a monster first.');
    }
    case 'monstersAliveIn':
      return good({ monstersAliveIn: q.start.area, is: 0 });
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
  if (t === '') return opts.optional ? good(undefined) : bad('Type a number.');
  const re = opts.negative ? /^-?\d+$/ : /^\d+$/;
  if (!re.test(t)) return bad('That must be a whole number.');
  const n = Number(t);
  if (opts.min !== undefined && n < opts.min) return bad(`The smallest number is ${opts.min}.`);
  return good(n);
}

/** One capital letter A..Z, but never X (X marks a spot on the map). Empty clears. */
export function parseMapLetter(text: string): Made<string | null> {
  const t = text.trim().toUpperCase();
  if (t === '') return good(null);
  if (!/^[A-WYZ]$/.test(t)) return bad('A letter is one capital from A to Z, not X.');
  return good(t);
}

export const cellText = (c: readonly [number, number]) => `${c[0]}, ${c[1]}`;

const spellOk = (s: string) => (SPELL_KEYS as readonly string[]).includes(s);

/** A short line that says when a note fires. */
export function triggerSummary(t: Trigger): string {
  switch (t.type) {
    case 'questStart':
      return 'Quest starts';
    case 'manual':
      return `Button: ${t.label}`;
    case 'areaRevealed':
      return `${t.area} revealed`;
    case 'areaEntered':
      return `Hero enters ${t.area}`;
    case 'doorOpened':
      return `Door ${t.door} opened`;
    case 'squareEntered':
      return `Hero on ${cellText(t.cell)}`;
    case 'treasureSearch':
      return `Treasure search in ${t.area}`;
    case 'secretDoorSearch':
      return `Secret door search in ${t.area}`;
    case 'trapSprung':
      return `Trap ${t.trap} sprung`;
    case 'trapDisarmed':
      return `Trap ${t.trap} disarmed`;
    case 'monsterKilled':
      return `Slain: ${t.monster ?? t.monsterType ?? 'any monster'}`;
    case 'allKilled':
      return `All slain: ${t.monsters.join(', ')}`;
    case 'spellCast':
      return `Spell cast${t.spell && spellOk(t.spell) ? `: ${t.spell}` : ''}`;
    case 'zargonTurn':
      return t.every ? `Every ${t.every} Zargon turns` : `Zargon turn ${t.n ?? 'any'}`;
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
