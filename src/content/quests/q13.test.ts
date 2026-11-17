/** Walk-through of quest 13, Quest for the Spirit Blade: falling-block squares (roll rule, repeating, not blocking), Spirit Blade (A), chest B, stairs. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { board } from '../../engine/board/board';
import { buildLevel, cellKey } from '../../engine/board/level';
import type { GameEvent } from '../../engine/game/events';
import { lookHintCells } from '../../engine/game/hints';
import { squareMarkers } from '../../engine/game/noteView';
import { initialState, reduce, replay } from '../../engine/game/reducer';
import { objectiveConfirms, objectivesStatus } from '../../engine/game/view';
import { parseQuest } from '../../engine/quest/loader';
import { validateQuest } from '../../engine/quest/validate';

const quest = parseQuest(
  JSON.parse(
    readFileSync(resolve(import.meta.dirname, 'q13-quest-for-the-spirit-blade.json'), 'utf8'),
  ),
);
const level = buildLevel(quest);
const open = (door: string): GameEvent => ({ type: 'OPEN_DOOR', door });
const run = (...events: GameEvent[]) => replay(level, 1, events);
const search = (room: string): GameEvent => ({ type: 'SEARCH_TREASURE', room, hero: 'barbarian' });
const count = (type: string) => quest.monsters.filter((m) => m.type === type).length;
const noteIds = (prompts: readonly { kind: string }[]) =>
  prompts.filter((p) => p.kind === 'note').map((p) => (p as unknown as { noteId: string }).noteId);
const areaOf = (c: readonly number[]) => board.cells[c[1]!]?.[c[0]!];
const kindsIn = (room: string) =>
  quest.monsters
    .filter((m) => areaOf(m.cell!) === room)
    .map((m) => m.type)
    .sort();

// Opens seen doors and looks along corridors (never opening `avoid`) until `done` holds.
const reach = (done: (s: ReturnType<typeof run>) => boolean, avoid: string[] = []): GameEvent[] => {
  const out: GameEvent[] = [];
  const opened = new Set<string>();
  for (let i = 0; i < 300; i++) {
    const s = run(...out);
    if (done(s)) return out;
    const next = lookHintCells(level, s)[0];
    if (next) {
      out.push({ type: 'LOOK_FROM', cell: next });
      continue;
    }
    const d = quest.doors.find(
      (x) => s.seenDoors.has(x.id) && !opened.has(x.id) && !avoid.includes(x.id),
    );
    if (!d) break;
    opened.add(d.id);
    out.push(open(d.id));
  }
  throw new Error('goal never reached');
};
const seeing = (door: string) => reach((s) => s.seenDoors.has(door), [door]);
const via = (door: string): GameEvent[] => [...seeing(door), open(door)];
const seeingCell = (c: readonly number[]) => reach((s) => s.seenCells.has(cellKey(c[0]!, c[1]!)));
const clear = (room: string): GameEvent[] =>
  quest.monsters
    .filter((m) => areaOf(m.cell!) === room)
    .map((m) => ({ type: 'MONSTER_KILL', monster: m.id }));
const FALL: [number, number][] = [
  [0, 9],
  [9, 11],
  [12, 14],
  [13, 16],
  [19, 17],
  [19, 9],
];
const hasMarker = (s: ReturnType<typeof run>, c: readonly number[]) =>
  squareMarkers(level, s).some((m) => m.cell[0] === c[0] && m.cell[1] === c[1]);

describe('quest 13: data', () => {
  it('is valid against the board', () => {
    expect(validateQuest(quest, board)).toEqual([]);
  });

  it('has 13 doors, no secret doors, 7 blocks, 2 spear traps, wandering Dread warrior', () => {
    expect(quest.doors).toHaveLength(13);
    expect(quest.secretDoors).toEqual([]);
    expect(quest.falseDoors).toEqual([]);
    expect(quest.blocks).toHaveLength(7);
    expect(quest.traps.map((t) => [t.kind, t.cell])).toEqual([
      ['spear', [11, 6]],
      ['spear', [14, 6]],
    ]);
    expect(quest.wandering).toEqual({ monster: 'dreadWarrior' });
    expect(quest.start).toEqual({ area: 'R11' });
  });

  it('has 7 orcs, 3 goblins, 3 abominations, 2 Dread warriors, 1 mummy, 4 skeletons (20)', () => {
    expect(count('orc')).toBe(7);
    expect(count('goblin')).toBe(3);
    expect(count('abomination')).toBe(3);
    expect(count('dreadWarrior')).toBe(2);
    expect(count('mummy')).toBe(1);
    expect(count('skeleton')).toBe(4);
    expect(quest.monsters).toHaveLength(20);
  });

  it('models falling-block squares as repeating square notes, not trap objects', () => {
    expect(quest.traps.some((t) => t.kind === 'fallingBlock')).toBe(false);
    const sq = quest.notes.flatMap((n) => (n.trigger.type === 'squareEntered' ? [n.trigger] : []));
    expect(sq.map((t) => t.cell)).toEqual(FALL);
    for (const t of sq) expect(t.repeat).toBe(true);
    for (const c of FALL) expect(level.rock.has(cellKey(c[0], c[1]))).toBe(false);
  });
});

describe('quest 13: walk-through', () => {
  it('starts on the stairs in R11 and sees only that room', () => {
    const s = initialState(level, 1);
    expect(s.revealedRooms).toEqual(new Set(['R11']));
    expect(s.seenMonsters.size).toBe(0);
    expect(s.seenFurniture.has('f-stairs')).toBe(true);
  });

  it('d9 and d10 open the corridors north and south of the center room', () => {
    const north = run(...via('d9'));
    expect(north.seenCells.has(cellKey(11, 6))).toBe(true);
    const south = run(...via('d10'));
    expect(south.seenMonsters.has('m5')).toBe(true);
  });

  it('d1 shows R12 (orc, Dread warrior, abomination) and d3 shows the chest room R13', () => {
    const r12 = run(...via('d1'));
    expect(r12.revealedRooms.has('R12')).toBe(true);
    expect(kindsIn('R12')).toEqual(['abomination', 'dreadWarrior', 'orc']);
    for (const m of quest.monsters.filter((x) => areaOf(x.cell!) === 'R12'))
      expect(r12.seenMonsters.has(m.id)).toBe(true);
    const r13 = run(...via('d3'));
    expect(r13.revealedRooms.has('R13')).toBe(true);
    expect(r13.seenFurniture.has('f-chest-b')).toBe(true);
  });

  it('d5 shows R20 (2 orcs, abomination, table) and d6 shows R17 (3 goblins, orc, table)', () => {
    const r20 = run(...via('d5'));
    expect(r20.revealedRooms.has('R20')).toBe(true);
    expect(r20.seenFurniture.has('f-table-2')).toBe(true);
    expect(kindsIn('R20')).toEqual(['abomination', 'orc', 'orc']);
    const r17 = run(...via('d6'));
    expect(r17.revealedRooms.has('R17')).toBe(true);
    expect(r17.seenFurniture.has('f-table-1')).toBe(true);
    expect(kindsIn('R17')).toEqual(['goblin', 'goblin', 'goblin', 'orc']);
  });

  it('d12 shows the mummy room R21 and d13 shows the Spirit Blade room R22', () => {
    const r21 = run(...via('d12'));
    expect(r21.revealedRooms.has('R21')).toBe(true);
    expect(kindsIn('R21')).toEqual(['mummy']);
    const r22 = run(...via('d13'));
    expect(r22.revealedRooms.has('R22')).toBe(true);
    expect(kindsIn('R22')).toEqual([
      'dreadWarrior',
      'skeleton',
      'skeleton',
      'skeleton',
      'skeleton',
    ]);
    for (const m of quest.monsters.filter((x) => areaOf(x.cell!) === 'R22'))
      expect(r22.seenMonsters.has(m.id)).toBe(true);
  });

  it('d11 shows the empty room R09', () => {
    const s = run(...via('d11'));
    expect(s.revealedRooms.has('R09')).toBe(true);
    expect(kindsIn('R09')).toEqual([]);
  });

  it('never reveals rock rooms', () => {
    const s = run(...via('d13'));
    for (const k of s.seenCells) expect(level.rock.has(k)).toBe(false);
    for (const r of quest.rock.rooms) expect(s.revealedRooms.has(r)).toBe(false);
  });
});

describe('quest 13: falling-block squares', () => {
  it('each square gets a marker once seen, and its note repeats on every step', () => {
    for (const c of FALL) {
      const seen = run(...seeingCell(c));
      expect(hasMarker(seen, c)).toBe(true);
      const a = reduce(level, seen, { type: 'SQUARE_TRIGGER', cell: [c[0], c[1]] });
      expect(noteIds(a.prompts)).toHaveLength(1);
      const text = JSON.stringify(quest.notes.find((n) => n.id === noteIds(a.prompts)[0])!.effects);
      expect(text).toContain('4, 5 or 6');
      expect(text).toContain('helmet');
      const b = reduce(level, a.state, { type: 'SQUARE_TRIGGER', cell: [c[0], c[1]] });
      expect(noteIds(b.prompts)).toEqual(noteIds(a.prompts));
      expect(hasMarker(b.state, c)).toBe(true);
    }
  });

  it('they place no block: heroes are not blocked', () => {
    const seen = run(...seeingCell([9, 11]));
    const r = reduce(level, seen, { type: 'SQUARE_TRIGGER', cell: [9, 11] });
    expect(r.state.placedBlocks.size).toBe(0);
  });
});

describe('quest 13: letters and the end', () => {
  it('A: the first search of R22 finds the Spirit Blade and sets the flag, no card drawn', () => {
    const n = quest.notes.find((x) => x.letter === 'A')!;
    expect(n.trigger).toEqual({ type: 'treasureSearch', area: 'R22', first: true });
    expect(n.at).toEqual([23, 15]);
    expect(areaOf(n.at!)).toBe('R22');
    const r = reduce(level, run(...via('d13'), ...clear('R22')), search('R22'));
    expect(r.prompts.find((p) => p.kind === 'note')).toMatchObject({
      noteId: 'n-A',
      letter: 'A',
      consumesTreasure: true,
    });
    expect(r.prompts.map((p) => p.kind)).not.toContain('drawCard');
    expect(r.state.flags['blade']).toBe(true);
    expect(JSON.stringify(n.effects)).toContain('Spirit Blade');
  });

  it('B: the chest in R13 holds 200 gold coins, no card drawn', () => {
    const n = quest.notes.find((x) => x.letter === 'B')!;
    expect(n.trigger).toEqual({ type: 'treasureSearch', area: 'R13', first: true });
    expect(n.at).toEqual([6, 12]);
    expect(quest.furniture.find((x) => x.letter === 'B')!.type).toBe('chest');
    const r = reduce(level, run(...via('d3')), search('R13'));
    expect(r.prompts.find((p) => p.kind === 'note')).toMatchObject({
      noteId: 'n-B',
      consumesTreasure: true,
    });
    expect(r.prompts.map((p) => p.kind)).not.toContain('drawCard');
    expect(JSON.stringify(n.effects)).toContain('200 gold coins');
  });

  it('the stairs button appears only after the blade is found, and completes the goal', () => {
    const before = run(...via('d13'), ...clear('R22'));
    expect(objectiveConfirms(level, before)).toEqual([]);
    const found = reduce(level, before, search('R22')).state;
    expect(objectiveConfirms(level, found).map((t) => t.objective)).toEqual(['o1']);
    expect(objectivesStatus(level, found).goalDone).toBe(false);
    const done = reduce(level, found, { type: 'CONFIRM_OBJECTIVE', objective: 'o1' }).state;
    expect(objectivesStatus(level, done).goalDone).toBe(true);
  });
});
