/** Walk-through of quest 3, Lair of the Orc Warlord: Ulag, armory staff (A), cupboard gold and potion (B). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { board } from '../../engine/board/board';
import { buildLevel } from '../../engine/board/level';
import type { GameEvent } from '../../engine/game/events';
import { lookHintCells } from '../../engine/game/hints';
import { initialState, reduce, replay } from '../../engine/game/reducer';
import { journal, objectivesStatus } from '../../engine/game/view';
import { parseQuest } from '../../engine/quest/loader';
import { validateQuest } from '../../engine/quest/validate';

const quest = parseQuest(
  JSON.parse(
    readFileSync(resolve(import.meta.dirname, 'q03-lair-of-the-orc-warlord.json'), 'utf8'),
  ),
);
const level = buildLevel(quest);
const open = (door: string): GameEvent => ({ type: 'OPEN_DOOR', door });
const run = (...events: GameEvent[]) => replay(level, 1, events);
const search = (room: string): GameEvent => ({ type: 'SEARCH_TREASURE', room, hero: 'barbarian' });
const note = (letter: string) => quest.notes.find((n) => n.letter === letter);
const monster = (id: string) => quest.monsters.find((m) => m.id === id);
// Looks are only allowed from hint squares; a square that shows nothing new is skipped.
const extend = (events: GameEvent[], ...cells: [number, number][]): GameEvent[] => {
  const out = [...events];
  for (const [x, y] of cells)
    if (lookHintCells(level, run(...out)).some((c) => c[0] === x && c[1] === y))
      out.push({ type: 'LOOK_FROM', cell: [x, y] });
  return out;
};
const toD3 = [open('d1'), open('d2'), open('d3')];
const toD4 = extend(toD3, [0, 9], [0, 5], [0, 3]);
const areaOf = (c: [number, number]) => board.cells[c[1]]?.[c[0]];

describe('quest 3: data', () => {
  it('is valid against the board', () => {
    expect(validateQuest(quest, board)).toEqual([]);
  });

  it('has 9 doors, no secret or false doors, 3 blocks, 19 monsters, a pit, wandering orc', () => {
    expect(quest.doors).toHaveLength(9);
    expect(quest.secretDoors).toEqual([]);
    expect(quest.falseDoors).toEqual([]);
    expect(quest.blocks).toHaveLength(3);
    expect(quest.monsters).toHaveLength(19);
    expect(quest.monsters.filter((m) => m.type === 'abomination')).toHaveLength(3);
    expect(quest.monsters.filter((m) => m.type === 'dreadWarrior')).toHaveLength(1);
    expect(quest.traps).toEqual([expect.objectContaining({ kind: 'pit', cell: [8, 11] })]);
    expect(quest.wandering).toEqual({ monster: 'orc' });
    expect(quest.start).toEqual({ area: 'R03' });
  });

  it('Ulag is an orc with the stats from the quest: 10 / 4 / 5 / 2 / 3', () => {
    const u = monster('m-ulag')!;
    expect(u).toMatchObject({
      type: 'orc',
      name: 'Ulag',
      cell: [6, 14],
      overrides: { move: 10, att: 4, def: 5, body: 2, mind: 3 },
    });
    expect(areaOf(u.cell!)).toBe('R17');
  });
});

describe('quest 3: walk-through', () => {
  it('starts in the stairs room R03 with only door d1 known', () => {
    const s = initialState(level, 1);
    expect(s.revealedRooms).toEqual(new Set(['R03']));
    expect(s.seenFurniture.has('f-stairs')).toBe(true);
    expect(s.seenMonsters.size).toBe(0);
    expect(s.seenDoors).toEqual(new Set(['d1']));
  });

  it('d1 shows R08: four goblins and the table, with door d2', () => {
    const s = run(open('d1'));
    expect(s.revealedRooms.has('R08')).toBe(true);
    for (const m of ['m3', 'm4', 'm5', 'm6']) expect(s.seenMonsters.has(m)).toBe(true);
    expect(s.seenFurniture.has('f-table-n')).toBe(true);
    expect(s.seenDoors.has('d2')).toBe(true);
  });

  it('d2 shows R07: abomination, fireplace, door d3', () => {
    const s = run(open('d1'), open('d2'));
    expect(s.revealedRooms.has('R07')).toBe(true);
    expect(s.seenMonsters.has('m7')).toBe(true);
    expect(s.seenFurniture.has('f-fireplace')).toBe(true);
    expect(s.seenDoors.has('d3')).toBe(true);
  });

  it('d4 shows the armory R01 with an abomination, an orc and the weapons rack', () => {
    const s = run(...toD4, open('d4'));
    expect(s.revealedRooms.has('R01')).toBe(true);
    expect(s.seenMonsters.has('m1')).toBe(true);
    expect(s.seenMonsters.has('m2')).toBe(true);
    expect(s.seenFurniture.has('f-weapons')).toBe(true);
  });

  it('d5 shows R13 with two orcs; d6 shows R12 with two goblins and the cupboard', () => {
    const s = run(open('d1'), open('d2'), open('d3'), open('d5'));
    expect(s.revealedRooms.has('R13')).toBe(true);
    expect(s.seenMonsters.has('m8')).toBe(true);
    expect(s.seenMonsters.has('m9')).toBe(true);
    const t = run(open('d1'), open('d2'), open('d3'), open('d5'), open('d6'));
    expect(t.revealedRooms.has('R12')).toBe(true);
    expect(t.seenMonsters.has('m10')).toBe(true);
    expect(t.seenMonsters.has('m11')).toBe(true);
    expect(t.seenFurniture.has('f-cupboard')).toBe(true);
    expect(t.seenDoors.has('d8')).toBe(true);
  });

  it('d7 shows the throne room R14; d8 shows R20; d9 shows Ulag in R17', () => {
    const base = [open('d1'), open('d2'), open('d3'), open('d5'), open('d6')];
    const r14 = run(...base, open('d8'), open('d9'), open('d7'));
    expect(r14.revealedRooms.has('R14')).toBe(true);
    expect(r14.seenFurniture.has('f-chest-r14')).toBe(true);
    const r20 = run(...base, open('d8'));
    expect(r20.revealedRooms.has('R20')).toBe(true);
    for (const m of ['m15', 'm16', 'm17', 'm18']) expect(r20.seenMonsters.has(m)).toBe(true);
    const r17 = run(...base, open('d8'), open('d9'));
    expect(r17.revealedRooms.has('R17')).toBe(true);
    for (const m of ['m-ulag', 'm12', 'm13', 'm14']) expect(r17.seenMonsters.has(m)).toBe(true);
    expect(r17.seenFurniture.has('f-table-s')).toBe(true);
  });

  it('never reveals rock rooms', () => {
    const s = run(...toD4, open('d4'), open('d5'), open('d6'), open('d8'), open('d9'), open('d7'));
    for (const k of s.seenCells) expect(level.rock.has(k)).toBe(false);
    for (const r of quest.rock.rooms) expect(s.revealedRooms.has(r)).toBe(false);
  });
});

describe('quest 3: letters A and B', () => {
  it('A: first search of the armory R01 gives a staff', () => {
    expect(note('A')?.trigger).toEqual({ type: 'treasureSearch', area: 'R01', first: true });
    expect(note('A')?.consumesTreasure).toBe(true);
    const s = run(
      ...toD4,
      open('d4'),
      { type: 'MONSTER_KILL', monster: 'm1' },
      { type: 'MONSTER_KILL', monster: 'm2' },
    );
    const r = reduce(level, s, search('R01'));
    expect(r.prompts.find((p) => p.kind === 'note')).toMatchObject({
      noteId: 'n-A',
      letter: 'A',
      at: [3, 3],
      consumesTreasure: true,
    });
    expect(r.prompts.map((p) => p.kind)).not.toContain('drawCard');
    const gift = note('A')?.effects.find((e) => e.type === 'giveItem') as { text: string };
    expect(gift.text).toContain('staff');
  });

  it('B: first search of R12 gives 24 gold coins and a potion of healing (4 Body Points)', () => {
    expect(note('B')?.trigger).toEqual({ type: 'treasureSearch', area: 'R12', first: true });
    const s = run(
      open('d1'),
      open('d2'),
      open('d3'),
      open('d5'),
      open('d6'),
      { type: 'MONSTER_KILL', monster: 'm10' },
      { type: 'MONSTER_KILL', monster: 'm11' },
    );
    const r = reduce(level, s, search('R12'));
    expect(r.prompts.find((p) => p.kind === 'note')).toMatchObject({
      noteId: 'n-B',
      at: [2, 10],
      consumesTreasure: true,
    });
    const gift = note('B')?.effects.find((e) => e.type === 'giveItem') as { text: string };
    expect(gift.text).toContain('24 gold');
    expect(gift.text).toContain('potion of healing');
    const e = note('B')?.effects[0];
    expect(e?.type === 'showText' && e.text.includes('4')).toBe(true);
    expect(journal(level, r.state).map((j) => j.letter)).toContain('B');
  });
});

describe('quest 3: the end', () => {
  it('killing Ulag completes the objective; other kills do not', () => {
    const s = run(
      open('d1'),
      open('d2'),
      open('d3'),
      open('d5'),
      open('d6'),
      open('d8'),
      open('d9'),
    );
    expect(objectivesStatus(level, s).goalDone).toBe(false);
    const other = reduce(level, s, { type: 'MONSTER_KILL', monster: 'm3' }).state;
    expect(objectivesStatus(level, other).goalDone).toBe(false);
    const k = reduce(level, other, { type: 'MONSTER_KILL', monster: 'm-ulag' }).state;
    expect(objectivesStatus(level, k).goalDone).toBe(true);
    expect(quest.rewards).toContain('180');
  });
});
