/** Walk-through of quest 6, Legacy of the Orc Warlord: start in the Cell, no gear until room A, Grak, stairs B. */
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
    readFileSync(resolve(import.meta.dirname, 'q06-legacy-of-the-orc-warlord.json'), 'utf8'),
  ),
);
const level = buildLevel(quest);
const open = (door: string): GameEvent => ({ type: 'OPEN_DOOR', door });
const run = (...events: GameEvent[]) => replay(level, 1, events);
const search = (room: string): GameEvent => ({ type: 'SEARCH_TREASURE', room, hero: 'barbarian' });
const note = (letter: string) => quest.notes.find((n) => n.letter === letter);
const monster = (id: string) => quest.monsters.find((m) => m.id === id);
// Out of the Cell, look along the corridors until the door is in sight (looks only from hint squares).
const seeing = (door: string): GameEvent[] => {
  const out: GameEvent[] = [open('d2')];
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
const areaOf = (c: [number, number]) => board.cells[c[1]]?.[c[0]];

describe('quest 6: data', () => {
  it('is valid against the board', () => {
    expect(validateQuest(quest, board)).toEqual([]);
  });

  it('has 10 doors, 5 blocks, 3 pits, 27 monsters (26 plus Grak), wandering abomination', () => {
    expect(quest.doors).toHaveLength(10);
    expect(quest.secretDoors).toEqual([]);
    expect(quest.falseDoors).toEqual([]);
    expect(quest.blocks).toHaveLength(5);
    expect(quest.blocks[0]?.cells).toEqual([
      [12, 1],
      [13, 1],
    ]);
    expect(quest.traps.map((t) => [t.kind, t.cell])).toEqual([
      ['pit', [16, 12]],
      ['pit', [0, 18]],
      ['pit', [8, 18]],
    ]);
    expect(quest.monsters).toHaveLength(27);
    expect(quest.monsters.filter((m) => m.type === 'abomination')).toHaveLength(3);
    // 12 orcs plus Grak, and 11 goblins, as read from the map (m7 at 25,1 is an orc).
    expect(quest.monsters.filter((m) => m.type === 'orc')).toHaveLength(13);
    expect(quest.monsters.filter((m) => m.type === 'goblin')).toHaveLength(11);
    expect(monster('m7')?.type).toBe('orc');
    expect(quest.wandering).toEqual({ monster: 'abomination' });
    expect(quest.start).toEqual({ area: 'R13' });
  });

  it('Grak is an orc with 8 / 4 / 4 / 3 / 3 and the spells fear, sleep, tempest, one per turn', () => {
    const g = monster('m-grak')!;
    expect(g).toMatchObject({
      type: 'orc',
      name: 'Grak',
      cell: [6, 16],
      overrides: { move: 8, att: 4, def: 4, body: 3, mind: 3 },
      spells: ['fear', 'sleep', 'tempest'],
      spellLimit: 'onePerTurn',
    });
    expect(areaOf(g.cell!)).toBe('R17');
  });
});

describe('quest 6: start in the Cell without equipment', () => {
  it('starts in the Cell R13 with its door d2 known and nothing else seen', () => {
    const s = initialState(level, 1);
    expect(s.revealedRooms).toEqual(new Set(['R13']));
    expect(s.seenMonsters.size).toBe(0);
    expect(s.seenDoors).toEqual(new Set(['d2']));
  });

  it('the quest says no equipment or spells until note A', () => {
    expect(quest.rules.noEquipmentUntil).toBe('n-A');
    expect(note('A')?.id).toBe('n-A');
    const start = quest.notes.find((n) => n.trigger.type === 'questStart')!;
    const text = start.effects.find((e) => e.type === 'showText') as { text: string };
    expect(text.text).toContain('1 attack die');
    expect(text.text).toContain('2 dice');
  });

  it('searching the Cell shows a message, draws no card and is not recorded', () => {
    const r = reduce(level, initialState(level, 1), search('R13'));
    expect(r.prompts.find((p) => p.kind === 'note')).toMatchObject({
      noteId: 'n-cell',
      blocksSearch: true,
    });
    expect(r.prompts.map((p) => p.kind)).not.toContain('drawCard');
    expect(r.state.treasureSearched['R13']).toBeUndefined();
  });
});

describe('quest 6: walk-through', () => {
  it('d2 opens the Cell onto the corridor', () => {
    const s = run(open('d2'));
    expect(s.openDoors.has('d2')).toBe(true);
  });

  it('d3 shows the center room R11: six orcs, an abomination, the table, door d4', () => {
    const s = run(...via('d3'));
    expect(s.revealedRooms.has('R11')).toBe(true);
    for (const m of ['m8', 'm9', 'm10', 'm11', 'm12', 'm13'])
      expect(s.seenMonsters.has(m)).toBe(true);
    expect(s.seenFurniture.has('f-table-c')).toBe(true);
    expect(s.seenDoors.has('d4')).toBe(true);
  });

  it('d5 shows R09: orc, abomination, goblin and the torture rack', () => {
    const s = run(...via('d5'));
    expect(s.revealedRooms.has('R09')).toBe(true);
    for (const m of ['m2', 'm3', 'm4']) expect(s.seenMonsters.has(m)).toBe(true);
    expect(s.seenFurniture.has('f-rack')).toBe(true);
  });

  it('d1 shows R01: goblin, cupboard, weapons rack', () => {
    const s = run(...via('d1'));
    expect(s.revealedRooms.has('R01')).toBe(true);
    expect(s.seenMonsters.has('m1')).toBe(true);
    expect(s.seenFurniture.has('f-cupboard')).toBe(true);
    expect(s.seenFurniture.has('f-weapons')).toBe(true);
  });

  it('d7 shows the stairs room R17 with Grak, d8 shows R18, d6 shows R20, d9 shows R21', () => {
    const r17 = run(...via('d7'));
    expect(r17.revealedRooms.has('R17')).toBe(true);
    for (const m of ['m-grak', 'm15', 'm16', 'm17', 'm18', 'm19'])
      expect(r17.seenMonsters.has(m)).toBe(true);
    expect(r17.seenFurniture.has('f-stairs')).toBe(true);
    expect(r17.seenFurniture.has('f-fireplace')).toBe(false);
    expect(r17.seenDoors.has('d10')).toBe(true);
    const r18 = run(...via('d8'));
    for (const m of ['m20', 'm21', 'm22']) expect(r18.seenMonsters.has(m)).toBe(true);
    const r20 = run(...via('d6'));
    expect(r20.seenMonsters.has('m23')).toBe(true);
    expect(r20.seenFurniture.has('f-fireplace')).toBe(true);
    const r21 = run(...via('d9'));
    expect(r21.revealedRooms.has('R21')).toBe(true);
    expect(r21.seenFurniture.has('f-table-e')).toBe(true);
  }, 20000);

  it('never reveals rock rooms', () => {
    const s = run(
      ...via('d9'),
      ...via('d1').slice(-1),
      ...['d3', 'd5'].flatMap((d) => via(d).slice(-1)),
    );
    for (const k of s.seenCells) expect(level.rock.has(k)).toBe(false);
    for (const r of quest.rock.rooms) expect(s.revealedRooms.has(r)).toBe(false);
  });
});

describe('quest 6: letters A and B', () => {
  it('A: the first search of R01 returns the equipment and uses the search up', () => {
    expect(note('A')?.trigger).toEqual({ type: 'treasureSearch', area: 'R01', first: true });
    const s = run(...via('d1'), { type: 'MONSTER_KILL', monster: 'm1' });
    const r = reduce(level, s, search('R01'));
    expect(r.prompts.find((p) => p.kind === 'note')).toMatchObject({
      noteId: 'n-A',
      letter: 'A',
      at: [1, 3],
      consumesTreasure: true,
    });
    expect(r.prompts.map((p) => p.kind)).not.toContain('drawCard');
    expect(journal(level, r.state).map((j) => j.letter)).toContain('A');
  });

  it('B: the stairs end the quest for the hero who reaches them', () => {
    expect(note('B')?.trigger.type).toBe('manual');
    const s = run(...via('d7'));
    expect(objectivesStatus(level, s).goalDone).toBe(false);
    const r = reduce(level, s, { type: 'MANUAL_TRIGGER', note: 'n-B' });
    expect(r.state.objectivesDone).toContain('o1');
    expect(objectivesStatus(level, r.state).goalDone).toBe(true);
  });
});

describe('quest 6: Grak', () => {
  it('killing Grak hands the Wizard Cloak card to the wizard', () => {
    const s = run(...via('d7'));
    const r = reduce(level, s, { type: 'MONSTER_KILL', monster: 'm-grak' });
    expect(r.prompts.find((p) => p.kind === 'note')).toMatchObject({ noteId: 'n-grak-dead' });
    const gift = quest.notes
      .find((n) => n.id === 'n-grak-dead')
      ?.effects.find((e) => e.type === 'giveItem') as { text: string };
    expect(gift.text).toContain('Wizard');
    expect(objectivesStatus(level, r.state).goalDone).toBe(false);
  });

  it('Grak can cast fear, sleep and tempest', () => {
    const s = run(...via('d7'), { type: 'SPELL_CAST', monster: 'm-grak', spell: 'fear' });
    expect(s.spellsCast['m-grak']).toContain('fear');
  });
});
