/** Walk-through of quest 5, Melar's Maze: dormant gargoyle (B), gas chest (C), talisman (D), throne secret door (E). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { board } from '../../engine/board/board';
import { buildLevel } from '../../engine/board/level';
import { EventError } from '../../engine/game/errors';
import type { GameEvent } from '../../engine/game/events';
import { lookHintCells } from '../../engine/game/hints';
import { liveMonstersInRoom } from '../../engine/game/monstersIn';
import { initialState, reduce, replay } from '../../engine/game/reducer';
import { dormantFigures, journal, monstersInPlay, objectivesStatus } from '../../engine/game/view';
import { parseQuest } from '../../engine/quest/loader';
import { validateQuest } from '../../engine/quest/validate';

const quest = parseQuest(
  JSON.parse(readFileSync(resolve(import.meta.dirname, 'q05-melars-maze.json'), 'utf8')),
);
const level = buildLevel(quest);
const open = (door: string): GameEvent => ({ type: 'OPEN_DOOR', door });
const run = (...events: GameEvent[]) => replay(level, 1, events);
const search = (
  room: string,
  hero: 'barbarian' | 'dwarf' | 'elf' | 'wizard' = 'barbarian',
): GameEvent => ({
  type: 'SEARCH_TREASURE',
  room,
  hero,
});
const kill = (monster: string): GameEvent => ({ type: 'MONSTER_KILL', monster });
const note = (letter: string) => quest.notes.find((n) => n.letter === letter);
const areaOf = (c: readonly number[]) => board.cells[c[1]!]?.[c[0]!];
const kinds = (r: { prompts: readonly { kind: string }[] }) => r.prompts.map((p) => p.kind);
const fails = (fn: () => unknown): string | undefined => {
  try {
    fn();
  } catch (e) {
    return e instanceof EventError ? e.code : 'other';
  }
  return undefined;
};

/** Looks from hint squares (in order) until the door is seen, so the next door can be opened. */
function seeDoor(events: GameEvent[], door: string): GameEvent[] {
  const out = [...events];
  for (let i = 0; i < 40 && !run(...out).seenDoors.has(door); i++) {
    const hint = lookHintCells(level, run(...out))[0];
    if (!hint) break;
    out.push({ type: 'LOOK_FROM', cell: hint });
  }
  expect(run(...out).seenDoors.has(door)).toBe(true);
  return out;
}
/** Opens a door the players can see, looking around first when needed. */
const openVia = (events: GameEvent[], door: string): GameEvent[] => [
  ...seeDoor(events, door),
  open(door),
];

// The north route: d1 (west door of the stairs room), the top corridor, d2 into R02, d3 into R08.
const toD2 = seeDoor([open('d1')], 'd2');
const toR08 = [...toD2, open('d2'), open('d3')];
// R08 south door d5 into the row 9 corridor, then d6 into R12.
const toR12 = openVia([...toR08, open('d5')], 'd6');
// R12 south door d8 into R20 (this wakes the gargoyle).
const toR20 = [...toR12, open('d8')];
// West route: d4 into the throne room R07.
const toR07 = openVia([open('d1')], 'd4');

describe('quest 5: data', () => {
  it('is valid against the board', () => {
    expect(validateQuest(quest, board)).toEqual([]);
  });

  it('has 13 doors, 2 secret doors, 8 blocks, 17 monsters, 8 traps, wandering zombie', () => {
    expect(quest.doors).toHaveLength(13);
    expect(quest.secretDoors).toEqual([
      { id: 's1', a: [4, 7], b: [5, 7] },
      { id: 's2', a: [8, 10], b: [9, 10] },
    ]);
    expect(quest.falseDoors).toEqual([]);
    expect(quest.blocks).toHaveLength(8);
    expect(quest.blocks.filter((b) => b.cells.length === 2)).toHaveLength(2);
    expect(quest.monsters).toHaveLength(17);
    expect(quest.traps).toHaveLength(8);
    expect(quest.wandering).toEqual({ monster: 'zombie' });
    expect(quest.start).toEqual({ area: 'R01' });
  });

  it('monsters by type: 3 orcs, 4 zombies, 6 skeletons, 3 mummies, 1 gargoyle', () => {
    const count = (t: string) => quest.monsters.filter((m) => m.type === t).length;
    expect(count('orc')).toBe(3);
    expect(count('zombie')).toBe(4);
    expect(count('skeleton')).toBe(6);
    expect(count('mummy')).toBe(3);
    expect(count('gargoyle')).toBe(1);
  });

  it('traps: 4 pits, 2 spears, 1 falling block, 1 gas chest', () => {
    const count = (k: string) => quest.traps.filter((t) => t.kind === k).length;
    expect(count('pit')).toBe(4);
    expect(count('spear')).toBe(2);
    expect(count('fallingBlock')).toBe(1);
    expect(count('chest')).toBe(1);
  });

  it('the gargoyle is dormant in R12, on the square under letter B', () => {
    const g = quest.monsters.find((m) => m.id === 'm-gargoyle')!;
    expect(g).toMatchObject({ type: 'gargoyle', state: 'dormant', cell: [4, 12] });
    expect(areaOf(g.cell!)).toBe('R12');
  });
});

describe('quest 5: walk-through', () => {
  it('starts in the stairs room R01 with only door d1 known', () => {
    const s = initialState(level, 1);
    expect(s.revealedRooms).toEqual(new Set(['R01']));
    expect(s.seenFurniture.has('f-stairs')).toBe(true);
    expect(s.seenMonsters.size).toBe(0);
    expect(s.seenDoors).toEqual(new Set(['d1']));
  });

  it('d2 shows R02 (a pit), d3 then shows R08 with three orcs and the alchemist bench', () => {
    const s = run(...toD2, open('d2'));
    expect(s.revealedRooms.has('R02')).toBe(true);
    expect(s.seenTraps.has('t1')).toBe(true);
    expect(s.seenDoors.has('d3')).toBe(true);
    const t = run(...toR08);
    expect(t.revealedRooms.has('R08')).toBe(true);
    for (const m of ['m1', 'm2', 'm3']) expect(t.seenMonsters.has(m)).toBe(true);
    expect(t.seenFurniture.has('f-bench')).toBe(true);
    expect(t.seenDoors.has('d5')).toBe(true);
  });

  it('d4 shows the throne room R07: no monsters, and the secret door s1 stays hidden', () => {
    const s = run(...toR07);
    expect(s.revealedRooms.has('R07')).toBe(true);
    expect(s.seenMonsters.size).toBe(0);
    expect(s.seenDoors.has('s1')).toBe(false);
  });

  it('the throne is furniture of R07, seen with the room; the secret door s1 sits behind it', () => {
    const throne = quest.furniture.find((f) => f.type === 'throne')!;
    expect(throne.cells).toEqual([[4, 7]]);
    expect(areaOf(throne.cells[0] as [number, number])).toBe('R07');
    expect(quest.secretDoors.find((d) => d.id === 's1')?.a).toEqual([4, 7]);
    const s = run(...toR07);
    expect(s.seenFurniture.has(throne.id)).toBe(true);
    expect(s.seenDoors.has('s1')).toBe(false);
  });

  it('the top corridor shows the mummy of row 0 from afar', () => {
    const s = run(...toD2);
    expect(s.seenMonsters.has('m15')).toBe(true);
  });

  it('never reveals rock rooms or rock squares', () => {
    const s = run(...toR20);
    for (const k of s.seenCells) expect(level.rock.has(k)).toBe(false);
    for (const r of quest.rock.rooms) expect(s.revealedRooms.has(r)).toBe(false);
  });
});

describe('quest 5: letter A, the alchemist bench', () => {
  it('first search of R08 gives a potion of healing (2 Body Points), no card', () => {
    expect(note('A')?.trigger).toEqual({ type: 'treasureSearch', area: 'R08', first: true });
    expect(note('A')?.consumesTreasure).toBe(true);
    const s = run(...toR08, kill('m1'), kill('m2'), kill('m3'));
    const r = reduce(level, s, search('R08'));
    expect(r.prompts.find((p) => p.kind === 'note')).toMatchObject({
      noteId: 'n-A',
      at: [8, 5],
      consumesTreasure: true,
    });
    expect(kinds(r)).not.toContain('drawCard');
    const gift = note('A')?.effects.find((e) => e.type === 'giveItem') as { text: string };
    expect(gift.text).toContain('potion of healing');
    expect(gift.text).toContain('2 Body Points');
    expect(journal(level, r.state).map((j) => j.letter)).toContain('A');
    // A second hero searching afterwards draws a normal card.
    const again = reduce(level, r.state, search('R08', 'elf'));
    expect(kinds(again)).toEqual(['drawCard']);
  });
});

describe('quest 5: letter B, the gargoyle statue', () => {
  it('is a statue in R12: a figure, not a monster, and it does not block a search', () => {
    const s = run(...toR12);
    expect(s.revealedRooms.has('R12')).toBe(true);
    expect(s.seenDoors.has('d8')).toBe(true);
    expect(monstersInPlay(level, s).map((m) => m.id)).not.toContain('m-gargoyle');
    expect(dormantFigures(level, s)).toEqual([
      { id: 'm-gargoyle', type: 'gargoyle', cell: [4, 12] },
    ]);
    expect(liveMonstersInRoom(level, s, 'R12')).toEqual([]);
    expect(
      fails(() => reduce(level, s, { type: 'MONSTER_DAMAGE', monster: 'm-gargoyle', amount: 1 })),
    ).toBe('MONSTER_NOT_SEEN');
  });

  it('revealing R12 fires note B (the statue warning)', () => {
    expect(note('B')?.trigger).toEqual({ type: 'areaRevealed', area: 'R12' });
    const before = run(...toR12.slice(0, -1));
    const r = reduce(level, before, open('d6'));
    expect(r.prompts.find((p) => p.kind === 'note')).toMatchObject({ noteId: 'n-B', at: [4, 11] });
  });

  it('opening d6 (the way in) does not wake it; opening d8 into R20 does', () => {
    const s = run(...toR12);
    expect(s.notesFired).not.toContain('n-B-wake');
    const r = reduce(level, s, open('d8'));
    expect(r.prompts).toContainEqual(
      expect.objectContaining({ kind: 'monsterState', monster: 'm-gargoyle', state: 'active' }),
    );
    expect(dormantFigures(level, r.state)).toEqual([]);
    const g = monstersInPlay(level, r.state).find((m) => m.id === 'm-gargoyle')!;
    expect(g).toMatchObject({ state: 'active', dead: false });
    expect(liveMonstersInRoom(level, r.state, 'R12')).toContain('m-gargoyle');
    expect(r.state.revealedRooms.has('R20')).toBe(true);
    const wake = quest.notes.find((n) => n.id === 'n-B-wake')!;
    const text = wake.effects.find((e) => e.type === 'showText') as { text: string };
    expect(text.text).toContain('do nothing');
  });
});

describe('quest 5: letter C, the gas chest', () => {
  it('the chest carries a gas trap worth 2 Body Points', () => {
    const trap = quest.traps.find((t) => t.kind === 'chest');
    expect(trap).toMatchObject({ furniture: 'f-chest' });
    expect(trap?.effect).toContain('2 Body Points');
    expect(quest.furniture.find((f) => f.id === 'f-chest')?.cells).toEqual([[1, 17]]);
  });

  it('R20 holds three skeletons, a pit, a spear trap and the chest', () => {
    const s = run(...toR20);
    expect(s.revealedRooms.has('R20')).toBe(true);
    for (const m of ['m11', 'm12', 'm13']) expect(s.seenMonsters.has(m)).toBe(true);
    expect(s.seenFurniture.has('f-chest')).toBe(true);
    expect(s.seenTraps.has('t3')).toBe(true);
    expect(s.seenTraps.has('t4')).toBe(true);
  });

  it('searching springs the gas trap first, then note C gives 144 gold and no card', () => {
    const s = run(...toR20, kill('m11'), kill('m12'), kill('m13'));
    const r = reduce(level, s, search('R20'));
    expect(kinds(r)[0]).toBe('trapSprung');
    expect(r.prompts.find((p) => p.kind === 'note')).toMatchObject({
      noteId: 'n-C',
      at: [2, 16],
      consumesTreasure: true,
    });
    expect(kinds(r)).not.toContain('drawCard');
    const gift = note('C')?.effects.find((e) => e.type === 'giveItem') as { text: string };
    expect(gift.text).toContain('144');
  });

  it('a hero who searches again later draws a card (no second note)', () => {
    const s = run(...toR20, kill('m11'), kill('m12'), kill('m13'));
    const r1 = reduce(level, s, search('R20'));
    const r2 = reduce(level, r1.state, search('R20', 'dwarf'));
    expect(kinds(r2)).toEqual(['drawCard']);
  });
});

describe('quest 5: letter D, the Talisman of Lore', () => {
  it('R11 holds two zombies, two skeletons, a mummy, a table and two bookcases', () => {
    const ids = quest.monsters.filter((m) => areaOf(m.cell!) === 'R11').map((m) => m.id);
    expect(ids.sort()).toEqual(['m4', 'm5', 'm6', 'm7', 'm8']);
    expect(quest.furniture.filter((f) => f.type === 'bookcase')).toHaveLength(2);
    expect(quest.doors.find((d) => d.id === 'd13')).toEqual({
      id: 'd13',
      a: [15, 6],
      b: [15, 7],
    });
  });

  it('first search of R11 finds the talisman and completes the objective', () => {
    expect(note('D')?.trigger).toEqual({ type: 'treasureSearch', area: 'R11', first: true });
    expect(note('D')?.consumesTreasure).toBe(true);
    expect(note('D')?.effects.map((e) => e.type)).toContain('completeObjective');
    const gift = note('D')?.effects.find((e) => e.type === 'giveItem') as { text: string };
    expect(gift.text).toContain('Talisman of Lore');
  });

  it('after d13 opens, searching R11 gives the note and ticks the goal', () => {
    // d13 sits on the corridor [15,6]. Look around the top corridor, then the east side.
    const events = openVia([open('d1')], 'd13');
    const s = run(...events);
    expect(s.revealedRooms.has('R11')).toBe(true);
    for (const m of ['m4', 'm5', 'm6', 'm7', 'm8']) expect(s.seenMonsters.has(m)).toBe(true);
    expect(s.seenFurniture.has('f-table')).toBe(true);
    expect(objectivesStatus(level, s).goalDone).toBe(false);
    const cleared = run(...events, ...['m4', 'm5', 'm6', 'm7', 'm8'].map(kill));
    const r = reduce(level, cleared, search('R11'));
    expect(r.prompts.find((p) => p.kind === 'note')).toMatchObject({ noteId: 'n-D', at: [10, 9] });
    expect(kinds(r)).not.toContain('drawCard');
    expect(objectivesStatus(level, r.state).goalDone).toBe(true);
  });
});

describe('quest 5: letter E, the throne secret door', () => {
  const inR07 = run(...toR07);

  it('secret door searches in R07 and R08 find nothing, not even s1', () => {
    const r = reduce(level, inR07, { type: 'SEARCH_SECRET_DOORS', area: 'R07' });
    expect(kinds(r)).toEqual(['note']);
    expect(r.state.seenDoors.has('s1')).toBe(false);
    const s8 = run(...toR08);
    const r8 = reduce(level, s8, { type: 'SEARCH_SECRET_DOORS', area: 'R08', override: true });
    expect(kinds(r8)).toEqual(['note']);
    expect(r8.state.seenDoors.has('s1')).toBe(false);
  });

  it('a treasure search in R07 finds the key, no card, and shows the secret door s1', () => {
    expect(note('E')?.trigger).toEqual({ type: 'treasureSearch', area: 'R07', first: true });
    expect(note('E')?.consumesTreasure).toBe(true);
    const r = reduce(level, inR07, search('R07'));
    expect(kinds(r)).toEqual(['note', 'secretDoorAdded']);
    expect(r.prompts.find((p) => p.kind === 'note')).toMatchObject({ noteId: 'n-E', at: [3, 7] });
    expect(r.state.seenDoors.has('s1')).toBe(true);
    expect(r.state.openDoors.has('s1')).toBe(false);
    expect(journal(level, r.state).map((j) => j.letter)).toContain('E');
  });

  it('the found secret door s1 opens onto R08', () => {
    const r = reduce(level, inR07, search('R07'));
    const o = reduce(level, r.state, open('s1'));
    expect(o.state.revealedRooms.has('R08')).toBe(true);
    for (const m of ['m1', 'm2', 'm3']) expect(o.state.seenMonsters.has(m)).toBe(true);
  });

  it('a second treasure search in R07 draws a normal card', () => {
    const r = reduce(level, inR07, search('R07'));
    const again = reduce(level, r.state, search('R07', 'elf'));
    expect(kinds(again)).toEqual(['drawCard']);
  });

  it('the other secret door s2 joins R14 to the corridor and is found by a normal search', () => {
    expect(areaOf([8, 10])).toBe('R14');
    expect(areaOf([9, 10])).toBe('C');
    expect(
      quest.notes.filter((n) => n.trigger.type === 'secretDoorSearch').map((n) => n.trigger),
    ).toEqual([
      { type: 'secretDoorSearch', area: 'R07' },
      { type: 'secretDoorSearch', area: 'R08' },
    ]);
  });
});

describe('quest 5: the end', () => {
  it('only the talisman completes the objective; there is no reward text', () => {
    expect(quest.objectives).toHaveLength(1);
    expect(quest.rewards).toBe('');
    expect(objectivesStatus(level, initialState(level, 1)).goalDone).toBe(false);
  });
});
