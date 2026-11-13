/** Walk-through of quest 1, The Trial: doors in a sensible order, what each reveal shows. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { board } from '../../engine/board/board';
import { buildLevel } from '../../engine/board/level';
import type { GameEvent } from '../../engine/game/events';
import { statsOf } from '../../engine/data/monsters';
import { initialState, replay } from '../../engine/game/reducer';
import { monstersInPlay } from '../../engine/game/view';
import { parseQuest } from '../../engine/quest/loader';
import { validateQuest } from '../../engine/quest/validate';

const quest = parseQuest(
  JSON.parse(readFileSync(resolve(import.meta.dirname, 'q01-the-trial.json'), 'utf8')),
);
const level = buildLevel(quest);
const open = (door: string): GameEvent => ({ type: 'OPEN_DOOR', door });
const run = (...events: GameEvent[]) => replay(level, 1, events);
const looks = (...cells: [number, number][]): GameEvent[] =>
  cells.map(([x, y]) => ({ type: 'LOOK_FROM', cell: [x, y] }));
// Corridor squares to look from, in order, to see a door from outside (checked by the engine:
// a look from a square that was not seen yet throws).
const toD5 = looks([13, 18]);
const toD6 = looks([13, 18], [13, 12], [16, 12]);
const toD7 = looks([0, 18]);
const toRow9 = looks([2, 18], [4, 18], [1, 18], [5, 18], [0, 17], [0, 9]); // shows d8 and d9
const monsterAt = (id: string) => quest.monsters.find((m) => m.id === id);
const note = (letter: string) => quest.notes.find((n) => n.letter === letter);

describe('quest 1: data', () => {
  it('is valid against the board', () => {
    expect(validateQuest(quest, board)).toEqual([]);
  });

  it('has no traps and no secret or false doors (Zargon info)', () => {
    expect(quest.traps).toEqual([]);
    expect(quest.secretDoors).toEqual([]);
    expect(quest.falseDoors).toEqual([]);
    expect(quest.zargonInfo).toBeTruthy();
  });

  it('has 12 doors, 4 blocks, 24 monsters and an orc as the wandering monster', () => {
    expect(quest.doors).toHaveLength(12);
    expect(quest.blocks).toHaveLength(4);
    expect(quest.monsters).toHaveLength(24);
    expect(quest.wandering).toEqual({ monster: 'orc' });
  });

  it('has one objective: kill Verag, a gargoyle in the center room', () => {
    const verag = monsterAt('m-verag');
    expect(verag?.type).toBe('gargoyle');
    expect(verag?.name).toBe('Verag');
    expect(board.cells[verag!.cell![1]]?.[verag!.cell![0]]).toBe('R11');
    expect(quest.objectives).toEqual([
      expect.objectContaining({ done: { monsterKilled: 'm-verag' } }),
    ]);
  });

  it('mummy C rolls 4 attack dice, the other mummy keeps the standard dice', () => {
    expect(monsterAt('m4')?.overrides).toEqual({ att: 4 });
    expect(monsterAt('m8')?.overrides).toBeUndefined();
    expect(monsterAt('m4')?.type).toBe('mummy');
  });
});

describe('quest 1: walk-through', () => {
  it('starts in the stairway room with only door d1', () => {
    const s = initialState(level, 1);
    expect(s.revealedRooms).toEqual(new Set(['R20']));
    expect(s.seenFurniture).toEqual(new Set(['f-stairs']));
    expect(s.seenMonsters.size).toBe(0);
    expect(s.seenDoors).toEqual(new Set(['d1']));
  });

  it('d2 shows R17: two orcs, bookcase, alchemist bench; d3 then shows R18', () => {
    const s = run(open('d1'), open('d2'));
    expect(s.revealedRooms.has('R17')).toBe(true);
    expect(s.seenMonsters).toEqual(new Set(['m15', 'm16']));
    expect(s.seenFurniture).toEqual(new Set(['f-stairs', 'f-bookcase-w', 'f-alch']));
    expect(s.seenDoors.has('d3')).toBe(true);

    const t = run(open('d1'), open('d2'), open('d3'));
    expect(t.revealedRooms.has('R18')).toBe(true);
    expect(t.seenMonsters.has('m17')).toBe(true); // goblin by the rack
    expect(t.seenMonsters.has('m18')).toBe(true); // abomination
    expect(t.seenFurniture.has('f-weapons')).toBe(true);
    expect(t.seenDoors.has('d4')).toBe(true);
    expect(t.seenMonsters.has('m-verag')).toBe(false);
  });

  it('the block at the end of the bottom corridor is seen from d1', () => {
    const s = run(open('d1'));
    expect(s.seenBlocks.size).toBeGreaterThan(0);
    expect(s.seenCells.has('13,18')).toBe(true);
  });

  it('d5 shows R19: two dread warriors, chest B, cupboard, bookcase', () => {
    const s = run(open('d1'), ...toD5, open('d5'));
    expect(s.revealedRooms.has('R19')).toBe(true);
    expect(s.seenMonsters).toEqual(new Set(['m22', 'm23']));
    expect(s.seenFurniture.has('f-chest-b')).toBe(true);
    expect(s.seenFurniture.has('f-cupboard')).toBe(true);
    expect(s.seenFurniture.has('f-bookcase-e')).toBe(true);
  });

  it('d6 shows the center room with Verag, two orcs and a dread warrior', () => {
    const s = run(open('d1'), ...toD6, open('d6'));
    expect(s.revealedRooms.has('R11')).toBe(true);
    expect(s.seenMonsters).toEqual(new Set(['m-verag', 'm19', 'm20', 'm21']));
    for (const f of ['f-chest-e', 'f-fire', 'f-throne', 'f-table-c'])
      expect(s.seenFurniture.has(f)).toBe(true);
  });

  it('d7 shows R12: goblin, orc, torture rack', () => {
    const s = run(open('d1'), ...toD7, open('d7'));
    expect(s.revealedRooms.has('R12')).toBe(true);
    expect(s.seenMonsters).toEqual(new Set(['m13', 'm14']));
    expect(s.seenFurniture.has('f-rack')).toBe(true);
  });

  it('d8 shows R07 (orc, goblin, sorcerer table), d10 then shows R01 (two skeletons)', () => {
    const s = run(open('d1'), ...toRow9, open('d8'));
    expect(s.revealedRooms.has('R07')).toBe(true);
    expect(s.seenMonsters).toEqual(new Set(['m9', 'm10']));
    expect(s.seenFurniture.has('f-sorc')).toBe(true);
    expect(s.seenDoors.has('d10')).toBe(true);

    const t = run(open('d1'), ...toRow9, open('d8'), open('d10'));
    expect(t.revealedRooms.has('R01')).toBe(true);
    expect(t.seenMonsters.has('m1')).toBe(true);
    expect(t.seenMonsters.has('m2')).toBe(true);
    expect(t.seenDoors.has('d11')).toBe(true);
  });

  it('d9 shows R08: two goblins and a table', () => {
    const s = run(open('d1'), ...toRow9, open('d9'));
    expect(s.revealedRooms.has('R08')).toBe(true);
    expect(s.seenMonsters).toEqual(new Set(['m11', 'm12']));
    expect(s.seenFurniture.has('f-table-nw')).toBe(true);
  });

  it('d11 shows R02 (zombie, mummy C, zombie) and d12 shows the tomb room R03', () => {
    const s = run(open('d1'), ...toRow9, open('d8'), open('d10'), open('d11'));
    expect(s.revealedRooms.has('R02')).toBe(true);
    for (const m of ['m3', 'm4', 'm5']) expect(s.seenMonsters.has(m)).toBe(true);
    expect(s.seenDoors.has('d12')).toBe(true);

    const t = run(open('d1'), ...toRow9, open('d8'), open('d10'), open('d11'), open('d12'));
    expect(t.revealedRooms.has('R03')).toBe(true);
    for (const m of ['m6', 'm7', 'm8']) expect(t.seenMonsters.has(m)).toBe(true);
    expect(t.seenFurniture.has('f-tomb')).toBe(true);
    expect(t.seenFurniture.has('f-chest-d')).toBe(true);
    // the double block outside the tomb room is not in sight of the room
    expect(t.seenBlocks.size).toBeGreaterThan(0);
  });

  it('never reveals rock rooms', () => {
    const all = run(
      open('d1'),
      open('d2'),
      open('d3'),
      open('d4'),
      ...toD6,
      open('d6'),
      ...toD5,
      open('d5'),
      ...toD7,
      open('d7'),
      ...toRow9,
      open('d8'),
      open('d9'),
      open('d10'),
      open('d11'),
      open('d12'),
    );
    for (const k of all.seenCells) expect(level.rock.has(k)).toBe(false);
    for (const r of ['R04', 'R05', 'R06', 'R09', 'R10', 'R13', 'R14', 'R15', 'R16', 'R21', 'R22'])
      expect(all.revealedRooms.has(r)).toBe(false);
    // every monster of the quest is found in the end
    expect(all.seenMonsters.size).toBe(24);
  });
});

describe('quest 1: notes', () => {
  it('has the five notes A to E at the letters on the map', () => {
    expect(quest.notes.map((n) => n.letter)).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(note('A')?.at).toEqual([11, 14]);
    expect(note('B')?.at).toEqual([17, 15]);
    expect(note('C')?.at).toEqual([7, 2]);
    expect(note('D')?.at).toEqual([11, 5]);
    expect(note('E')?.at).toEqual([10, 7]);
  });

  it('A and B (junk rack, empty chest) and D and E (gold) fire on the first treasure search', () => {
    const by = (letter: string, area: string) => {
      expect(note(letter)?.trigger).toEqual({ type: 'treasureSearch', area, first: true });
      expect(note(letter)?.consumesTreasure).toBe(true);
    };
    by('A', 'R18');
    by('B', 'R19');
    by('D', 'R03');
    by('E', 'R11');
  });

  it('the gold notes carry the amounts 84 and 120', () => {
    const gold = (letter: string) =>
      note(letter)?.effects.find((e) => e.type === 'giveItem') as { text: string } | undefined;
    expect(gold('D')?.text).toBe('84 gold coins');
    expect(gold('E')?.text).toBe('120 gold coins');
    expect(note('A')?.effects.some((e) => e.type === 'giveItem')).toBe(false);
    expect(note('B')?.effects.some((e) => e.type === 'giveItem')).toBe(false);
  });

  it('C fires when the mummy room R02 is revealed and mentions 4 dice', () => {
    expect(note('C')?.trigger).toEqual({ type: 'areaRevealed', area: 'R02' });
    const e = note('C')?.effects[0];
    expect(e?.type === 'showText' && e.text.includes('4')).toBe(true);
  });

  it('every treasure note sits in the room of its furniture', () => {
    const roomOf = (id: string) => {
      const c = quest.furniture.find((f) => f.id === id)!.cells[0]!;
      return board.cells[c[1]]?.[c[0]];
    };
    expect(roomOf('f-weapons')).toBe('R18');
    expect(roomOf('f-chest-b')).toBe('R19');
    expect(roomOf('f-chest-d')).toBe('R03');
    expect(roomOf('f-chest-e')).toBe('R11');
  });
});

describe('quest 1: monsters in play', () => {
  it('shows none at the start, and the orcs of the first room after the doors', () => {
    expect(monstersInPlay(level, initialState(level, 1))).toEqual([]);
    const s = run(open('d1'), open('d2'));
    const list = monstersInPlay(level, s);
    expect(list.map((m) => m.id)).toEqual(['m15', 'm16']);
    expect(list.map((m) => [m.name, m.body, m.dead])).toEqual([
      ['Orc', 1, false],
      ['Orc', 1, false],
    ]);
    expect(list.map((m) => m.id)).not.toContain('m-verag');
  });

  it('Verag is a gargoyle with the base gargoyle stats (no overrides)', () => {
    const verag = quest.monsters.find((m) => m.id === 'm-verag')!;
    expect(statsOf(verag)).toEqual({ move: 6, att: 4, def: 5, body: 3, mind: 4 });
  });

  it('mummy C has 4 attack dice and keeps its other stats', () => {
    expect(statsOf(monsterAt('m4')!)).toEqual({ move: 4, att: 4, def: 4, body: 2, mind: 0 });
  });
});
