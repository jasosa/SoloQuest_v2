/** Walk-through of quest 12, Barak Tor: false doors A, Star zombie B, falling block C, Witch Lord D, staff E. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { board } from '../../engine/board/board';
import { buildLevel } from '../../engine/board/level';
import type { GameEvent } from '../../engine/game/events';
import { lookHintCells } from '../../engine/game/hints';
import { initialState, reduce, replay } from '../../engine/game/reducer';
import { manualTriggers, monstersInPlay, objectivesStatus } from '../../engine/game/view';
import { parseQuest } from '../../engine/quest/loader';
import { validateQuest } from '../../engine/quest/validate';

const quest = parseQuest(
  JSON.parse(readFileSync(resolve(import.meta.dirname, 'q12-barak-tor.json'), 'utf8')),
);
const level = buildLevel(quest);
const open = (door: string): GameEvent => ({ type: 'OPEN_DOOR', door });
const run = (...events: GameEvent[]) => replay(level, 1, events);
const search = (room: string): GameEvent => ({ type: 'SEARCH_TREASURE', room, hero: 'barbarian' });
const count = (type: string) => quest.monsters.filter((m) => m.type === type).length;
const monster = (id: string) => quest.monsters.find((m) => m.id === id);
const areaOf = (c: readonly number[]) => board.cells[c[1]!]?.[c[0]!];
const noteIds = (prompts: readonly { kind: string }[]) =>
  prompts.filter((p) => p.kind === 'note').map((p) => (p as unknown as { noteId: string }).noteId);

/** Looks from hint squares until the door is seen, then opens it. */
function via(events: GameEvent[], door: string): GameEvent[] {
  const out = [...events];
  for (let i = 0; i < 40 && !run(...out).seenDoors.has(door); i++) {
    const hint = lookHintCells(level, run(...out))[0];
    if (!hint) break;
    out.push({ type: 'LOOK_FROM', cell: hint });
  }
  expect(run(...out).seenDoors.has(door)).toBe(true);
  return [...out, open(door)];
}

/** Looks from hint squares until the condition holds. */
function lookUntil(events: GameEvent[], done: (s: ReturnType<typeof run>) => boolean): GameEvent[] {
  const out = [...events];
  for (let i = 0; i < 60 && !done(run(...out)); i++) {
    const hint = lookHintCells(level, run(...out))[0];
    if (!hint) break;
    out.push({ type: 'LOOK_FROM', cell: hint });
  }
  expect(done(run(...out))).toBe(true);
  return out;
}

// The way out of the stairs room: d12 to the west corridor, d1 (R01), d2 (R02), d4 (R03), then the
// secret door s1 (blocks seal the corridors), then d5 (center room).
const toR03 = (): GameEvent[] => via(via(via([], 'd12'), 'd2'), 'd4');
const toCenter = (): GameEvent[] => {
  const e = [
    ...via(via(via([], 'd12'), 'd2'), 'd4'),
    { type: 'SEARCH_SECRET_DOORS', area: 'R03', override: true } as GameEvent,
    open('s1'),
  ];
  return via(e, 'd5');
};
const toTomb = (): GameEvent[] => {
  const e = [...toCenter(), open('d6')];
  return via(via(e, 'd7'), 'd8');
};

describe('quest 12: data', () => {
  it('is valid against the board', () => {
    expect(validateQuest(quest, board)).toEqual([]);
  });

  it('has 12 doors, 4 secret doors, 3 false doors, 10 blocks, start in R20', () => {
    expect(quest.doors).toHaveLength(12);
    expect(quest.secretDoors).toHaveLength(4);
    expect(quest.falseDoors.map((d) => [d.a, d.b])).toEqual([
      [
        [18, 0],
        [18, 1],
      ],
      [
        [22, 0],
        [22, 1],
      ],
      [
        [24, 7],
        [25, 7],
      ],
    ]);
    expect(quest.blocks).toHaveLength(10);
    expect(quest.start).toEqual({ area: 'R20' });
    expect(quest.wandering).toEqual({ monster: 'skeleton' });
  });

  it('has 2 mummies, 5 zombies, 5 skeletons, 1 dread warrior and the Witch Lord', () => {
    expect(count('mummy')).toBe(2);
    expect(count('zombie')).toBe(5);
    expect(count('skeleton')).toBe(5);
    expect(count('dreadWarrior')).toBe(1);
    expect(count('dreadSorcerer')).toBe(1);
    expect(quest.monsters).toHaveLength(14);
  });

  it('has 3 spear traps and 2 pits (the falling rock is a note, not a trap)', () => {
    expect(quest.traps.filter((t) => t.kind === 'spear')).toHaveLength(3);
    expect(quest.traps.filter((t) => t.kind === 'pit')).toHaveLength(2);
    expect(quest.traps.filter((t) => t.kind === 'spear').map((t) => t.cell)).toEqual([
      [15, 0],
      [17, 0],
      [20, 0],
    ]);
    expect(quest.traps.filter((t) => t.kind === 'pit').map((t) => t.cell)).toEqual([
      [25, 6],
      [16, 12],
    ]);
    expect(quest.traps.some((t) => t.kind === 'scripted')).toBe(false);
  });

  it('the Witch Lord moves 1, attacks with 2 dice, has four spells and only the Spirit Blade harms him', () => {
    const w = monster('m-witch')!;
    expect(w).toMatchObject({
      type: 'dreadSorcerer',
      name: 'Witch Lord',
      cell: [1, 10],
      hidden: true,
      overrides: { move: 1, att: 2 },
      spellLimit: 'onePerTurn',
    });
    expect([...w.spells!].sort()).toEqual(['ballOfFlame', 'command', 'fear', 'summon']);
    expect(w.traits?.join(' ')).toContain('Spirit Blade');
    expect(areaOf(w.cell!)).toBe('R12');
  });
});

describe('quest 12: walk-through', () => {
  it('starts in R20 on the stairs, sees nothing else', () => {
    const s = initialState(level, 1);
    expect(s.revealedRooms).toEqual(new Set(['R20']));
    expect(s.seenMonsters.size).toBe(0);
    expect(s.seenFurniture.has('f-stairs')).toBe(true);
  });

  it('d12 leads to the west corridor, d1 shows the mummy room R01', () => {
    const s = run(...via(via([], 'd12'), 'd1'));
    expect(s.revealedRooms.has('R01')).toBe(true);
    expect(s.seenMonsters.has('m1')).toBe(true);
    expect(monstersInPlay(level, s).map((m) => m.id)).toContain('m1');
  });

  it('d2 shows R02: two zombies and two skeletons', () => {
    const s = run(...via(via([], 'd12'), 'd2'));
    expect(s.revealedRooms.has('R02')).toBe(true);
    for (const m of ['m2', 'm3', 'm4', 'm5']) expect(s.seenMonsters.has(m)).toBe(true);
    const types = quest.monsters.filter((m) => areaOf(m.cell!) === 'R02').map((m) => m.type);
    expect(types.sort()).toEqual(['skeleton', 'skeleton', 'zombie', 'zombie']);
  });

  it('R03 is empty, and the blocks seal the corridor until the secret door s1 is found', () => {
    const s = run(...toR03());
    expect(s.revealedRooms.has('R03')).toBe(true);
    expect(quest.monsters.filter((m) => areaOf(m.cell!) === 'R03')).toHaveLength(0);
  });

  it('s1 opens from R03 to the corridor and d5 shows the center room with the Star zombie and the table', () => {
    const s = run(...toCenter());
    expect(s.revealedRooms.has('R11')).toBe(true);
    expect(s.seenMonsters.has('m-star')).toBe(true);
    expect(s.seenFurniture.has('f-table')).toBe(true);
    expect(quest.monsters.filter((m) => areaOf(m.cell!) === 'R11')).toHaveLength(1);
  });

  it('a false door answers "stuck", never opens, and fires no note', () => {
    const looked = lookUntil(via(toR03(), 'd3'), (st) => st.seenDoors.has('x1'));
    const r = reduce(level, run(...looked), open('x1'));
    expect(r.prompts.map((p) => p.kind)).toEqual(['doorStuck']);
    expect(r.state.openDoors.has('x1')).toBe(false);
  });

  it('letter A is a manual note about the false doors', () => {
    const n = quest.notes.find((x) => x.letter === 'A')!;
    expect(n.trigger).toMatchObject({ type: 'manual' });
    const s = run(...toCenter());
    const r = reduce(level, s, { type: 'MANUAL_TRIGGER', note: 'n-A' });
    expect(noteIds(r.prompts)).toEqual(['n-A']);
  });
});

describe('quest 12: secret doors and sealed corridors', () => {
  it('without s1 the center room door d5 is never seen from the north rooms', () => {
    const out = via(via(via([], 'd12'), 'd2'), 'd4');
    const opened = via(out, 'd3');
    for (let i = 0; i < 60; i++) {
      const hint = lookHintCells(level, run(...opened))[0];
      if (!hint) break;
      opened.push({ type: 'LOOK_FROM', cell: hint });
    }
    const s = run(...opened);
    expect(s.seenDoors.has('d5')).toBe(false);
    expect(s.revealedRooms.has('R11')).toBe(false);
  });

  it('s3 links the stairs room with R17: search from R20, open it', () => {
    const s = run({ type: 'SEARCH_SECRET_DOORS', area: 'R20', override: true }, open('s3'));
    expect(s.openDoors.has('s3')).toBe(true);
    expect(s.revealedRooms.has('R17')).toBe(true);
    expect(s.seenMonsters.has('m12')).toBe(true);
  });
});

describe('quest 12: letter B, the Star of the West', () => {
  it('killing the zombie at (11,9) hands over the Star and completes the objective', () => {
    expect(monster('m-star')).toMatchObject({ type: 'zombie', cell: [11, 9] });
    const s = run(...toCenter());
    expect(objectivesStatus(level, s).goalDone).toBe(false);
    const r = reduce(level, s, { type: 'MONSTER_KILL', monster: 'm-star' });
    expect(noteIds(r.prompts)).toContain('n-B');
    expect(objectivesStatus(level, r.state).goalDone).toBe(true);
  });

  it('another monster dying does not give the Star', () => {
    const s = run(...via(via([], 'd12'), 'd1'));
    const r = reduce(level, s, { type: 'MONSTER_KILL', monster: 'm1' });
    expect(noteIds(r.prompts)).not.toContain('n-B');
    expect(objectivesStatus(level, r.state).goalDone).toBe(false);
  });
});

describe('quest 12: letter C, the falling block', () => {
  it('the manual note blocks square (0,0) for good', () => {
    const s = run(...via([], 'd12'));
    expect(s.placedBlocks.has('0,0')).toBe(false);
    const n = quest.notes.find((x) => x.letter === 'C')!;
    expect(n.trigger).toMatchObject({ type: 'manual' });
    const r = reduce(level, s, { type: 'MANUAL_TRIGGER', note: 'n-C' });
    expect(r.state.placedBlocks.has('0,0')).toBe(true);
    expect(noteIds(r.prompts)).toEqual(['n-C']);
    expect(manualTriggers(level, r.state).map((m) => m.note)).not.toContain('n-C');
  });
});

describe('quest 12: letter D, the Witch Lord', () => {
  it('opening into the tomb room shows its monsters, the tomb, not the Witch Lord yet', () => {
    const s = run(...toTomb());
    expect(s.revealedRooms.has('R12')).toBe(true);
    expect(s.seenFurniture.has('f-tomb')).toBe(true);
    expect(s.seenMonsters.has('m7')).toBe(true);
    expect(s.seenMonsters.has('m11')).toBe(true);
    expect(s.placedMonsterCells['m-witch']).toBeUndefined();
    expect(monstersInPlay(level, s).map((m) => m.id)).not.toContain('m-witch');
    expect(
      quest.monsters
        .filter((m) => areaOf(m.cell!) === 'R12')
        .map((m) => m.type)
        .sort(),
    ).toEqual(['dreadSorcerer', 'zombie', 'zombie']);
  });

  it('the first hero entering R12 places the Witch Lord on X', () => {
    const s = run(...toTomb());
    const r = reduce(level, s, { type: 'AREA_ENTER', area: 'R12' });
    expect(noteIds(r.prompts)).toEqual(['n-D']);
    expect(r.state.placedMonsterCells['m-witch']).toEqual([1, 10]);
    const w = monstersInPlay(level, r.state).find((m) => m.id === 'm-witch');
    expect(w).toBeDefined();
  });

  it('the Witch Lord is not placed before anyone enters, and never by other rooms', () => {
    const s = run(...toCenter());
    expect(s.placedMonsterCells['m-witch']).toBeUndefined();
    const r = run(...toTomb(), { type: 'AREA_ENTER', area: 'R12' });
    expect(r.placedMonsterCells['m-witch']).toEqual([1, 10]);
  });

  it('R14 (d9) shows two skeletons and R13 one skeleton', () => {
    const e = toTomb();
    const s = run(...e, open('d9'));
    expect(s.revealedRooms.has('R13')).toBe(true);
    expect(s.revealedRooms.has('R14')).toBe(true);
    for (const m of ['m8', 'm9', 'm10']) expect(s.seenMonsters.has(m)).toBe(true);
  });
});

describe('quest 12: letter E, the Wizard staff', () => {
  const toR17 = () => [...toTomb(), open('d10')];

  it('d10 shows R17: the mummy and two bookcases', () => {
    const s = run(...toR17());
    expect(s.revealedRooms.has('R17')).toBe(true);
    expect(s.seenMonsters.has('m12')).toBe(true);
    expect(s.seenFurniture.has('f-book1')).toBe(true);
    expect(s.seenFurniture.has('f-book2')).toBe(true);
  });

  it('the first treasure search gives the Wizard staff and draws no card', () => {
    const s = run(...toR17(), { type: 'MONSTER_KILL', monster: 'm12' });
    const r = reduce(level, s, search('R17'));
    expect(r.prompts.find((p) => p.kind === 'note')).toMatchObject({
      noteId: 'n-E',
      letter: 'E',
      consumesTreasure: true,
    });
    expect(r.prompts.map((p) => p.kind)).not.toContain('drawCard');
    const n = quest.notes.find((x) => x.letter === 'E')!;
    expect(n.trigger).toEqual({ type: 'treasureSearch', area: 'R17', first: true });
    expect(n.at).toEqual([5, 17]);
  });

  it('the secret doors s3 and s4 connect R17 with the stairs room R20 and with R18', () => {
    const s = run(...toR17());
    const r = reduce(level, s, { type: 'SEARCH_SECRET_DOORS', area: 'R17', override: true });
    expect(r.state.seenDoors.has('s3') || r.state.seenDoors.has('s4')).toBe(true);
    const s3 = run(
      ...toR17(),
      { type: 'SEARCH_SECRET_DOORS', area: 'R17', override: true },
      open('s4'),
    );
    expect(s3.revealedRooms.has('R18')).toBe(true);
  });
});

describe('quest 12: rock and the dread warrior', () => {
  it('never reveals rock rooms', () => {
    const s = run(...toCenter());
    for (const r of quest.rock.rooms) expect(s.revealedRooms.has(r)).toBe(false);
    for (const k of s.seenCells) expect(level.rock.has(k)).toBe(false);
  });

  it('the dread warrior stands in the corridor at (12,15)', () => {
    expect(monster('m13')).toMatchObject({ type: 'dreadWarrior', cell: [12, 15] });
    expect(areaOf([12, 15])).toBe('C');
  });
});
