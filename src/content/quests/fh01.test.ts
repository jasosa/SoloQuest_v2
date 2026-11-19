/** Walk-through of Frozen Horror quest 1, Xanon Pass (solo Barbarian). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { board } from '../../engine/board/board';
import { buildLevel } from '../../engine/board/level';
import { applyCoreFile, parseCoreFile } from '../../engine/data/coreFile';
import type { GameEvent } from '../../engine/game/events';
import { lookHintCells } from '../../engine/game/hints';
import { reduce, replay, startGame } from '../../engine/game/reducer';
import {
  boardTilesInView,
  monstersInPlay,
  objectivesStatus,
  trapsInView,
} from '../../engine/game/view';
import { objectiveConfirms } from '../../engine/game/noteView';
import { parseQuest } from '../../engine/quest/loader';
import { validateQuest } from '../../engine/quest/validate';
import { ordersFor } from '../../engine/zargon/orders';

// The Frozen Horror abilities come from the Core library files.
applyCoreFile(
  parseCoreFile(
    JSON.parse(readFileSync(resolve(import.meta.dirname, '../library/frozen-horror.json'), 'utf8')),
  )!,
);

const quest = parseQuest(
  JSON.parse(readFileSync(resolve(import.meta.dirname, 'fh01-xanon-pass.json'), 'utf8')),
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
const fired = (s: ReturnType<typeof run>, id: string) => s.notesFired.includes(id);
const look = (x: number, y: number): GameEvent => ({ type: 'LOOK_FROM', cell: [x, y] });

// Walking: look along the corridors until a door is in sight (as the players do), then open it.
const reach = (base: GameEvent[], door: string): GameEvent[] => {
  const ev = [...base];
  for (let i = 0; i < 80; i++) {
    const s = run(...ev);
    if (s.seenDoors.has(door)) return [...ev, open(door)];
    const next = lookHintCells(level, s)[0];
    if (!next) break;
    ev.push({ type: 'LOOK_FROM', cell: next });
  }
  throw new Error(`door ${door} never seen`);
};

const start: GameEvent[] = [open('in')];
// The block at (1,9) closes row 9 at the entry: the way is up column 0 and along the top row.
const toRow9: GameEvent[] = reach(start, 'd5');
const toR07: GameEvent[] = toRow9; // reach() opens the door it was looking for
// The blocks cut the corridors in two: the west half (column 0, the top row up to column 13, row 9,
// column 9) and the east half (column 25, the bottom row, the exit row). The only way across is the
// Crossbowman's room R18: in by door d10 from the west, out by door d12 to the east.
const toR18: GameEvent[] = reach(start, 'd10');
const east: GameEvent[] = [...toR18, open('d12')];
const toR01: GameEvent[] = [...toR07, open('d3')];
const toR02: GameEvent[] = [...toR01, open('d1')];
const toR03: GameEvent[] = [...toR02, open('d2')];

describe('quest 1: data', () => {
  it('is valid against the board', () => {
    expect(validateQuest(quest, board)).toEqual([]);
  });

  it('has the map of Xanon Pass: doors, blocks, furniture, monsters and traps', () => {
    expect(quest.number).toBe(1);
    expect(quest.pack).toBe('frozen-horror');
    expect(quest.edgeDoors.map((e) => e.kind).sort()).toEqual(['ironEntry', 'woodenExit']);
    expect(quest.doors).toHaveLength(15);
    expect(quest.secretDoors).toHaveLength(1);
    expect(quest.blocks).toHaveLength(8);
    expect(quest.furniture.map((f) => f.type).sort()).toEqual(
      ['alchemistsBench', 'bookcase', 'chest', 'table', 'tomb', 'weaponsRack'].sort(),
    );
    expect(quest.monsters).toHaveLength(16);
    const kinds = quest.traps.map((t) => t.kind);
    expect(kinds.filter((k) => k === 'wanderingTrap')).toHaveLength(2);
    expect(kinds.filter((k) => k === 'pit')).toHaveLength(1);
    expect(kinds.filter((k) => k === 'swingingAxe')).toHaveLength(2);
    expect(kinds.filter((k) => k === 'stalactite')).toHaveLength(5);
    // the slippery ice is one 2 x 3 tile, not eight traps
    expect(kinds.filter((k) => k === 'slipperyIce')).toHaveLength(0);
    expect(quest.boardTiles).toHaveLength(1);
    expect(quest.boardTiles[0]).toMatchObject({ type: 'slipperyIce' });
    expect(quest.boardTiles[0]!.cells).toHaveLength(6);
    expect(quest.wandering).toEqual({ monster: 'skeleton', count: 2 });
  });

  it('every letter on the map has a note', () => {
    for (const l of ['A', 'B', 'C', 'D'])
      expect(
        quest.notes.some((n) => n.letter === l),
        `note ${l}`,
      ).toBe(true);
  });

  it('every monster shows with a picture of its own kind', () => {
    const by = (id: string) => quest.monsters.find((m) => m.id === id)!;
    const defs = new Map(quest.enemyDefs.map((e) => [e.id, e]));
    // Frozen Horror monsters are enemies with no core base, so no core picture is used
    for (const id of ['m-yeti', 'm-gremlin-1', 'm-gremlin-2', 'm-bear', 'm-xbow']) {
      const def = defs.get(by(id).enemy!)!;
      expect(def.expansion).toBe('Frozen Horror');
      expect(def.base).toBeUndefined();
    }
    // core monsters keep their type
    expect(by('m-mummy').type).toBe('mummy');
    expect(by('m-abom-1').type).toBe('abomination');
    expect(by('m-skel').type).toBe('skeleton');
    expect(by('m-zombie').type).toBe('zombie');
    expect(by('m-orc-3').type).toBe('orc');
    expect(by('m-gob-3').type).toBe('goblin');
  });
});

describe('quest 1: the start and the corridors', () => {
  it('the Barbarian stands outside the iron door and sees only that door', () => {
    const { state } = startGame(level, 1);
    expect([...state.seenDoors]).toEqual(['in']);
    expect(state.seenCells.size).toBe(0);
  });

  it('opening it shows column 0 and the block that shuts row 9 at the entry', () => {
    const s = run(...start);
    expect(s.seenCells.has('0,9')).toBe(true);
    expect(s.seenBlocks.size).toBeGreaterThan(0);
    expect(s.seenCells.has('3,9')).toBe(false);
  });

  it('the top row is shut by a block at (14,0): the exit door is not in sight from the west', () => {
    const up = run(...start, look(0, 0), look(13, 0));
    expect(up.seenCells.has('13,0')).toBe(true);
    expect(up.seenCells.has('15,0')).toBe(false);
    expect(up.seenDoors.has('out')).toBe(false);
    expect(up.seenBlocks.size).toBeGreaterThan(0);
  });

  it('rock is never revealed: the center room and the far rooms stay hidden', () => {
    const s = run(...toR03);
    for (const room of ['R05', 'R06', 'R11', 'R15', 'R16', 'R19', 'R21', 'R22'])
      expect(s.revealedRooms.has(room), room).toBe(false);
  });
});

describe('quest 1: the north-west rooms', () => {
  it('R07 holds two orcs and nothing else, and R01 has the mummy and the wandering monster trap', () => {
    const a = run(...toR07);
    expect(a.revealedRooms.has('R07')).toBe(true);
    expect(a.seenMonsters.has('m-orc-1') && a.seenMonsters.has('m-orc-2')).toBe(true);
    expect(a.seenFurniture.size).toBe(0);
    const b = run(...toR01);
    expect(b.seenMonsters.has('m-mummy')).toBe(true);
    expect(trapsInView(level, b).map((t) => t.id)).toContain('t-wander-1');
    expect(trapsInView(level, b).map((t) => t.id)).toContain('t-pit-1');
  });

  it('R02 shows the bookcase and the two swinging axe squares', () => {
    const s = run(...toR02);
    expect(s.seenFurniture.has('f-bookcase')).toBe(true);
    const ids = trapsInView(level, s).map((t) => t.id);
    expect(ids).toContain('t-axe-1');
    expect(ids).toContain('t-axe-2');
  });

  it('R03 shows the Yeti, a plain brute in this solo quest', () => {
    const s = run(...toR03);
    expect(s.seenMonsters.has('m-yeti')).toBe(true);
    const yeti = monstersInPlay(level, s).find((m) => m.id === 'm-yeti')!;
    expect(yeti.name).toBe('Yeti');
    expect(yeti.box).toBe('Frozen Horror');
    expect(yeti.pictureType).toBeUndefined();
    const order = ordersFor(level, s, ['barbarian']).find((o) => o.monster === 'm-yeti')!;
    expect(order.profile).toBe('fighter');
    expect(JSON.stringify(order)).not.toMatch(/Bear hug/);
  });

  it('R08 shows the table, reached from R03 by door d4', () => {
    const s = run(...toR03, open('d4'));
    expect(s.revealedRooms.has('R08')).toBe(true);
    expect(s.seenFurniture.has('f-table')).toBe(true);
  });
});

describe('quest 1: the south-west rooms', () => {
  // R20 from column 0, then R17, R14, R13, R12 by the inner doors.
  const toR20: GameEvent[] = reach(start, 'd11');
  const toR12: GameEvent[] = [...toR20, open('d13'), open('d9'), open('d7'), open('d8')];

  it('R20 shows two goblins and an orc with the alchemist bench', () => {
    const s = run(...toR20);
    expect(s.revealedRooms.has('R20')).toBe(true);
    for (const m of ['m-gob-3', 'm-orc-3']) expect(s.seenMonsters.has(m)).toBe(true);
    expect(s.seenFurniture.has('f-bench')).toBe(true);
  });

  it('A: the chest of R12 holds 75 gold coins', () => {
    const s = run(...toR12);
    expect(s.revealedRooms.has('R12')).toBe(true);
    expect(s.seenFurniture.has('f-chest')).toBe(true);
    expect(s.seenMonsters.has('m-gob-1') && s.seenMonsters.has('m-gob-2')).toBe(true);
    const found = reduce(level, s, search('R12'));
    expect(fired(found.state, 'n-A')).toBe(true);
    expect(JSON.stringify(found.prompts)).toContain('75 gold coins');
  });

  it('R14 has a skeleton and a zombie, and R17 an abomination with a stalactite at its door', () => {
    const s = run(...toR12);
    expect(s.seenMonsters.has('m-skel') && s.seenMonsters.has('m-zombie')).toBe(true);
    expect(s.seenMonsters.has('m-abom-2')).toBe(true);
    expect(trapsInView(level, s).map((t) => t.id)).toContain('t-stal-5');
  });
});

describe('quest 1: the Crossbowman of room R18', () => {
  const inside = run(...toR18);

  it('B: he is seen when the door opens, with the large slippery ice tile', () => {
    expect(inside.revealedRooms.has('R18')).toBe(true);
    expect(inside.seenMonsters.has('m-xbow')).toBe(true);
    expect(fired(inside, 'n-B')).toBe(true);
    // the slippery ice is one tile over six squares, drawn with its rule, not six trap marks
    expect(boardTilesInView(level, inside).map((t) => t.type)).toContain('slipperyIce');
  });

  it('he stays put, is a shooter, and carries the Frozen Horror box', () => {
    const v = monstersInPlay(level, inside).find((m) => m.id === 'm-xbow')!;
    expect(v.name).toBe('Crossbowman');
    expect(v.box).toBe('Frozen Horror');
    expect(v.pictureType).toBeUndefined();
    const order = ordersFor(level, inside, ['barbarian']).find((o) => o.monster === 'm-xbow')!;
    expect(order.profile).toBe('shooter');
    expect(JSON.stringify(order)).toMatch(/does not move|stay/i);
  });

  it("attacking him from next to him: he yields, the crossbow is the Barbarian's and he leaves", () => {
    const asked = reduce(level, inside, { type: 'MANUAL_TRIGGER', note: 'n-B-attack' });
    expect(asked.prompts.some((p) => p.kind === 'choice')).toBe(true);
    const yes = reduce(level, asked.state, { type: 'CHOOSE', note: 'n-B-attack', option: 0 });
    expect(JSON.stringify(yes.prompts)).toContain('crossbow');
    expect(monstersInPlay(level, yes.state).some((m) => m.id === 'm-xbow')).toBe(false);
    expect(yes.state.monsters['m-xbow']?.dead).toBe(false);
  });

  it('answering No changes nothing', () => {
    const asked = reduce(level, inside, { type: 'MANUAL_TRIGGER', note: 'n-B-attack' });
    const no = reduce(level, asked.state, { type: 'CHOOSE', note: 'n-B-attack', option: 1 });
    expect(monstersInPlay(level, no.state).some((m) => m.id === 'm-xbow')).toBe(true);
  });
});

describe('quest 1: the east side', () => {
  // Out of R18 by door d12, along the bottom row and up column 25 to row 9: door d15 opens R09.
  const toD15: GameEvent[] = reach(east, 'd15');

  it('R09 shows the stalactites, R10 the Abomination and the tomb (note C)', () => {
    const s = run(...toD15);
    expect(s.revealedRooms.has('R09')).toBe(true);
    const ids = trapsInView(level, s).map((t) => t.id);
    for (const t of ['t-stal-2', 't-stal-3', 't-stal-4']) expect(ids).toContain(t);
    const r10 = run(...toD15, open('d14'));
    expect(r10.revealedRooms.has('R10')).toBe(true);
    expect(r10.seenMonsters.has('m-abom-1')).toBe(true);
    expect(r10.seenFurniture.has('f-tomb')).toBe(true);
    expect(fired(reduce(level, r10, search('R10')).state, 'n-C')).toBe(true);
  });

  it('D: the secret door leads from R09 to the weapons room R04, with the Warbear and the longsword', () => {
    const s = run(...toD15);
    expect(s.seenDoors.has('s1')).toBe(false);
    const found = reduce(level, s, { type: 'SEARCH_SECRET_DOORS', area: 'R09', override: true });
    expect(found.state.seenDoors.has('s1')).toBe(true);
    const inside = run(
      ...toD15,
      { type: 'SEARCH_SECRET_DOORS', area: 'R09', override: true },
      open('s1'),
    );
    expect(inside.revealedRooms.has('R04')).toBe(true);
    expect(inside.seenMonsters.has('m-bear')).toBe(true);
    expect(inside.seenFurniture.has('f-weapons')).toBe(true);
    const bear = monstersInPlay(level, inside).find((m) => m.id === 'm-bear')!;
    expect(bear.name).toBe('Polar Warbear');
    expect(fired(reduce(level, inside, search('R04')).state, 'n-D')).toBe(true);
  });
});

describe('quest 1: wandering monsters and hazards', () => {
  it('the wandering monsters are Skeletons: the card brings one, the trap in R01 brings the pair', () => {
    const card = reduce(level, run(...toR18), {
      type: 'WANDERING_MONSTER',
      room: 'R18',
      hero: 'barbarian',
    });
    const one = monstersInPlay(level, card.state).filter((m) => m.id.startsWith('w'));
    expect(one.map((m) => m.type)).toEqual(['skeleton']);
    const trap = reduce(level, run(...toR01), { type: 'TRAP_STEP', trap: 't-wander-1' });
    const pair = monstersInPlay(level, trap.state).filter((m) => m.id.startsWith('w'));
    expect(pair.map((m) => m.type)).toEqual(['skeleton', 'skeleton']);
  });

  it('the stalactite springs with its kind told at the spring', () => {
    const r = reduce(level, run(...reach(east, 'd15')), { type: 'TRAP_STEP', trap: 't-stal-2' });
    expect(JSON.stringify(r.prompts)).toContain('stalactite');
  });
});

describe('quest 1: leaving', () => {
  const toExit: GameEvent[] = reach(east, 'out');

  it('the wooden exit door is seen from the east side of the top row, and it is far from the entry', () => {
    const s = run(...east);
    expect(s.seenDoors.has('out')).toBe(false);
    expect(run(...toExit).openDoors.has('out')).toBe(true);
  });

  it('the quest is won by going out through the wooden door', () => {
    const s = run(...toExit);
    expect(objectivesStatus(level, s).goalDone).toBe(false);
    expect(objectiveConfirms(level, s).map((c) => c.objective)).toEqual(['o1']);
    const done = reduce(level, s, { type: 'CONFIRM_OBJECTIVE', objective: 'o1' }).state;
    expect(objectivesStatus(level, done).goalDone).toBe(true);
    const end = reduce(level, done, { type: 'END_QUEST', outcome: 'stairs' }).state;
    expect(end.ended?.outcome).toBe('stairs');
  });

  it('the exit button is not offered before the door is open', () => {
    const s = run(...east);
    expect(objectiveConfirms(level, s)).toEqual([]);
    expect(objectivesStatus(level, s).goalDone).toBe(false);
  });
});
