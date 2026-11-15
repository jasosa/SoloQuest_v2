/** Walk-through of quest 2, The Rescue of Sir Ragnar: secret door, alarm, NPC, chest trap, no search in the cell. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { board } from '../../engine/board/board';
import { buildLevel } from '../../engine/board/level';
import type { GameEvent } from '../../engine/game/events';
import { lookHintCells } from '../../engine/game/hints';
import { initialState, reduce, replay } from '../../engine/game/reducer';
import {
  availableEndings,
  endSummary,
  journal,
  mapLetters,
  npcsInPlay,
  objectivesStatus,
} from '../../engine/game/view';
import { parseQuest } from '../../engine/quest/loader';
import { validateQuest } from '../../engine/quest/validate';

const quest = parseQuest(
  JSON.parse(
    readFileSync(resolve(import.meta.dirname, 'q02-the-rescue-of-sir-ragnar.json'), 'utf8'),
  ),
);
const level = buildLevel(quest);
const open = (door: string): GameEvent => ({ type: 'OPEN_DOOR', door });
const run = (...events: GameEvent[]) => replay(level, 1, events);
// Looks are only allowed from hint squares; a square that shows nothing new is skipped.
const extend = (events: GameEvent[], ...cells: [number, number][]): GameEvent[] => {
  const out = [...events];
  for (const [x, y] of cells)
    if (lookHintCells(level, run(...out)).some((c) => c[0] === x && c[1] === y))
      out.push({ type: 'LOOK_FROM', cell: [x, y] });
  return out;
};
const looks = (...cells: [number, number][]): GameEvent[] =>
  extend([open('d1')], ...cells).slice(1);
const toD8 = looks([13, 12], [13, 18]);
const toD2 = looks([9, 12], [9, 9]);
const toD3 = looks([9, 12], [9, 6], [14, 6]);
const toD7 = looks([16, 12], [16, 9], [22, 9]);
const note = (letter: string) => quest.notes.find((n) => n.letter === letter);
const monster = (id: string) => quest.monsters.find((m) => m.id === id);
const search = (room: string): GameEvent => ({ type: 'SEARCH_TREASURE', room, hero: 'barbarian' });
// To the cell: d1, d8 (R18), d9 (R17), secret door found in R17, then the cell door d10 is next.
const kill: GameEvent = { type: 'MONSTER_KILL', monster: 'm5' }; // the goblin of R12
const intoCell: GameEvent[] = [
  open('d1'),
  ...toD8,
  open('d8'),
  open('d9'),
  { type: 'SEARCH_SECRET_DOORS', area: 'R17', override: true },
  open('s1'),
];

describe('quest 2: data', () => {
  it('is valid against the board', () => {
    expect(validateQuest(quest, board)).toEqual([]);
  });

  it('has 10 doors, one secret door, no false doors, 5 blocks and 21 monsters', () => {
    expect(quest.doors).toHaveLength(10);
    expect(quest.secretDoors).toEqual([{ id: 's1', a: [8, 12], b: [8, 13] }]);
    expect(quest.falseDoors).toEqual([]);
    expect(quest.blocks).toHaveLength(5);
    expect(quest.monsters).toHaveLength(21);
    expect(quest.monsters.filter((m) => m.type === 'abomination')).toHaveLength(1);
    expect(quest.wandering).toEqual({ monster: 'orc' });
  });

  it('has the Sir Ragnar NPC: 2 defend dice, 2 Body Points, on the X square of the cell', () => {
    expect(quest.npcs).toHaveLength(1);
    const r = quest.npcs[0]!;
    expect(r).toMatchObject({
      id: 'ragnar',
      name: 'Sir Ragnar',
      defend: 2,
      body: 2,
      cell: [5, 11],
    });
    expect(board.cells[r.cell[1]]?.[r.cell[0]]).toBe('R13');
    expect(quest.markers).toEqual([expect.objectContaining({ label: 'X', cell: [5, 11] })]);
  });

  it('chest A carries a chest trap (poison needle, 1 Body Point)', () => {
    expect(quest.traps).toEqual([
      expect.objectContaining({ kind: 'chest', furniture: 'f-chest-a' }),
    ]);
    expect(quest.traps[0]?.effect).toContain('1 Body Point');
  });
});

describe('quest 2: walk-through', () => {
  it('starts in the center room with the stairs and only door d1', () => {
    const s = initialState(level, 1);
    expect(s.revealedRooms).toEqual(new Set(['R11']));
    expect(s.seenFurniture.has('f-stairs')).toBe(true);
    expect(s.seenMonsters.size).toBe(0);
    expect(s.seenDoors).toEqual(new Set(['d1']));
    expect(npcsInPlay(level, s)).toEqual([]);
  });

  it('d8 shows R18, d9 then shows R17 with orcs and a table; the secret door stays hidden', () => {
    const s = run(open('d1'), ...toD8, open('d8'));
    expect(s.revealedRooms.has('R18')).toBe(true);
    expect(s.seenDoors.has('d9')).toBe(true);
    const t = run(open('d1'), ...toD8, open('d8'), open('d9'));
    expect(t.revealedRooms.has('R17')).toBe(true);
    expect(t.seenMonsters.has('m8')).toBe(true);
    expect(t.seenMonsters.has('m9')).toBe(true);
    expect(t.seenFurniture.has('f-table-sw')).toBe(true);
    expect(t.seenDoors.has('s1')).toBe(false);
  });

  it('the cell is reached by the secret door of R17, then door d10 shows Sir Ragnar', () => {
    const s = run(...intoCell);
    expect(s.revealedRooms.has('R14')).toBe(true);
    expect(s.seenMonsters.has('m6')).toBe(true); // abomination
    expect(s.seenMonsters.has('m7')).toBe(true); // orc
    expect(s.seenDoors.has('d10')).toBe(true);
    expect(s.revealedRooms.has('R13')).toBe(false);
    expect(s.notesFired).toEqual([]);
  });

  it('d2 shows R12 with a goblin and trapped chest A', () => {
    const s = run(open('d1'), ...toD2, open('d2'));
    expect(s.revealedRooms.has('R12')).toBe(true);
    expect(s.seenMonsters.has('m5')).toBe(true);
    expect(s.seenFurniture.has('f-chest-a')).toBe(true);
  });

  it('d3 shows R04 with two orcs, d4 then shows R05, d5 shows R09 with chest B', () => {
    const s = run(open('d1'), ...toD3, open('d3'));
    expect(s.revealedRooms.has('R04')).toBe(true);
    expect(s.seenMonsters.has('m13')).toBe(true);
    expect(s.seenMonsters.has('m14')).toBe(true);
    expect(s.seenDoors.has('d4')).toBe(true);
    const t = run(open('d1'), ...toD3, open('d3'), open('d4'));
    expect(t.revealedRooms.has('R05')).toBe(true);
    expect(t.seenFurniture.has('f-table-n')).toBe(true);
    for (const m of ['m15', 'm16']) expect(t.seenMonsters.has(m)).toBe(true);
    const u = run(open('d1'), ...toD3, open('d3'), open('d4'), open('d5'));
    expect(u.revealedRooms.has('R09')).toBe(true);
    for (const m of ['m17', 'm18', 'm19']) expect(u.seenMonsters.has(m)).toBe(true);
    expect(u.seenFurniture.has('f-chest-b')).toBe(true);
    expect(u.seenFurniture.has('f-cupboard')).toBe(true);
    expect(u.seenDoors.has('d6')).toBe(true);
  });

  it('d7 shows R10 from the east corridor: two orcs', () => {
    const s = run(open('d1'), ...toD7, open('d7'));
    expect(s.revealedRooms.has('R10')).toBe(true);
    expect(s.seenMonsters.has('m20')).toBe(true);
    expect(s.seenMonsters.has('m21')).toBe(true);
  });

  it('never reveals rock rooms before the alarm', () => {
    const ev = extend(intoCell, [9, 12], [9, 9], [9, 6], [14, 6], [16, 12], [16, 9], [22, 9]);
    const all = run(...ev, open('d2'), open('d3'), open('d4'), open('d5'), open('d6'), open('d7'));
    for (const k of all.seenCells) expect(level.rock.has(k)).toBe(false);
    for (const r of quest.rock.rooms) expect(all.revealedRooms.has(r)).toBe(false);
  });
});

describe('quest 2: chest A (poison needle) and chest B', () => {
  it('A: the first search springs the armed trap, then the note says the chest is empty', () => {
    const before = run(open('d1'), ...toD2, open('d2'), kill);
    const r = reduce(level, before, search('R12'));
    expect(r.prompts.map((p) => p.kind)).toContain('trapSprung');
    expect(r.prompts.find((p) => p.kind === 'note')).toMatchObject({
      noteId: 'n-A',
      letter: 'A',
      at: [3, 13],
      consumesTreasure: true,
    });
    expect(note('A')?.trigger).toEqual({ type: 'treasureSearch', area: 'R12', first: true });
  });

  it('A: a disarmed trap does not spring, the chest is still empty', () => {
    const before = run(open('d1'), ...toD2, open('d2'), kill, {
      type: 'SEARCH_TRAPS',
      furniture: 'f-chest-a',
      override: true,
    });
    const d = reduce(level, before, {
      type: 'TRAP_DISARM',
      trap: 't1',
      by: 'toolkit',
      result: 'other',
    });
    const r = reduce(level, d.state, search('R12'));
    expect(r.prompts.map((p) => p.kind)).not.toContain('trapSprung');
    expect(r.prompts.find((p) => p.kind === 'note')).toMatchObject({ noteId: 'n-A' });
  });

  it('B: 60 gold coins and a potion of healing for the first search of R09', () => {
    expect(note('B')?.trigger).toEqual({ type: 'treasureSearch', area: 'R09', first: true });
    expect(note('B')?.consumesTreasure).toBe(true);
    const gift = note('B')?.effects.find((e) => e.type === 'giveItem') as { text: string };
    expect(gift.text).toContain('60 gold');
    expect(gift.text).toContain('potion of healing');
    const e = note('B')?.effects[0];
    expect(e?.type === 'showText' && e.text.includes('4')).toBe(true);
    const m = monster('m18')!.cell!;
    expect(board.cells[m[1]]?.[m[0]]).toBe('R09');
  });
});

describe('quest 2: the alarm', () => {
  const before = run(...intoCell);
  const r = reduce(level, before, open('d10'));

  it('opening the cell door fires the alarm note once', () => {
    expect(before.notesFired).toEqual([]);
    expect(r.state.notesFired).toEqual(['n-alarm']);
    expect(r.state.flags['alarm']).toBe(true);
    expect(r.state.revealedRooms.has('R13')).toBe(true);
  });

  it('reveals every monster and every piece of furniture, never rock', () => {
    expect(r.state.seenMonsters.size).toBe(21);
    for (const f of quest.furniture) expect(r.state.seenFurniture.has(f.id)).toBe(true);
    for (const k of r.state.seenCells) expect(level.rock.has(k)).toBe(false);
  });

  it('opens all normal doors', () => {
    for (const d of quest.doors) expect(r.state.openDoors.has(d.id)).toBe(true);
  });

  it('puts Sir Ragnar on the board and tells who moves him', () => {
    expect(npcsInPlay(level, r.state)).toEqual([
      expect.objectContaining({
        id: 'ragnar',
        name: 'Sir Ragnar',
        defend: 2,
        body: 2,
        cell: [5, 11],
      }),
    ]);
    expect(r.prompts.find((x) => x.kind === 'npcSpawned')).toMatchObject({
      npc: 'ragnar',
      defend: 2,
    });
    const alarm = quest.notes.find((n) => n.id === 'n-alarm')!;
    const shown = alarm.effects.find((e) => e.type === 'showText') as { text: string };
    expect(shown.text).toContain('1 red die');
    expect(shown.text).toContain('2 defend dice');
    expect(shown.text).toContain('2 Body Points');
  });

  it('no treasure search in the cell: a message, no card, and the hero keeps the search', () => {
    const s = reduce(level, r.state, search('R13'));
    expect(s.prompts.find((p) => p.kind === 'note')).toMatchObject({
      noteId: 'n-cell',
      consumesTreasure: false,
      blocksSearch: true,
    });
    expect(s.prompts.map((p) => p.kind)).not.toContain('drawCard');
    expect(s.state.treasureSearched['R13']).toBeUndefined();
    expect(note('A')?.blocksSearch).toBeUndefined();
    expect(quest.notes.find((n) => n.id === 'n-cell')?.consumesTreasure).toBeUndefined();
  });

  it('other doors never trigger the alarm', () => {
    const s = run(open('d1'), ...toD3, open('d3'));
    expect(s.flags['alarm']).toBeUndefined();
    expect(s.openDoors.has('d10')).toBe(false);
  });
});

describe('quest 2: the end', () => {
  it('the objective is done only after the players say Sir Ragnar is back on the stairs', () => {
    const before = reduce(level, run(...intoCell), open('d10')).state;
    expect(objectivesStatus(level, before).goalDone).toBe(false);
    const r = reduce(level, before, { type: 'MANUAL_TRIGGER', note: 'n-home' });
    expect(r.state.objectivesDone).toContain('o1');
    expect(objectivesStatus(level, r.state).goalDone).toBe(true);
    expect(quest.rewards).toContain('240');
  });

  it('has the ending "Sir Ragnar died": not a win, no reward shown', () => {
    expect(availableEndings(level).map((e) => e.id)).toEqual(['ragnar-died']);
    const s = reduce(level, run(...intoCell), {
      type: 'END_QUEST',
      outcome: 'ending',
      ending: 'ragnar-died',
    }).state;
    expect(endSummary(level, s)).toMatchObject({
      outcome: 'ending',
      ending: { label: 'Sir Ragnar died' },
      won: false,
      rewards: undefined,
    });
  });

  it('the stairs note only works after the alarm', () => {
    expect(quest.notes.find((n) => n.id === 'n-home')?.when).toEqual([{ flag: 'alarm', is: true }]);
    expect(objectivesStatus(level, run(open('d1'))).goalDone).toBe(false);
  });

  it('letter A shows in the journal and on the map once fired', () => {
    const s = run(open('d1'), ...toD2, open('d2'), kill);
    const r = reduce(level, s, search('R12'));
    expect(journal(level, r.state).map((j) => j.letter)).toContain('A');
    expect(mapLetters(level, r.state)).toEqual([{ note: 'n-A', letter: 'A', at: [3, 13] }]);
  });
});
