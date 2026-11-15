/** Walk-through of quest 7, The Lost Wizard: stone Dread warriors, chest C needle + purple potion, Wardoz and his papers. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { board } from '../../engine/board/board';
import { buildLevel } from '../../engine/board/level';
import { statsOf } from '../../engine/data/monsters';
import type { GameEvent } from '../../engine/game/events';
import { lookHintCells } from '../../engine/game/hints';
import { initialState, reduce, replay } from '../../engine/game/reducer';
import { objectivesStatus } from '../../engine/game/view';
import { parseQuest } from '../../engine/quest/loader';
import { validateQuest } from '../../engine/quest/validate';

const quest = parseQuest(
  JSON.parse(readFileSync(resolve(import.meta.dirname, 'q07-the-lost-wizard.json'), 'utf8')),
);
const level = buildLevel(quest);
const open = (door: string): GameEvent => ({ type: 'OPEN_DOOR', door });
const kill = (m: string): GameEvent => ({ type: 'MONSTER_KILL', monster: m });
const run = (...events: GameEvent[]) => replay(level, 1, events);
const search = (room: string): GameEvent => ({ type: 'SEARCH_TREASURE', room, hero: 'barbarian' });
const note = (letter: string) => quest.notes.find((n) => n.letter === letter);
const monster = (id: string) => quest.monsters.find((m) => m.id === id);
const areaOf = (c: [number, number]) => board.cells[c[1]]?.[c[0]];
// From the stairs room: d1 into R07, d2 into the corridor, then look along the corridors until the door is in sight.
const seeing = (door: string, from: GameEvent[] = [open('d1'), open('d2')]): GameEvent[] => {
  const out: GameEvent[] = [...from];
  for (let i = 0; i < 120; i++) {
    const s = run(...out);
    if (s.seenDoors.has(door)) return out;
    const next = lookHintCells(level, s)[0];
    if (!next) break;
    out.push({ type: 'LOOK_FROM', cell: next });
  }
  throw new Error(`door ${door} never seen`);
};
const via = (door: string, from?: GameEvent[]): GameEvent[] => [...seeing(door, from), open(door)];
// The left rooms form a chain: d3 (R13), d4 (R12), d5 (R20), d6 onto the bottom corridor, d7 (R17).
const toR12: GameEvent[] = [...via('d3'), open('d4')];
const toR20: GameEvent[] = [...toR12, open('d5')];
const toR17: GameEvent[] = [...via('d7', [...toR20, open('d6')])];

describe('quest 7: data', () => {
  it('is valid against the board', () => {
    expect(validateQuest(quest, board)).toEqual([]);
  });

  it('has 11 doors, 6 block groups, 2 pits, a chest trap, 17 monsters, wandering mummy', () => {
    expect(quest.doors).toHaveLength(11);
    expect(quest.secretDoors).toEqual([]);
    expect(quest.blocks).toHaveLength(6);
    expect(quest.traps.map((t) => t.kind)).toEqual(['pit', 'pit', 'chest']);
    expect(quest.monsters).toHaveLength(17);
    expect(quest.monsters.filter((m) => m.type === 'skeleton')).toHaveLength(10);
    expect(quest.monsters.filter((m) => m.type === 'mummy')).toHaveLength(1);
    expect(quest.monsters.filter((m) => m.type === 'zombie')).toHaveLength(1);
    expect(quest.monsters.filter((m) => m.type === 'dreadWarrior')).toHaveLength(5);
    expect(quest.wandering).toEqual({ monster: 'mummy' });
    expect(quest.start).toEqual({ area: 'R08' });
  });
});

describe('quest 7: start and letter A', () => {
  it('starts in the stairs room R08 and sees only the door d1', () => {
    const s = initialState(level, 1);
    expect(s.revealedRooms).toEqual(new Set(['R08']));
    expect(s.seenFurniture.has('f-stairs')).toBe(true);
    expect(s.seenMonsters.size).toBe(0);
    expect(s.seenDoors.has('d1')).toBe(true);
  });

  it('A: every Dread warrior defends with 5 dice, the note is read at the start', () => {
    expect(note('A')?.trigger).toEqual({ type: 'questStart' });
    const dws = quest.monsters.filter((m) => m.type === 'dreadWarrior');
    expect(dws.map((m) => m.cell)).toEqual([
      [9, 6],
      [16, 6],
      [9, 12],
      [16, 12],
      [19, 17],
    ]);
    for (const m of dws) expect(statsOf(m).def).toBe(5);
  });
});

describe('quest 7: walk-through', () => {
  it('d1 opens R07: two skeletons and the tomb', () => {
    const s = run(open('d1'));
    expect(s.revealedRooms.has('R07')).toBe(true);
    expect(s.seenMonsters.has('m1')).toBe(true);
    expect(s.seenMonsters.has('m2')).toBe(true);
    expect(s.seenFurniture.has('f-tomb')).toBe(true);
    expect(s.seenDoors.has('d2')).toBe(true);
  });

  it('d3 opens R13, d4 opens R12 with three skeletons, d5 opens R20 with two', () => {
    expect(run(...via('d3')).revealedRooms.has('R13')).toBe(true);
    const r12 = run(...toR12);
    expect(r12.revealedRooms.has('R12')).toBe(true);
    for (const m of ['m3', 'm4', 'm5']) expect(r12.seenMonsters.has(m)).toBe(true);
    const r20 = run(...toR20);
    expect(r20.revealedRooms.has('R20')).toBe(true);
    expect(r20.seenMonsters.has('m6')).toBe(true);
    expect(r20.seenMonsters.has('m7')).toBe(true);
  });

  it('d6 reaches the bottom corridor, d7 (pit t2 on its square) shows R17 with the chest C and pit t1', () => {
    const s = run(...toR17);
    expect(s.revealedRooms.has('R17')).toBe(true);
    expect(s.seenFurniture.has('f-chest-c')).toBe(true);
    expect(s.seenTraps.has('t1')).toBe(true);
    expect(s.seenTraps.has('t2')).toBe(true);
  });

  it('d8 shows the table room R15, d9 the room R21 and d10 Wardoz in R19', () => {
    const r15 = run(...via('d8'));
    expect(r15.revealedRooms.has('R15')).toBe(true);
    expect(r15.seenFurniture.has('f-table')).toBe(true);
    expect(r15.seenMonsters.has('m8')).toBe(true);
    expect(r15.seenMonsters.has('m16')).toBe(false);
    const r21 = run(...via('d8'), open('d9'));
    expect(r21.revealedRooms.has('R21')).toBe(true);
    expect(r21.seenMonsters.has('m16')).toBe(true);
    const r19 = run(...via('d8'), open('d9'), open('d10'));
    expect(r19.revealedRooms.has('R19')).toBe(true);
    expect(r19.seenMonsters.has('m-wardoz')).toBe(true);
    expect(r19.seenFurniture.has('f-bench')).toBe(true);
    expect(r19.seenFurniture.has('f-chest-d')).toBe(true);
  });

  it('d11 shows the weapons room R22 with the mummy and two skeletons', () => {
    const s = run(...via('d8'), open('d9'), open('d11'));
    expect(s.revealedRooms.has('R22')).toBe(true);
    for (const m of ['m9', 'm10', 'm11']) expect(s.seenMonsters.has(m)).toBe(true);
    expect(s.seenFurniture.has('f-weapons')).toBe(true);
  });

  it('never reveals rock rooms', () => {
    const s = run(...via('d8'), open('d9'), open('d10'), open('d11'));
    for (const k of s.seenCells) expect(level.rock.has(k)).toBe(false);
    for (const r of quest.rock.rooms) expect(s.revealedRooms.has(r)).toBe(false);
  });
});

describe('quest 7: letters B, C, D', () => {
  it("B: the first search of the weapons room gives Borin's Armor and uses the search up", () => {
    const s = run(...via('d8'), open('d9'), open('d11'), kill('m9'), kill('m10'), kill('m11'));
    const r = reduce(level, s, search('R22'));
    expect(r.prompts.find((p) => p.kind === 'note')).toMatchObject({
      noteId: 'n-B',
      letter: 'B',
      consumesTreasure: true,
    });
    expect(r.prompts.map((p) => p.kind)).not.toContain('drawCard');
    const gift = note('B')?.effects.find((e) => e.type === 'giveItem') as { text: string };
    expect(gift.text).toContain("Borin's Armor");
  });

  it('C: needle trap costs 2 BP and the purple flask turns the drinker to stone for 5 turns', () => {
    const chest = quest.traps.find((t) => t.kind === 'chest');
    expect(chest).toMatchObject({ furniture: 'f-chest-c' });
    expect(chest && 'effect' in chest ? chest.effect : '').toContain('2 Body Points');
    const text = (note('C')?.effects.find((e) => e.type === 'showText') as { text: string }).text;
    expect(text).toContain('2 Body Points');
    expect(text).toContain('5 of that hero');
    expect(note('C')?.trigger).toEqual({ type: 'treasureSearch', area: 'R17', first: true });
    const r = reduce(level, run(...toR17), search('R17'));
    expect(r.prompts.find((p) => p.kind === 'note')).toMatchObject({ noteId: 'n-C', letter: 'C' });
    expect(r.prompts.map((p) => p.kind)).not.toContain('drawCard');
  });

  it('D: Wardoz is a zombie; coins and papers only after he is slain, then the goal is done', () => {
    expect(monster('m-wardoz')).toMatchObject({ type: 'zombie', name: 'Wardoz', cell: [16, 14] });
    expect(areaOf(monster('m-wardoz')!.cell!)).toBe('R19');
    const there: GameEvent[] = [...via('d8'), open('d9'), open('d10')];
    expect(() => reduce(level, run(...there), search('R19'))).toThrow();
    const dead = run(...there, kill('m-wardoz'));
    expect(objectivesStatus(level, dead).goalDone).toBe(false);
    const r = reduce(level, dead, search('R19'));
    expect(r.prompts.find((p) => p.kind === 'note')).toMatchObject({
      noteId: 'n-D',
      letter: 'D',
      consumesTreasure: true,
    });
    expect(r.prompts.map((p) => p.kind)).not.toContain('drawCard');
    expect(objectivesStatus(level, r.state).goalDone).toBe(true);
    const text = (note('D')?.effects.find((e) => e.type === 'showText') as { text: string }).text;
    expect(text).toContain('144 gold coins');
  });
});
