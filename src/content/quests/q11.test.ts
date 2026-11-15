/** Walk-through of quest 11, Bastion of Dread: bounty text, armory (A), trapped chest and gargoyle (B), Orc's Bane (C). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { board } from '../../engine/board/board';
import { buildLevel } from '../../engine/board/level';
import type { GameEvent } from '../../engine/game/events';
import { lookHintCells } from '../../engine/game/hints';
import { initialState, reduce, replay } from '../../engine/game/reducer';
import { dormantFigures, journal, monstersInPlay, objectivesStatus } from '../../engine/game/view';
import { parseQuest } from '../../engine/quest/loader';
import { validateQuest } from '../../engine/quest/validate';

const quest = parseQuest(
  JSON.parse(readFileSync(resolve(import.meta.dirname, 'q11-bastion-of-dread.json'), 'utf8')),
);
const level = buildLevel(quest);
const open = (door: string): GameEvent => ({ type: 'OPEN_DOOR', door });
const run = (...events: GameEvent[]) => replay(level, 1, events);
const search = (room: string): GameEvent => ({
  type: 'SEARCH_TREASURE',
  room,
  hero: 'barbarian',
  override: true,
});
const kill = (monster: string): GameEvent => ({ type: 'MONSTER_KILL', monster });
const note = (letter: string) => quest.notes.find((n) => n.letter === letter);
const count = (type: string) => quest.monsters.filter((m) => m.type === type).length;
const areaOf = (c: readonly number[]) => board.cells[c[1]!]?.[c[0]!];
const kinds = (r: { prompts: readonly { kind: string }[] }) => r.prompts.map((p) => p.kind);

/** Looks from the given corridor squares (or hint squares) until the door is seen, then opens it. */
function via(events: GameEvent[], door: string, ...from: [number, number][]): GameEvent[] {
  const out = [...events];
  for (let i = 0; i < 60 && !run(...out).seenDoors.has(door); i++) {
    const hint = lookHintCells(level, run(...out))[0];
    if (!hint) break;
    out.push({ type: 'LOOK_FROM', cell: hint });
  }
  for (const cell of from) if (!run(...out).seenDoors.has(door)) out.push({ type: 'LOOK_FROM', cell });
  expect(run(...out).seenDoors.has(door)).toBe(true);
  return [...out, open(door)];
}
// Start on the stairs: d11 into R17, d9 into R20, d13 out to the south corridor, d7 into R12.
const toR17 = [open('d11')];
const toR20 = [...toR17, open('d9')];
const toR12 = via([...toR20, open('d13')], 'd7');
const secret: GameEvent = { type: 'SEARCH_SECRET_DOORS', area: 'R12', override: true };
const toR13 = [...toR12, secret, open('s1')];
const toR11 = via([...toR20, open('d13')], 'd12');

describe('quest 11: data', () => {
  it('is valid against the board', () => {
    expect(validateQuest(quest, board)).toEqual([]);
  });

  it('has 16 doors, one secret door, 7 blocks, 4 pits and the chest trap', () => {
    expect(quest.doors).toHaveLength(16);
    expect(quest.secretDoors).toEqual([{ id: 's1', a: [4, 11], b: [5, 11] }]);
    expect(quest.falseDoors).toEqual([]);
    expect(quest.blocks).toHaveLength(7);
    expect(quest.traps.filter((t) => t.kind === 'pit').map((t) => t.cell)).toEqual([
      [9, 12],
      [12, 13],
      [13, 13],
      [25, 18],
    ]);
    expect(quest.traps.filter((t) => t.kind === 'chest')).toHaveLength(1);
    expect(quest.start).toEqual({ area: 'R14' });
    expect(quest.wandering).toEqual({ monster: 'abomination' });
  });

  it('monster types match the map: 7 orcs, 9 goblins, 2 abominations, 4 Dread warriors, 1 gargoyle', () => {
    expect(quest.monsters).toHaveLength(23);
    expect(count('orc')).toBe(7);
    expect(count('goblin')).toBe(9);
    expect(count('abomination')).toBe(2);
    expect(count('dreadWarrior')).toBe(4);
    expect(count('gargoyle')).toBe(1);
  });

  it('the bounty is shown as text per kill type, not tracked', () => {
    expect(quest.rules.bounty).toEqual({ goblin: 10, orc: 20, abomination: 30, dreadWarrior: 50 });
    for (const amount of ['10', '20', '30', '50']) expect(quest.rewards).toContain(amount);
  });
});

describe('quest 11: start and walk-through', () => {
  it('starts on the stairs R14 with nothing else seen but its door d11', () => {
    const s = initialState(level, 1);
    expect(s.revealedRooms).toEqual(new Set(['R14']));
    expect(s.seenDoors.has('d11')).toBe(true);
    expect(s.seenMonsters.size).toBe(0);
  });

  it('d11 shows R17 with its goblins, d9 shows R20', () => {
    const s = run(...toR17);
    expect(s.revealedRooms.has('R17')).toBe(true);
    const inR17 = quest.monsters.filter((m) => areaOf(m.cell!) === 'R17');
    expect(inR17.map((m) => m.type)).toEqual(['goblin', 'goblin']);
    for (const m of inR17) expect(s.seenMonsters.has(m.id)).toBe(true);
    expect(s.seenDoors.has('d10')).toBe(true);
    expect(run(...toR20).revealedRooms.has('R20')).toBe(true);
  });

  it('d10 shows the fireplace room R18: three goblins and an orc', () => {
    const s = run(...via(toR17, 'd10'));
    expect(s.revealedRooms.has('R18')).toBe(true);
    expect(s.seenFurniture.has('f-fireplace')).toBe(true);
    const inR18 = quest.monsters.filter((m) => areaOf(m.cell!) === 'R18');
    expect(inR18.map((m) => m.type).sort()).toEqual([
      'goblin',
      'goblin',
      'goblin',
      'orc',
    ]);
    for (const m of inR18) expect(s.seenMonsters.has(m.id)).toBe(true);
  });

  it('R12 holds a Dread warrior and the alchemist bench', () => {
    const s = run(...toR12);
    expect(s.revealedRooms.has('R12')).toBe(true);
    expect(s.seenFurniture.has('f-bench')).toBe(true);
    const inR12 = quest.monsters.filter((m) => areaOf(m.cell!) === 'R12');
    expect(inR12.map((m) => m.type)).toEqual(['dreadWarrior']);
    expect(s.seenMonsters.has(inR12[0]!.id)).toBe(true);
  });

  it('the center room R11 holds two orcs, two goblins, the Dread warrior C, a table and a throne', () => {
    const inR11 = quest.monsters.filter((m) => areaOf(m.cell!) === 'R11');
    expect(inR11.map((m) => m.type).sort()).toEqual([
      'dreadWarrior',
      'goblin',
      'goblin',
      'orc',
      'orc',
    ]);
    const s = run(...toR11);
    expect(s.revealedRooms.has('R11')).toBe(true);
    for (const m of inR11) expect(s.seenMonsters.has(m.id)).toBe(true);
    expect(s.seenFurniture.has('f-throne')).toBe(true);
    expect(s.seenFurniture.has('f-table-c')).toBe(true);
  });

  it('never reveals rock rooms', () => {
    const s = run(...toR13);
    for (const k of s.seenCells) expect(level.rock.has(k)).toBe(false);
    for (const r of quest.rock.rooms) expect(s.revealedRooms.has(r)).toBe(false);
  });
});

describe('quest 11: letter A, the armory', () => {
  it('the first search of R21 gives the shield and uses the search up', () => {
    expect(note('A')?.trigger).toEqual({ type: 'treasureSearch', area: 'R21', first: true });
    const base = [...toR20, open('d13'), open('d15')];
    const s = run(...base);
    expect(s.revealedRooms.has('R21')).toBe(true);
    expect(s.seenFurniture.has('f-weapons')).toBe(true);
    const inR21 = quest.monsters.filter((m) => areaOf(m.cell!) === 'R21');
    expect(inR21.map((m) => m.type).sort()).toEqual(['dreadWarrior', 'orc']);
    for (const m of inR21) expect(s.seenMonsters.has(m.id)).toBe(true);
    const r = reduce(level, run(...base, ...inR21.map((m) => kill(m.id))), search('R21'));
    expect(r.prompts.find((p) => p.kind === 'note')).toMatchObject({
      noteId: 'n-A',
      at: [19, 14],
      consumesTreasure: true,
    });
    expect(kinds(r)).not.toContain('drawCard');
    const gift = note('A')?.effects.find((e) => e.type === 'giveItem') as { text: string };
    expect(gift.text).toContain('shield');
    expect(journal(level, r.state).map((j) => j.letter)).toContain('A');
  });
});

describe('quest 11: letter B, the chest and the gargoyle', () => {
  it('the secret door leads from R12 into R13 and shows the statue, the chest and note B', () => {
    expect(run(...toR12).seenDoors.has('s1')).toBe(false);
    const r = reduce(level, run(...toR12, secret), open('s1'));
    expect(r.state.revealedRooms.has('R13')).toBe(true);
    expect(r.prompts.find((p) => p.kind === 'note')).toMatchObject({ noteId: 'n-B', at: [6, 11] });
    expect(r.state.seenFurniture.has('f-chest')).toBe(true);
    expect(dormantFigures(level, r.state)).toEqual([
      { id: 'm-gargoyle', type: 'gargoyle', cell: [5, 12] },
    ]);
    expect(monstersInPlay(level, r.state).map((m) => m.id)).not.toContain('m-gargoyle');
  });

  it('searching the armed chest wakes the gargoyle', () => {
    const r = reduce(level, run(...toR13), search('R13'));
    expect(kinds(r)[0]).toBe('trapSprung');
    expect(r.prompts).toContainEqual(
      expect.objectContaining({ kind: 'monsterState', monster: 'm-gargoyle', state: 'active' }),
    );
    expect(r.state.notesFired).toContain('n-B-wake');
    expect(dormantFigures(level, r.state)).toEqual([]);
    expect(monstersInPlay(level, r.state).find((m) => m.id === 'm-gargoyle')).toMatchObject({
      state: 'active',
    });
  });

  it('disarming first tells the heroes what would have happened and leaves the statue asleep', () => {
    const s = run(...toR13, { type: 'SEARCH_TRAPS', furniture: 'f-chest', override: true });
    const r = reduce(level, s, {
      type: 'TRAP_DISARM',
      trap: 't-chest',
      by: 'toolkit',
      result: 'other',
    });
    expect(r.state.notesFired).toContain('n-B-disarm');
    expect(r.state.notesFired).not.toContain('n-B-wake');
    expect(dormantFigures(level, r.state)).toHaveLength(1);
    const text = quest.notes
      .find((n) => n.id === 'n-B-disarm')
      ?.effects.find((e) => e.type === 'showText') as { text: string };
    expect(text.text).toContain('woken');
  });
});

describe('quest 11: more chest cases', () => {
  it('note B does not mention the trap', () => {
    const text = note('B')?.effects.find((e) => e.type === 'showText') as { text: string };
    expect(text.text.toLowerCase()).not.toContain('trap');
    expect(text.text.toLowerCase()).not.toContain('search');
  });

  it('a failed disarm (tool kit, skull) springs the trap and wakes the gargoyle', () => {
    const s = run(...toR13, { type: 'SEARCH_TRAPS', furniture: 'f-chest', override: true });
    const r = reduce(level, s, {
      type: 'TRAP_DISARM',
      trap: 't-chest',
      by: 'toolkit',
      result: 'skull',
    });
    expect(r.state.notesFired).toContain('n-B-wake');
    expect(r.state.notesFired).not.toContain('n-B-disarm');
    expect(dormantFigures(level, r.state)).toEqual([]);
  });

  it('a dormant gargoyle does not block the search of R13', () => {
    const s = run(...toR13, { type: 'SEARCH_TRAPS', furniture: 'f-chest', override: true });
    const d = reduce(level, s, {
      type: 'TRAP_DISARM',
      trap: 't-chest',
      by: 'toolkit',
      result: 'other',
    }).state;
    expect(dormantFigures(level, d)).toHaveLength(1);
    const r = reduce(level, d, { type: 'SEARCH_TREASURE', room: 'R13', hero: 'barbarian' });
    expect(kinds(r)).toContain('drawCard');
  });
});

describe('quest 11: letter C, the magic sword', () => {
  it('killing the Dread warrior at 14,9 hands over Orc Bane', () => {
    const c = quest.monsters.find((m) => m.id === 'm-c')!;
    expect(c).toMatchObject({ type: 'dreadWarrior', cell: [14, 9] });
    expect(note('C')?.trigger).toEqual({ type: 'monsterKilled', monster: 'm-c' });
    const r = reduce(level, run(...toR11), kill('m-c'));
    expect(r.prompts.find((p) => p.kind === 'note')).toMatchObject({ noteId: 'n-C', at: [15, 10] });
    const gift = note('C')?.effects.find((e) => e.type === 'giveItem') as { text: string };
    expect(gift.text).toContain('Bane');
  });
});

describe('quest 11: end', () => {
  it('the objective needs every one of the 23 monsters dead, the gargoyle included', () => {
    const ids = quest.monsters.map((m) => m.id);
    expect(ids).toHaveLength(23);
    expect(quest.objectives).toHaveLength(1);
    expect(quest.objectives[0]?.done).toEqual({ allKilled: ids });
    const s = run(...toR13, search('R13'));
    expect(objectivesStatus(level, s).goalDone).toBe(false);
  });

  it('killing the seen monsters of R21 does not finish the quest', () => {
    const base = [...toR20, open('d13'), open('d15')];
    const inR21 = quest.monsters.filter((m) => areaOf(m.cell!) === 'R21');
    const s = run(...base, ...inR21.map((m) => kill(m.id)));
    expect(objectivesStatus(level, s).goalDone).toBe(false);
  });
});
