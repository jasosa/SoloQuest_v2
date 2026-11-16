/** Walk-through of quest 4 (Prince Magnus Gold): the chests (A), Gulthor, a secret door, a long way round. */
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
  JSON.parse(readFileSync(resolve(import.meta.dirname, 'q04-prince-magnus-gold.json'), 'utf8')),
);
const level = buildLevel(quest);
const open = (door: string): GameEvent => ({ type: 'OPEN_DOOR', door });
const run = (...events: GameEvent[]) => replay(level, 1, events);
const note = (id: string) => quest.notes.find((n) => n.id === id);
const monster = (id: string) => quest.monsters.find((m) => m.id === id);
// Looks are only allowed from hint squares; a square that shows nothing new is skipped.
const extend = (events: GameEvent[], ...cells: [number, number][]): GameEvent[] => {
  const out = [...events];
  for (const [x, y] of cells)
    if (lookHintCells(level, run(...out)).some((c) => c[0] === x && c[1] === y))
      out.push({ type: 'LOOK_FROM', cell: [x, y] });
  return out;
};
// Start room R21, door d13 to R22, door d14 to the south corridor.
const toD14 = [open('d13'), open('d14')];
// West along the south corridor to R20 (d12), through R12 (d11, d6) to the north-west corridor.
const toD12 = extend(toD14, [18, 18], [10, 18], [2, 18]);
const toD6 = [...toD12, open('d12'), open('d11'), open('d6')];
const toRow9 = extend(toD6, [2, 9]);
const secret: GameEvent = { type: 'SEARCH_SECRET_DOORS', area: 'R03', override: true };
// The long way round: R08, R02, R03, the secret door, the north corridor, the east side, R10.
const toS1 = [...toRow9, open('d5'), open('d2'), open('d1'), secret, open('s1')];
const toD10 = extend(toS1, [12, 2], [12, 0], [25, 0], [25, 4]);
const toD9 = [...toD10, open('d10')];
const toD8 = extend([...toD9, open('d9')], [21, 9], [16, 9]);

describe('quest 4: data', () => {
  it('monster types match the map: 12 orcs, 6 goblins, 1 dread warrior, 1 abomination', () => {
    const count = (type: string) => quest.monsters.filter((m) => m.type === type).length;
    expect([count('orc'), count('goblin'), count('dreadWarrior'), count('abomination')]).toEqual([
      12, 6, 1, 1,
    ]);
  });

  it('is valid against the board', () => {
    expect(validateQuest(quest, board)).toEqual([]);
  });

  it('has 14 doors, one secret door, no false doors, 11 blocks, 20 monsters, 7 traps', () => {
    expect(quest.doors).toHaveLength(14);
    expect(quest.secretDoors).toEqual([{ id: 's1', a: [11, 2], b: [12, 2] }]);
    expect(quest.falseDoors).toEqual([]);
    expect(quest.blocks).toHaveLength(11);
    expect(quest.monsters).toHaveLength(20);
    expect(quest.traps.filter((t) => t.kind === 'spear')).toHaveLength(4);
    expect(quest.traps.filter((t) => t.kind === 'pit')).toHaveLength(3);
    expect(quest.wandering).toEqual({ monster: 'abomination' });
    expect(quest.start).toEqual({ area: 'R21' });
  });

  it('Gulthor is the Dread warrior next to the three chests in the center room', () => {
    const g = monster('m-gulthor')!;
    expect(g).toMatchObject({ type: 'dreadWarrior', name: 'Gulthor', cell: [11, 9] });
    expect(board.cells[9]?.[11]).toBe('R11');
    const chests = quest.furniture.filter((f) => f.type === 'chest');
    expect(chests.map((c) => c.cells)).toEqual([[[10, 8]], [[10, 9]], [[10, 10]]]);
  });
});

describe('quest 4: walk-through', () => {
  it('starts in the stairs room R21 with only door d13 known', () => {
    const s = initialState(level, 1);
    expect(s.revealedRooms).toEqual(new Set(['R21']));
    expect(s.seenFurniture.has('f-stairs')).toBe(true);
    expect(s.seenMonsters.size).toBe(0);
    expect(s.seenDoors).toEqual(new Set(['d13']));
  });

  it('d13 shows R22 with two goblins and door d14', () => {
    const s = run(open('d13'));
    expect(s.revealedRooms.has('R22')).toBe(true);
    expect(s.seenMonsters.has('m18')).toBe(true);
    expect(s.seenMonsters.has('m19')).toBe(true);
    expect(s.seenDoors.has('d14')).toBe(true);
  });

  it('d12 shows R20 with two orcs and the table; d11 shows R12 with two orcs', () => {
    const s = run(...toD12, open('d12'));
    expect(s.revealedRooms.has('R20')).toBe(true);
    expect(s.seenMonsters.has('m6')).toBe(true);
    expect(s.seenMonsters.has('m7')).toBe(true);
    expect(s.seenFurniture.has('f-table')).toBe(true);
    expect(s.seenDoors.has('d11')).toBe(true);
    const t = run(...toD12, open('d12'), open('d11'));
    expect(t.revealedRooms.has('R12')).toBe(true);
    expect(t.seenMonsters.has('m4')).toBe(true);
    expect(t.seenMonsters.has('m5')).toBe(true);
    expect(t.seenDoors.has('d6')).toBe(true);
  });

  it('d5 shows R08 with the rack and two goblins, and doors d2 and d4', () => {
    const s = run(...toRow9, open('d5'));
    expect(s.revealedRooms.has('R08')).toBe(true);
    expect(s.seenFurniture.has('f-rack')).toBe(true);
    expect(s.seenMonsters.has('m2')).toBe(true);
    expect(s.seenMonsters.has('m3')).toBe(true);
    expect(s.seenDoors.has('d2')).toBe(true);
    expect(s.seenDoors.has('d4')).toBe(true);
  });

  it('d2 shows R02 with an orc; d1 shows R03 with the cupboard', () => {
    const base = [...toRow9, open('d5'), open('d2')];
    const s = run(...base);
    expect(s.revealedRooms.has('R02')).toBe(true);
    expect(s.seenMonsters.has('m1')).toBe(true);
    const t = run(...base, open('d1'));
    expect(t.revealedRooms.has('R03')).toBe(true);
    expect(t.seenFurniture.has('f-cupboard')).toBe(true);
  });

  it('the secret door of R03 stays hidden until it is searched for', () => {
    const base = [...toRow9, open('d5'), open('d2'), open('d1')];
    expect(run(...base).seenDoors.has('s1')).toBe(false);
    expect(run(...base, secret).seenDoors.has('s1')).toBe(true);
  });

  it('d7 shows the empty room R14', () => {
    const s = run(...toRow9, open('d7'));
    expect(s.revealedRooms.has('R14')).toBe(true);
    const inR14 = quest.monsters.filter((m) => board.cells[m.cell![1]]?.[m.cell![0]] === 'R14');
    expect(inR14).toEqual([]);
  });

  it('d9 shows R10 with three orcs and the fireplace; d8 shows the chest room R11', () => {
    const s = run(...toD9);
    expect(s.revealedRooms.has('R10')).toBe(true);
    for (const m of ['m15', 'm16', 'm17']) expect(s.seenMonsters.has(m)).toBe(true);
    expect(s.seenFurniture.has('f-fireplace')).toBe(true);
    const t = run(...toD8, open('d8'));
    expect(t.revealedRooms.has('R11')).toBe(true);
    for (const m of ['m-gulthor', 'm9', 'm10', 'm11', 'm12', 'm13'])
      expect(t.seenMonsters.has(m)).toBe(true);
    for (const f of ['f-chest1', 'f-chest2', 'f-chest3']) expect(t.seenFurniture.has(f)).toBe(true);
  });

  it('never reveals rock rooms', () => {
    const s = run(...toD8, open('d8'), open('d7'));
    for (const k of s.seenCells) expect(level.rock.has(k)).toBe(false);
    for (const r of quest.rock.rooms) expect(s.revealedRooms.has(r)).toBe(false);
  });
});

describe('quest 4: the chests (A) and the end', () => {
  it('A: opening the chest room fires the carry rules (one chest, 1 red die, no gold kept)', () => {
    expect(note('n-A')?.letter).toBe('A');
    expect(note('n-A')?.trigger).toEqual({ type: 'areaRevealed', area: 'R11' });
    const s = run(...toD8, open('d8'));
    expect(s.notesFired).toContain('n-A');
    const e = note('n-A')?.effects[0];
    expect(e?.type === 'showText' && e.text.includes('1 red die') && e.text.includes('250')).toBe(
      true,
    );
    expect(journal(level, s).map((j) => j.letter)).toContain('A');
  });

  it('the objective is done only when the players report the chests on the stairs', () => {
    const s = run(...toD8, open('d8'), { type: 'MONSTER_KILL', monster: 'm-gulthor' });
    expect(objectivesStatus(level, s).goalDone).toBe(false);
    const r = reduce(level, s, { type: 'CONFIRM_OBJECTIVE', objective: 'o1' });
    expect(objectivesStatus(level, r.state).goalDone).toBe(true);
    expect(quest.rewards).toContain('240');
  });
});
