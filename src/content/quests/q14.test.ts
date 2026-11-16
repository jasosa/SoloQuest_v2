/** Walk-through of quest 14, Return to Barak Tor: Witch Lord (spells, fear twice), tomb note A, Spell Ring on death. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { board } from '../../engine/board/board';
import { buildLevel, cellKey } from '../../engine/board/level';
import type { GameEvent } from '../../engine/game/events';
import { lookHintCells } from '../../engine/game/hints';
import { initialState, reduce, replay } from '../../engine/game/reducer';
import { objectivesStatus } from '../../engine/game/view';
import { parseQuest } from '../../engine/quest/loader';
import { validateQuest } from '../../engine/quest/validate';

const quest = parseQuest(
  JSON.parse(readFileSync(resolve(import.meta.dirname, 'q14-return-to-barak-tor.json'), 'utf8')),
);
const level = buildLevel(quest);
const open = (door: string): GameEvent => ({ type: 'OPEN_DOOR', door });
const run = (...events: GameEvent[]) => replay(level, 1, events);
const cast = (spell: string): GameEvent => ({ type: 'SPELL_CAST', monster: 'm-witch', spell });
const count = (type: string) => quest.monsters.filter((m) => m.type === type).length;
const noteIds = (prompts: readonly { kind: string }[]) =>
  prompts.filter((p) => p.kind === 'note').map((p) => (p as unknown as { noteId: string }).noteId);
// From the stairs room: open d14, then look along the corridors and open the doors seen, in order,
// until the wanted door is seen. The blocks at (0,0), (7,0) and (25,10) shape the walk.
const walk = (done: (s: ReturnType<typeof run>) => boolean, label: string): GameEvent[] => {
  const out: GameEvent[] = [open('d14')];
  const opened = new Set(['d14']);
  for (let i = 0; i < 300; i++) {
    const s = run(...out);
    if (done(s)) return out;
    const next = lookHintCells(level, s)[0];
    if (next) {
      out.push({ type: 'LOOK_FROM', cell: next });
      continue;
    }
    const d = quest.doors.find((x) => s.seenDoors.has(x.id) && !opened.has(x.id) && x.id !== 'd4');
    if (!d) break;
    opened.add(d.id);
    out.push(open(d.id));
  }
  throw new Error(`${label} never reached`);
};
const seeing = (door: string): GameEvent[] => walk((s) => s.seenDoors.has(door), `door ${door}`);
const seeingCell = (x: number, y: number): GameEvent[] =>
  walk((s) => s.seenCells.has(cellKey(x, y)), `cell ${x},${y}`);
const via = (door: string): GameEvent[] => [...seeing(door), open(door)];

describe('quest 14: data', () => {
  it('is valid against the board', () => {
    expect(validateQuest(quest, board)).toEqual([]);
  });

  it('has 14 doors, 1 secret door, 8 blocks, 2 pits, a wandering mummy, start in R20', () => {
    expect(quest.doors).toHaveLength(14);
    expect(quest.secretDoors.map((s) => [s.a, s.b])).toEqual([
      [
        [11, 4],
        [12, 4],
      ],
    ]);
    expect(quest.falseDoors).toEqual([]);
    expect(quest.blocks).toHaveLength(8);
    expect(quest.traps.map((t) => t.kind)).toEqual(['pit', 'pit']);
    expect(quest.wandering).toEqual({ monster: 'mummy' });
    expect(quest.start).toEqual({ area: 'R20' });
  });

  it('has 13 skeletons, 5 zombies, 4 mummies and the Witch Lord', () => {
    expect(count('skeleton')).toBe(13);
    expect(count('zombie')).toBe(5);
    expect(count('mummy')).toBe(4);
    expect(count('dreadSorcerer')).toBe(1);
    expect(quest.monsters).toHaveLength(23);
  });

  it('the Witch Lord is 10 / 5 / 6 / 4 / 6, on X, with fear twice and one spell per turn', () => {
    const w = quest.monsters.find((m) => m.id === 'm-witch')!;
    expect(w).toMatchObject({
      type: 'dreadSorcerer',
      name: 'Witch Lord',
      cell: [23, 3],
      hidden: true,
      overrides: { move: 10, att: 5, def: 6, body: 4, mind: 6 },
      spellLimit: 'onePerTurn',
    });
    expect([...w.spells!].sort()).toEqual(
      ['ballOfFlame', 'command', 'fear', 'fear', 'summon', 'tempest'].sort(),
    );
    expect(w.abilities).toEqual(['spiritBladeOnly']);
    expect(w.special).toBe(true);
    const x = quest.markers.find((m) => m.label === 'X')!;
    expect(x.cell).toEqual([23, 3]);
  });

  it('keeps the Spell Ring out of the intro', () => {
    expect(quest.intro.summary).not.toMatch(/(^|[^a-z])ring([^a-z]|$)/i);
  });
});

describe('quest 14: walk-through', () => {
  it('starts in the stairs room R20', () => {
    const s = initialState(level, 1);
    expect(s.revealedRooms).toEqual(new Set(['R20']));
    expect(s.seenFurniture.has('f-stairs')).toBe(true);
    expect(s.seenDoors.has('d14')).toBe(true);
    expect(s.seenMonsters.size).toBe(0);
  });

  it('the first corridor shows the skeleton at the stairs door', () => {
    const s = run(open('d14'));
    expect(s.seenMonsters.has('m-ske13')).toBe(true);
  });

  it('d6 shows R14 with two skeletons; d13 shows R13 and its skeleton', () => {
    const a = run(...via('d6'));
    expect(a.revealedRooms.has('R14')).toBe(true);
    expect(a.seenMonsters.has('m-ske11')).toBe(true);
    expect(a.seenMonsters.has('m-ske12')).toBe(true);
    const b = run(...via('d6'), open('d13'));
    expect(b.revealedRooms.has('R13')).toBe(true);
    expect(b.seenMonsters.has('m-ske10')).toBe(true);
  });

  it('d5 shows the center room R11: mummy and zombie', () => {
    const s = run(...via('d5'));
    expect(s.revealedRooms.has('R11')).toBe(true);
    expect(s.seenMonsters.has('m-mum4')).toBe(true);
    expect(s.seenMonsters.has('m-zom5')).toBe(true);
  });

  it('d7 shows R01 and d9 shows R03 with skeleton and two zombies', () => {
    const r01 = run(...via('d7'));
    expect(r01.revealedRooms.has('R01')).toBe(true);
    expect(r01.seenMonsters.has('m-ske1')).toBe(true);
    expect(r01.seenMonsters.has('m-mum1')).toBe(true);
    const r03 = run(...via('d9'));
    expect(r03.revealedRooms.has('R03')).toBe(true);
    for (const m of ['m-zom1', 'm-ske3', 'm-zom2']) expect(r03.seenMonsters.has(m)).toBe(true);
  });

  it('d3 shows R05: pit t1, two skeletons and a zombie', () => {
    const s = run(...via('d3'));
    expect(s.revealedRooms.has('R05')).toBe(true);
    for (const m of ['m-ske6', 'm-ske7', 'm-zom3']) expect(s.seenMonsters.has(m)).toBe(true);
    expect(s.seenCells.has(cellKey(19, 1))).toBe(true);
  });

  it('d4 shows the Witch Lord room R06 and puts him on X next to the throne', () => {
    const r = reduce(level, run(...seeing('d4')), open('d4'));
    expect(r.state.revealedRooms.has('R06')).toBe(true);
    expect(r.state.seenFurniture.has('f-throne')).toBe(true);
    for (const m of ['m-mum2', 'm-mum3', 'm-zom4']) expect(r.state.seenMonsters.has(m)).toBe(true);
    expect(r.state.seenMonsters.has('m-witch')).toBe(true);
    expect(r.state.placedMonsterCells['m-witch']).toEqual([23, 3]);
    expect(noteIds(r.prompts)).toContain('n-witch-seen');
  });

  it('the secret door s1 is not seen by sight and opens into R03 after a search', () => {
    const s = run(...seeingCell(12, 4));
    expect(s.seenCells.has(cellKey(12, 4))).toBe(true);
    expect(s.seenDoors.has('s1')).toBe(false);
    const f = run(
      ...seeingCell(12, 4),
      { type: 'SEARCH_SECRET_DOORS', cell: [12, 4], override: true },
      open('s1'),
    );
    expect(f.revealedRooms.has('R03')).toBe(true);
  });

  it('never reveals rock rooms', () => {
    const s = run(...via('d4'));
    for (const k of s.seenCells) expect(level.rock.has(k)).toBe(false);
    for (const r of quest.rock.rooms) expect(s.revealedRooms.has(r)).toBe(false);
  });
});

describe('quest 14: tomb note A', () => {
  it('the tomb room R12 is reached through R13 and fires note A: the tomb is empty', () => {
    const n = quest.notes.find((x) => x.letter === 'A')!;
    expect(n.at).toEqual([3, 10]);
    expect(n.trigger).toEqual({ type: 'areaRevealed', area: 'R12' });
    const r = reduce(level, run(...via('d6'), open('d13')), open('d12'));
    expect(r.state.revealedRooms.has('R12')).toBe(true);
    expect(r.state.seenFurniture.has('f-tomb')).toBe(true);
    expect(noteIds(r.prompts)).toContain('n-A');
    expect(r.state.seenMonsters.has('m-ske1')).toBe(false);
  });
});

describe('quest 14: the Witch Lord', () => {
  const inRoom = [...via('d4')];

  it('fear works twice and a third cast is refused; other spells once', () => {
    let s = run(...inRoom, cast('fear'), { type: 'ZARGON_TURN_END' }, cast('fear'));
    expect(s.spellsCast['m-witch']?.filter((x) => x === 'fear')).toHaveLength(2);
    s = reduce(level, s, { type: 'ZARGON_TURN_END' }).state;
    expect(() => reduce(level, s, cast('fear'))).toThrow(/already cast/);
    expect(() => reduce(level, s, cast('tempest'))).not.toThrow();
  });

  it('killing him fires the Spell Ring note and completes the objective', () => {
    const s = run(...inRoom);
    expect(objectivesStatus(level, s).goalDone).toBe(false);
    const r = reduce(level, s, { type: 'MONSTER_KILL', monster: 'm-witch' });
    expect(noteIds(r.prompts)).toContain('n-witch-dead');
    const note = quest.notes.find((n) => n.id === 'n-witch-dead')!;
    const gift = note.effects.find((e) => e.type === 'giveItem') as { text: string };
    expect(gift.text).toContain('Spell Ring');
    expect(objectivesStatus(level, r.state).goalDone).toBe(true);
    expect(quest.rewards).toContain('Champion');
  });
});
