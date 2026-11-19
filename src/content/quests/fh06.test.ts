/** Walk-through of Frozen Horror quest 6, The Frosted Path (group quest). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { board } from '../../engine/board/board';
import { buildLevel } from '../../engine/board/level';
import { applyCoreFile, parseCoreFile } from '../../engine/data/coreFile';
import type { GameEvent } from '../../engine/game/events';
import { lookHintCells } from '../../engine/game/hints';
import { reduce, replay, startGame } from '../../engine/game/reducer';
import { newRuleHints } from '../../engine/game/ruleHints';
import {
  boardTilesInView,
  monstersInPlay,
  objectivesStatus,
  trapsInView,
} from '../../engine/game/view';
import { parseQuest } from '../../engine/quest/loader';
import { validateQuest } from '../../engine/quest/validate';
import { ordersFor } from '../../engine/zargon/orders';

// The Frozen Horror abilities come from the Core library file.
applyCoreFile(
  parseCoreFile(
    JSON.parse(readFileSync(resolve(import.meta.dirname, '../library/frozen-horror.json'), 'utf8')),
  )!,
);

const quest = parseQuest(
  JSON.parse(readFileSync(resolve(import.meta.dirname, 'fh06-the-frosted-path.json'), 'utf8')),
);
const level = buildLevel(quest);
const open = (door: string): GameEvent => ({ type: 'OPEN_DOOR', door });
const run = (...events: GameEvent[]) => replay(level, 1, events);
const search = (room: string): GameEvent => ({
  type: 'SEARCH_TREASURE',
  room,
  hero: 'dwarf',
  override: true,
});
const fired = (s: ReturnType<typeof run>, id: string) => s.notesFired.includes(id);

// Walking: look along the corridors until a door is in sight (as the players do), then open it.
const lookUntilSeen = (base: GameEvent[], door: string): GameEvent[] => {
  const ev = [...base];
  for (let i = 0; i < 60; i++) {
    const s = run(...ev);
    if (s.seenDoors.has(door)) return ev;
    const next = lookHintCells(level, s)[0];
    if (!next) break;
    ev.push({ type: 'LOOK_FROM', cell: next });
  }
  throw new Error(`door ${door} never seen`);
};
const reach = (base: GameEvent[], door: string): GameEvent[] => [
  ...lookUntilSeen(base, door),
  open(door),
];

// The east half joins the west half only through three rooms: the corridor north of the center,
// the dread warriors' room R03, R08 and the weapons room R02, whose door d2 opens on the top
// corridor. The rooms then run in a chain to the ice ledge, whose door d15 opens on the bottom
// corridor. The exit door in the top left corner is reached up the left corridor, because blocks
// close the top corridor (1,0) and the middle one (1,9).
const toR03 = reach([open('in')], 'd3');
const toR08 = [...toR03, open('d6')];
const toR02 = [...toR08, open('d5')];
const toTop = [...toR02, open('d2')];
const toR01 = reach(toTop, 'd1');
const toR07 = [...toR01, open('d4')];
const toCloset = [...toR07, open('d7')];
const toR12 = [...toCloset, open('d8')];
const toR20 = [...toR12, open('d9')];
const toR17 = [...toR20, open('d10')];
const toR13 = [...toR17, open('d12')];
const toR14 = [...toR13, open('d11')];
const toLedge = [...toR17, open('d14')];
const toR19 = reach([open('in')], 'd16');
const toBottom = [...toLedge, open('d15')];
const toGremlins = [...toR19, open('d17')];

describe('quest 6: data', () => {
  it('is valid against the board', () => {
    expect(validateQuest(quest, board)).toEqual([]);
  });

  it('has the map: 18 doors, 5 blocks, 9 furniture pieces, 42 monsters', () => {
    expect(quest.number).toBe(6);
    expect(quest.pack).toBe('frozen-horror');
    expect(quest.doors).toHaveLength(18);
    expect(quest.blocks).toHaveLength(5);
    expect(quest.furniture.map((f) => f.type).sort()).toEqual(
      [
        'chest',
        'chest',
        'weaponsRack',
        'bookcase',
        'tomb',
        'table',
        'rack',
        'sorcerersTable',
        'fireplace',
      ].sort(),
    );
    expect(quest.monsters).toHaveLength(42);
    const kinds = quest.traps.map((t) => t.kind);
    expect(kinds.filter((k) => k === 'spear')).toHaveLength(6);
    expect(kinds.filter((k) => k === 'pit')).toHaveLength(1);
    expect(kinds.filter((k) => k === 'wanderingTrap')).toHaveLength(3);
    expect(kinds.filter((k) => k === 'slipperyIce')).toHaveLength(6);
    expect(kinds.filter((k) => k === 'iceSlide')).toHaveLength(1);
    expect(kinds.filter((k) => k === 'chest')).toHaveLength(1);
  });

  it('has an iron entry in the top right corner and a wooden exit in the top left corner', () => {
    expect(quest.edgeDoors).toEqual([
      { id: 'in', cell: [25, 0], side: 'e', kind: 'ironEntry' },
      { id: 'out', cell: [0, 0], side: 'w', kind: 'woodenExit' },
    ]);
  });

  it('every letter on the map has a note', () => {
    for (const l of ['A', 'B', 'C', 'D', 'E', 'F', 'G'])
      expect(
        quest.notes.some((n) => n.letter === l),
        `note ${l}`,
      ).toBe(true);
  });

  it('every tile is listed: the ice vault, the gremlin treasure room and the ice ledge', () => {
    expect(quest.roomTiles).toEqual([
      { type: 'iceVault', area: 'R14' },
      { type: 'gremlinTreasure', area: 'R21' },
    ]);
    expect(quest.boardTiles.map((t) => t.type)).toEqual(['iceLedge']);
    expect(quest.boardTiles[0]?.cells).toHaveLength(15);
  });

  it('the rock rooms, and nothing else, are rock', () => {
    expect(level.rock.has('15,3')).toBe(true); // R04
    expect(level.rock.has('12,9')).toBe(true); // the center room R11
    expect(level.rock.has('19,15')).toBe(false); // the gremlin treasure room is playable
    expect(level.rock.has('20,9')).toBe(false); // the ice slide corridor
    expect(level.rock.size).toBe(
      board.cells.flat().filter((a) => quest.rock.rooms.includes(a)).length,
    );
  });
});

describe('quest 6: the start and the way in', () => {
  it('the heroes stand outside the iron door and see only that door', () => {
    const { state } = startGame(level, 1);
    expect([...state.seenDoors]).toEqual(['in']);
    expect(state.seenCells.size).toBe(0);
    expect(fired(state, 'n-start')).toBe(true);
  });

  it('opening it shows the top corridor, up to the double block, and the way down', () => {
    const s = run(open('in'));
    for (const x of [24, 20, 14]) expect(s.seenCells.has(`${x},0`)).toBe(true);
    expect(s.seenBlocks.size).toBeGreaterThan(0);
    expect(s.seenCells.has('25,5')).toBe(true);
    expect(s.seenMonsters.size).toBe(0);
  });

  it('the three wandering monster traps, the slide and the spears show as "?" once their square is seen', () => {
    const s = run(...reach([open('in')], 'd3'));
    const ids = trapsInView(level, s).map((t) => t.id);
    expect(ids).toEqual(
      expect.arrayContaining(['t-wander-3', 't-slide', 't-spear-4', 't-spear-5', 't-spear-6']),
    );
    expect(ids).toContain('t-ice-1');
    expect(ids).toContain('t-ice-2');
    expect(trapsInView(level, s).find((t) => t.id === 't-slide')?.path).toBeUndefined();
  });

  it('a wandering monster trap brings 2 Dread warriors, once', () => {
    const s = run(...reach([open('in')], 'd3'));
    const r = reduce(level, s, { type: 'TRAP_STEP', trap: 't-wander-3' });
    const p = r.prompts.find((x) => x.kind === 'trapSprung');
    expect(p).toMatchObject({ trapKind: 'wanderingTrap' });
    expect(p && 'spawned' in p ? p.spawned : []).toEqual([
      { monster: 'w1', monsterType: 'dreadWarrior' },
      { monster: 'w2', monsterType: 'dreadWarrior' },
    ]);
    const v = monstersInPlay(level, r.state).filter((m) => m.id.startsWith('w'));
    expect(v.map((m) => m.name)).toEqual(['Dread Warrior', 'Dread Warrior']);
    expect(() => reduce(level, r.state, { type: 'TRAP_STEP', trap: 't-wander-3' })).toThrow();
  });

  it('the ice slide shows its whole path when it springs, from (24,9) to (17,9)', () => {
    const s = run(...reach([open('in')], 'd3'));
    const r = reduce(level, s, { type: 'TRAP_STEP', trap: 't-slide' });
    const v = trapsInView(level, r.state).find((t) => t.id === 't-slide')!;
    expect(v.path?.[0]).toEqual([24, 9]);
    expect(v.path?.at(-1)).toEqual([17, 9]);
    expect(v.path).toHaveLength(8);
    // it stays for the next hero
    expect(trapsInView(level, r.state).find((t) => t.id === 't-slide')?.state).toBe('sprung');
  });
});

describe('quest 6: the rooms of the north', () => {
  it('R03: two Dread warriors and a bookcase, and the door on to R08', () => {
    const s = run(...toR03);
    expect(s.seenMonsters.has('m-dread-r3a') && s.seenMonsters.has('m-dread-r3b')).toBe(true);
    expect(s.seenFurniture.has('f-bookcase')).toBe(true);
    expect(s.seenDoors.has('d6')).toBe(true);
    const by = monstersInPlay(level, s).find((m) => m.id === 'm-dread-r3a')!;
    expect(by.name).toBe('Dread Warrior');
    expect(by.pictureType).toBe('dreadWarrior');
  });

  it('R08: a table and the pit behind the door, the way on to R02', () => {
    const s = run(...toR08);
    expect(s.seenFurniture.has('f-table')).toBe(true);
    expect(trapsInView(level, s).map((t) => t.id)).toContain('t-pit');
    expect(s.seenDoors.has('d5')).toBe(true);
    expect(s.seenMonsters.size).toBe(2); // only the R03 pair so far
  });

  it('B: the weapons room holds two Orcs, an Abomination and plate mail', () => {
    const s = run(...toR02);
    for (const id of ['m-orc-b1', 'm-orc-b2', 'm-abom-b'])
      expect(s.seenMonsters.has(id)).toBe(true);
    expect(s.seenFurniture.has('f-rack-b')).toBe(true);
    expect(trapsInView(level, s).map((t) => t.id)).toContain('t-spear-3');
    expect(fired(s, 'n-B')).toBe(false);
    expect(fired(run(...toR02, search('R02')), 'n-B')).toBe(true);
  });

  it('opening door d2 shows the three skeletons and the spear trap in the top corridor', () => {
    const s = run(...toTop);
    for (const id of ['m-skel-1', 'm-skel-2', 'm-skel-3'])
      expect(s.seenMonsters.has(id)).toBe(true);
    expect(trapsInView(level, s).map((t) => t.id)).toContain('t-spear-1');
  });

  it('the top corridor is shut off from the exit corner by a block, so the exit door is not in sight', () => {
    const s = run(...toTop);
    expect(s.seenDoors.has('out')).toBe(false);
    expect(() => lookUntilSeen(toTop, 'out')).toThrow(/never seen/);
  });

  it('C: a chest in the first room, with gold and a potion', () => {
    const s = run(...toR01);
    expect(s.seenFurniture.has('f-chest-c')).toBe(true);
    expect(trapsInView(level, s).map((t) => t.id)).toContain('t-spear-2');
    expect(fired(run(...toR01, search('R01')), 'n-C')).toBe(true);
  });

  it('D: five soldiers of Zargon, a tomb and a crossbow with a gem', () => {
    const s = run(...toR07);
    const view = monstersInPlay(level, s);
    const names = view.filter(
      (m) => m.id.startsWith('m-sword') || m.id.startsWith('m-xbow') || m.id === 'm-halb',
    );
    expect(names.map((m) => m.name).sort()).toEqual([
      'Crossbowman',
      'Crossbowman',
      'Halberdier',
      'Swordsman',
      'Swordsman',
    ]);
    expect(names.every((m) => m.box === 'Frozen Horror' && m.pictureType === undefined)).toBe(true);
    expect(s.seenFurniture.has('f-tomb')).toBe(true);
    expect(fired(run(...toR07, search('R07')), 'n-D')).toBe(true);
  });

  it('the two doors of the closet lead from D to the zombies and mummies of R12', () => {
    const s = run(...toR12);
    for (const id of ['m-zomb-1', 'm-mum-1', 'm-mum-2', 'm-zomb-2', 'm-dread-r12'])
      expect(s.seenMonsters.has(id)).toBe(true);
    expect(s.seenDoors.has('d9')).toBe(true);
  });
});

describe('quest 6: the rooms of the south', () => {
  it('E: the sorcerer table room has dread warriors, an Abomination and 2 scrolls to find', () => {
    const s = run(...toR20);
    for (const id of ['m-dread-e1', 'm-dread-e2', 'm-abom-e'])
      expect(s.seenMonsters.has(id)).toBe(true);
    expect(s.seenFurniture.has('f-sorc')).toBe(true);
    expect(fired(run(...toR20, search('R20')), 'n-E')).toBe(true);
  });

  it('the rack room holds a Gargoyle and two Orcs, and the polar warbears sit in R13', () => {
    const s = run(...toR17);
    expect(s.seenMonsters.has('m-garg')).toBe(true);
    expect(s.seenFurniture.has('f-rack')).toBe(true);
    const r13 = run(...toR13);
    const bears = monstersInPlay(level, r13).filter((m) => m.id.startsWith('m-bear'));
    expect(bears.map((m) => m.name)).toEqual(['Polar Warbear', 'Polar Warbear']);
    expect(bears.every((m) => m.pictureType === undefined)).toBe(true);
  });

  it('F: the ice vault shows its tile rule, and the chest is empty with a gas trap on it', () => {
    const before = run(...toR13);
    const s = run(...toR14);
    expect(newRuleHints(level, before, s).map((h) => h.name)).toContain('Ice Vault');
    expect(s.seenFurniture.has('f-chest-f')).toBe(true);
    expect(quest.traps.find((t) => t.id === 't-gas')).toMatchObject({
      kind: 'chest',
      furniture: 'f-chest-f',
    });
    expect(fired(run(...toR14, search('R14')), 'n-F')).toBe(true);
  });

  it('G: the ice ledge room, with the ledge tile drawn once it is seen', () => {
    const before = run(...toR17);
    expect(boardTilesInView(level, before)).toHaveLength(0);
    const s = run(...toLedge);
    expect(fired(s, 'n-G')).toBe(true);
    expect(boardTilesInView(level, s).map((t) => t.type)).toEqual(['iceLedge']);
    expect(newRuleHints(level, before, s).map((h) => h.name)).toContain('Ice ledge');
    for (const id of ['m-gob-g', 'm-abom-g', 'm-orc-g']) expect(s.seenMonsters.has(id)).toBe(true);
    expect(s.seenDoors.has('d15')).toBe(true);
  });

  it('A: the gremlin treasure room is behind R19, which holds eight soldiers of Dread and two Gremlins', () => {
    const r19 = run(...toR19);
    const inRoom = monstersInPlay(level, r19);
    expect(inRoom).toHaveLength(8);
    expect(inRoom.filter((m) => m.name === 'Ice Gremlin')).toHaveLength(2);
    expect(r19.seenFurniture.has('f-fire')).toBe(true);
    expect(r19.revealedRooms.has('R21')).toBe(false);
    const s = run(...toGremlins);
    expect(s.revealedRooms.has('R21')).toBe(true);
    const before = run(...toR19);
    expect(newRuleHints(level, before, s).map((h) => h.name)).toContain(
      'Ice Gremlin Treasure Room',
    );
    expect(fired(run(...toGremlins, search('R21')), 'n-A')).toBe(true);
  });

  it('Frozen Horror monsters know their box and have no core picture; core ones keep theirs', () => {
    const s = run(...toR19);
    const g = monstersInPlay(level, s).find((m) => m.name === 'Ice Gremlin')!;
    expect(g.box).toBe('Frozen Horror');
    expect(g.pictureType).toBeUndefined();
    expect(g.profile).toBe('thief');
    const orc = monstersInPlay(level, s).find((m) => m.id === 'm-orc-r19a')!;
    expect(orc.pictureType).toBe('orc');
  });

  it('the Yeti and the soldiers get Zargon orders', () => {
    const s = run(...toR07);
    const o = ordersFor(level, s, ['dwarf']);
    expect(o.find((x) => x.monster === 'm-xbow-1')?.profile).toBe('shooter');
    expect(o.find((x) => x.monster === 'm-halb')?.profile).toBe('fighter');
  });
});

describe('quest 6: leaving', () => {
  it('the exit door in the top left corner is seen from the left corridor, up from the bottom one', () => {
    const s = run(...lookUntilSeen(toBottom, 'out'));
    expect(s.seenDoors.has('out')).toBe(true);
    for (const id of ['m-gremlin-w1', 'm-gremlin-w2', 'm-gremlin-w3'])
      expect(s.seenMonsters.has(id)).toBe(true);
    expect(trapsInView(level, s).map((t) => t.id)).toContain('t-wander-1');
    expect(trapsInView(level, s).map((t) => t.id)).toContain('t-ice-5');
  });

  it('leaving through the wooden door needs the goal, then ends the quest', () => {
    const s = run(...lookUntilSeen(toBottom, 'out'));
    expect(objectivesStatus(level, s).goalDone).toBe(false);
    const done = reduce(level, s, { type: 'CONFIRM_OBJECTIVE', objective: 'o1' }).state;
    expect(objectivesStatus(level, done).goalDone).toBe(true);
    const end = reduce(level, done, { type: 'END_QUEST', outcome: 'stairs' }).state;
    expect(end.ended?.outcome).toBe('stairs');
  });

  it('there are two wandering Dread warriors', () => {
    expect(quest.wandering).toEqual({ monster: 'dreadWarrior', count: 2 });
  });
});
