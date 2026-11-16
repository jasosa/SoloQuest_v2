/** Walk-through of quest 9, Race Against Time: start in room A, two secret doors, chests B, gas chest C, stairs. */
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
  JSON.parse(readFileSync(resolve(import.meta.dirname, 'q09-race-against-time.json'), 'utf8')),
);
const level = buildLevel(quest);
const open = (door: string): GameEvent => ({ type: 'OPEN_DOOR', door });
const run = (...events: GameEvent[]) => replay(level, 1, events);
const search = (room: string): GameEvent => ({ type: 'SEARCH_TREASURE', room, hero: 'barbarian' });
const note = (letter: string) => quest.notes.find((n) => n.letter === letter);
const count = (type: string) => quest.monsters.filter((m) => m.type === type).length;
const typeOf = (id: string) => quest.monsters.find((m) => m.id === id)?.type;
// Out by the secret door of room A, then look along the corridors until the door is in sight.
const outS2: GameEvent[] = [
  { type: 'SEARCH_SECRET_DOORS', area: 'R21', override: true },
  open('s2'),
];
const seeing = (door: string): GameEvent[] => {
  const out: GameEvent[] = [...outS2];
  for (let i = 0; i < 80; i++) {
    const s = run(...out);
    if (s.seenDoors.has(door)) return out;
    const next = lookHintCells(level, s)[0];
    if (!next) break;
    out.push({ type: 'LOOK_FROM', cell: next });
  }
  throw new Error(`door ${door} never seen`);
};
const via = (door: string): GameEvent[] => [...seeing(door), open(door)];
// The inner chain: corridor, d9 (pocket to R18), d8 (R17), d7 (R20), d6 (R12), d5 (R13).
const toD8: GameEvent[] = via('d9');
const toD7: GameEvent[] = [...toD8, open('d8')];
const toD6: GameEvent[] = [...toD7, open('d7')];
const toD5: GameEvent[] = [...toD6, open('d6')];

describe('quest 9: data', () => {
  it('is valid against the board', () => {
    expect(validateQuest(quest, board)).toEqual([]);
  });

  it('has 12 doors, 2 secret doors, 4 blocks, no floor traps, 24 monsters, wandering abomination', () => {
    expect(quest.doors).toHaveLength(12);
    expect(quest.secretDoors).toEqual([
      { id: 's1', a: [6, 11], b: [7, 11] },
      { id: 's2', a: [19, 17], b: [19, 18] },
    ]);
    expect(quest.falseDoors).toEqual([]);
    expect(quest.blocks.map((b) => b.cells)).toEqual([
      [[5, 0]],
      [[5, 9]],
      [
        [12, 13],
        [13, 13],
      ],
      [[21, 18]],
    ]);
    expect(quest.traps.map((t) => t.kind)).toEqual(['chest']);
    expect(quest.monsters).toHaveLength(24);
    expect(count('orc')).toBe(10);
    expect(count('goblin')).toBe(10);
    expect(count('abomination')).toBe(2);
    expect(count('dreadWarrior')).toBe(2);
    expect(quest.wandering).toEqual({ monster: 'abomination' });
    expect(quest.start).toEqual({ area: 'R21' });
  });
});

describe('quest 9: the start room and its three doors', () => {
  it('starts in R21 with the three doors known and no monster seen', () => {
    const s = initialState(level, 1);
    expect(s.revealedRooms).toEqual(new Set(['R21']));
    expect(s.seenMonsters.size).toBe(0);
    expect(s.seenDoors).toEqual(new Set(['d10', 'd11', 'd12']));
  });

  it('note A fires at the start and shows its letter', () => {
    const s = run();
    expect(note('A')?.trigger).toEqual({ type: 'questStart' });
    expect(journal(level, s).map((j) => j.letter)).toContain('A');
  });

  it('d12 shows R15 with three orcs', () => {
    const s = run(open('d12'));
    expect(s.revealedRooms.has('R15')).toBe(true);
    for (const m of ['m16', 'm17', 'm18']) {
      expect(s.seenMonsters.has(m)).toBe(true);
      expect(typeOf(m)).toBe('orc');
    }
  });

  it('d10 shows R19 (goblin, orc, goblin) and d11 shows R22 (goblin, orc, goblin)', () => {
    const w = run(open('d10'));
    expect(w.revealedRooms.has('R19')).toBe(true);
    expect(['m19', 'm20', 'm21'].map(typeOf)).toEqual(['goblin', 'orc', 'goblin']);
    for (const m of ['m19', 'm20', 'm21']) expect(w.seenMonsters.has(m)).toBe(true);
    const e = run(open('d11'));
    expect(e.revealedRooms.has('R22')).toBe(true);
    expect(['m22', 'm23', 'm24'].map(typeOf)).toEqual(['goblin', 'orc', 'goblin']);
    for (const m of ['m22', 'm23', 'm24']) expect(e.seenMonsters.has(m)).toBe(true);
  });

  it('the south secret door stays hidden until searched, then opens onto the corridor', () => {
    expect(run().seenDoors.has('s2')).toBe(false);
    expect(run(...outS2).openDoors.has('s2')).toBe(true);
  });
});

describe('quest 9: the way to the stairs', () => {
  it('d4 shows R07 with four goblins; an orc waits at the door', () => {
    const s = run(...via('d4'));
    expect(s.revealedRooms.has('R07')).toBe(true);
    for (const m of ['m2', 'm3', 'm4', 'm5']) {
      expect(s.seenMonsters.has(m)).toBe(true);
      expect(typeOf(m)).toBe('goblin');
    }
    expect(typeOf('m6')).toBe('orc');
    expect(s.seenDoors.has('d3')).toBe(true);
  });

  it('d3 shows the stairs room R08, with no monster in it', () => {
    const s = run(...via('d4'), open('d3'));
    expect(s.revealedRooms.has('R08')).toBe(true);
    expect(s.seenFurniture.has('f-stairs')).toBe(true);
    expect(quest.furniture.find((f) => f.id === 'f-stairs')?.cells).toEqual([
      [7, 4],
      [8, 4],
      [7, 5],
      [8, 5],
    ]);
  });

  it('the stairs end the quest', () => {
    const s = run(...via('d4'), open('d3'));
    expect(objectivesStatus(level, s).goalDone).toBe(false);
    const r = reduce(level, s, { type: 'CONFIRM_OBJECTIVE', objective: 'o1' });
    expect(objectivesStatus(level, r.state).goalDone).toBe(true);
  });

  it('d8 shows the table room R17 with two abominations', () => {
    const s = run(...toD7);
    expect(s.revealedRooms.has('R17')).toBe(true);
    for (const m of ['m10', 'm11']) {
      expect(s.seenMonsters.has(m)).toBe(true);
      expect(typeOf(m)).toBe('abomination');
    }
    expect(s.seenFurniture.has('f-table')).toBe(true);
    expect(s.seenDoors.has('d8')).toBe(true);
  });

  it('d7 shows R20 with the fireplace', () => {
    const s = run(...toD6);
    expect(s.revealedRooms.has('R20')).toBe(true);
    expect(s.seenFurniture.has('f-fireplace')).toBe(true);
  });

  it('d9 shows the pocket with an orc; R18 holds goblins and a Dread warrior', () => {
    const s = run(...toD8);
    expect(s.revealedRooms.has('R18')).toBe(true);
    for (const m of ['m12', 'm13', 'm14']) expect(s.seenMonsters.has(m)).toBe(true);
    expect(['m12', 'm13', 'm14'].map(typeOf)).toEqual(['goblin', 'goblin', 'dreadWarrior']);
    expect(s.seenDoors.has('d9')).toBe(true);
    const t = run(...seeing('d9'), open('d9'));
    expect(t.seenMonsters.has('m15')).toBe(true);
    expect(typeOf('m15')).toBe('orc');
  });

  it('never reveals rock rooms', () => {
    const s = run(...via('d4'), open('d3'));
    for (const k of s.seenCells) expect(level.rock.has(k)).toBe(false);
    for (const r of quest.rock.rooms) expect(s.revealedRooms.has(r)).toBe(false);
  });
});

describe('quest 9: chests B and C', () => {
  it('d5 shows R13 with two orcs and the two plain chests, not the secret room', () => {
    const s = run(...toD5, open('d5'));
    expect(s.revealedRooms.has('R13')).toBe(true);
    for (const m of ['m7', 'm8']) {
      expect(s.seenMonsters.has(m)).toBe(true);
      expect(typeOf(m)).toBe('orc');
    }
    expect(s.seenFurniture.has('f-chest-b1')).toBe(true);
    expect(s.seenFurniture.has('f-chest-b2')).toBe(true);
    expect(s.seenFurniture.has('f-chest-c')).toBe(false);
    expect(s.revealedRooms.has('R14')).toBe(false);
  });

  it('B: the first search of R13 gives the gold of both chests and uses the search up', () => {
    const s = run(
      ...toD5,
      open('d5'),
      { type: 'MONSTER_KILL', monster: 'm7' },
      { type: 'MONSTER_KILL', monster: 'm8' },
    );
    const r = reduce(level, s, search('R13'));
    expect(r.prompts.find((p) => p.kind === 'note')).toMatchObject({
      noteId: 'n-B',
      letter: 'B',
      at: [6, 11],
      consumesTreasure: true,
    });
    expect(r.prompts.map((p) => p.kind)).not.toContain('drawCard');
  });

  it('the secret door s1 opens the small room R14 with a Dread warrior and chest C', () => {
    const s = run(
      ...toD5,
      open('d5'),
      { type: 'SEARCH_SECRET_DOORS', area: 'R13', override: true },
      open('s1'),
    );
    expect(s.revealedRooms.has('R14')).toBe(true);
    expect(s.seenMonsters.has('m9')).toBe(true);
    expect(typeOf('m9')).toBe('dreadWarrior');
    expect(s.seenFurniture.has('f-chest-c')).toBe(true);
  });

  it('C: gas trap worth 3 Body Points springs first, then the note gives the Elixir of Life', () => {
    const trap = quest.traps.find((t) => t.kind === 'chest');
    expect(trap).toMatchObject({ furniture: 'f-chest-c' });
    expect(trap?.effect).toContain('3 Body Points');
    expect(quest.furniture.find((f) => f.id === 'f-chest-c')?.cells).toEqual([[8, 11]]);
    const s = run(
      ...toD5,
      open('d5'),
      { type: 'SEARCH_SECRET_DOORS', area: 'R13', override: true },
      open('s1'),
      { type: 'MONSTER_KILL', monster: 'm9' },
    );
    const r = reduce(level, s, search('R14'));
    const kinds = r.prompts.map((p) => p.kind);
    expect(kinds[0]).toBe('trapSprung');
    expect(r.prompts.find((p) => p.kind === 'note')).toMatchObject({
      noteId: 'n-C',
      letter: 'C',
      at: [8, 10],
      consumesTreasure: true,
    });
    expect(kinds).not.toContain('drawCard');
    const gift = note('C')?.effects.find((e) => e.type === 'giveItem') as { text: string };
    expect(gift.text).toContain('Elixir of Life');
  });
});
