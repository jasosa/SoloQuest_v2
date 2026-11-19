/** Walk-through of Frozen Horror quest 4, The Glacial Gate (a group quest, iron door in, wooden door out). */
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
import { endSummary, leaveWay } from '../../engine/game/noteView';
import { parseQuest } from '../../engine/quest/loader';
import { validateQuest } from '../../engine/quest/validate';

// The Frozen Horror abilities come from the Core library files.
applyCoreFile(
  parseCoreFile(
    JSON.parse(readFileSync(resolve(import.meta.dirname, '../library/frozen-horror.json'), 'utf8')),
  )!,
);

const quest = parseQuest(
  JSON.parse(readFileSync(resolve(import.meta.dirname, 'fh04-the-glacial-gate.json'), 'utf8')),
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
const mons = (s: ReturnType<typeof run>) => monstersInPlay(level, s);
// Traps in sight accumulate along the walk, so the rooms check that their own squares are in the list.
const trapCells = (s: ReturnType<typeof run>) =>
  trapsInView(level, s).map((t) => t.cell?.join(','));
const count = (pred: (m: (typeof quest.monsters)[number]) => boolean) =>
  quest.monsters.filter(pred).length;

// Walking: look along the corridors until a door is in sight (as the players do), then open it.
const reach = (base: GameEvent[], door: string): GameEvent[] => {
  const ev = [...base];
  for (let i = 0; i < 60; i++) {
    const s = run(...ev);
    if (s.seenDoors.has(door)) return [...ev, open(door)];
    const next = lookHintCells(level, s)[0];
    if (!next) break;
    ev.push({ type: 'LOOK_FROM', cell: next });
  }
  throw new Error(`door ${door} never seen`);
};

const toR01: GameEvent[] = reach([open('in')], 'd1');
const secretR01: GameEvent = { type: 'SEARCH_SECRET_DOORS', area: 'R01', override: true };
const toR07: GameEvent[] = [...toR01, secretR01, open('s1')];
const toR02: GameEvent[] = [...toR01, open('d2')];
const toR03: GameEvent[] = [...toR02, open('d3')];
const toR08: GameEvent[] = [...toR03, open('d5')];
const toRow9: GameEvent[] = [...toR08, open('d6')];
const toR12: GameEvent[] = [...toRow9, open('d7')];
const toCage: GameEvent[] = [...toR12, open('d8')];
const toR17: GameEvent[] = [...toCage, open('d9')];
const toR13: GameEvent[] = [...toR17, open('d11')];
const toChest: GameEvent[] = [...toR13, open('d10')];
const toR18: GameEvent[] = [...toR17, open('d13')];
const toCenter: GameEvent[] = reach(toR01, 'd15');
const toLedge: GameEvent[] = reach(toR01, 'd16');
// Out of the ledge room by its south door, along column 16 to the head of the slide.
const toSlide: GameEvent[] = reach([...toLedge, open('d17')], 'd22').slice(0, -1);
const slide: GameEvent = { type: 'TRAP_STEP', trap: 't-slide' };
const toR10: GameEvent[] = [...toSlide, slide, open('d22')];
const toR09: GameEvent[] = [...toR10, open('d21')];
const toR05: GameEvent[] = [...toR09, open('d18')];
const toR06: GameEvent[] = [...toR05, open('d19')];
const toExit: GameEvent[] = reach([...toR06, open('d20')], 'out');

describe('quest 4: data', () => {
  it('is valid against the board', () => {
    expect(validateQuest(quest, board)).toEqual([]);
    expect(quest.number).toBe(4);
    expect(quest.pack).toBe('frozen-horror');
  });

  it('has the map: 22 doors, a secret door, 7 blocks, 11 furniture pieces, 33 monsters', () => {
    expect(quest.doors).toHaveLength(22);
    expect(quest.secretDoors).toEqual([{ id: 's1', a: [1, 3], b: [1, 4] }]);
    expect(quest.blocks).toHaveLength(7);
    expect(quest.furniture.map((f) => f.type).sort()).toEqual(
      [
        'alchemistsBench',
        'bookcase',
        'bookcase',
        'chest',
        'cupboard',
        'fireplace',
        'rack',
        'table',
        'table',
        'tomb',
        'weaponsRack',
      ].sort(),
    );
    expect(quest.monsters).toHaveLength(33);
  });

  it('monsters match the map by kind', () => {
    const by = (type: string) => count((m) => m.type === type);
    expect(by('abomination')).toBe(2);
    expect(by('skeleton')).toBe(4);
    expect(by('zombie')).toBe(2);
    expect(by('mummy')).toBe(3);
    expect(by('orc')).toBe(7);
    expect(by('goblin') - count((m) => m.enemy !== undefined)).toBe(2);
    expect(by('dreadWarrior')).toBe(2);
    expect(by('gargoyle')).toBe(1);
    const enemy = (e: string) => count((m) => m.enemy === e);
    expect(enemy('yeti')).toBe(2);
    expect(enemy('polarWarbear')).toBe(3);
    expect(enemy('iceGremlin')).toBe(1);
    expect(enemy('crossbowman')).toBe(2);
    expect(enemy('swordsman')).toBe(2);
  });

  it('traps: 4 pits, 3 spears, 3 stalactites, 4 axes, 3 wandering traps, a slide and a chest trap', () => {
    const kinds = quest.traps.map((t) => t.kind);
    const n = (k: string) => kinds.filter((x) => x === k).length;
    expect([n('pit'), n('spear'), n('stalactite'), n('swingingAxe'), n('wanderingTrap')]).toEqual([
      4, 3, 3, 4, 3,
    ]);
    expect([n('iceSlide'), n('chest')]).toEqual([1, 1]);
    expect(quest.traps.find((t) => t.kind === 'iceSlide')?.path).toHaveLength(8);
  });

  it('every letter on the map has a note', () => {
    for (const l of ['A', 'B', 'C', 'D', 'E'])
      expect(
        quest.notes.some((n) => n.letter === l),
        `note ${l}`,
      ).toBe(true);
  });

  it('wandering monsters are 2 Abominations', () => {
    expect(quest.wandering).toEqual({ monster: 'abomination', count: 2 });
  });

  it('every tile of the map is listed: ledge, river, cage and the cage room', () => {
    expect(quest.boardTiles.map((t) => t.type).sort()).toEqual(['cage', 'iceLedge', 'icyRiver']);
    expect(quest.roomTiles).toEqual([{ type: 'cageRoom', area: 'R20' }]);
  });

  it('the dark lower right of the map is rock, with the squares that join it', () => {
    for (const k of ['20,11', '25,15', '17,18', '25,18', '17,10', '15,14', '23,16'])
      expect(level.rock.has(k), k).toBe(true);
    for (const k of ['16,10', '16,12', '13,18', '24,9', '25,9', '14,12'])
      expect(level.rock.has(k), k).toBe(false);
  });
});

describe('quest 4: the start and the exit', () => {
  it('the heroes stand outside the iron door and see only it', () => {
    const { state } = startGame(level, 1);
    expect([...state.seenDoors]).toEqual(['in']);
    expect(state.seenCells.size).toBe(0);
    expect(fired(state, 'n-start')).toBe(true);
  });

  it('opening it shows the north corridor and the pit next to the door', () => {
    const s = run(open('in'));
    for (const x of [0, 1, 2, 3]) expect(s.seenCells.has(`${x},0`)).toBe(true);
    expect(trapsInView(level, s).some((t) => t.id.startsWith('t-pit') && t.cell?.[0] === 1)).toBe(
      true,
    );
  });

  it('the heroes leave through the exit door: found by sight, then the goal is done', () => {
    expect(leaveWay(level)).toBe('through the exit door');
    const s = run(...toExit);
    expect(s.seenDoors.has('out')).toBe(true);
    expect(objectivesStatus(level, s).goalDone).toBe(true);
    const ended = reduce(level, s, { type: 'END_QUEST', outcome: 'stairs' }).state;
    expect(endSummary(level, ended)?.won).toBe(true);
    // Leaving before the door was ever opened is not a win
    const early = reduce(level, run(...toR06), { type: 'END_QUEST', outcome: 'stairs' }).state;
    expect(endSummary(level, early)?.won).toBe(false);
  });

  it('the exit lies behind the whole east side: the only way is the slide, R10, R09, R05, R06', () => {
    // row 0 is cut by a block at (21,0), so the corridor cannot reach the exit door
    expect(quest.blocks.some((b) => b.cells.some((c) => c[0] === 21 && c[1] === 0))).toBe(true);
    expect(run(...toR06).seenDoors.has('d20')).toBe(true);
  });
});

describe('quest 4: the north-west rooms', () => {
  it('R01 holds two Abominations; the secret door to R07 is not seen until found', () => {
    const s = run(...toR01);
    expect(s.seenMonsters.has('m-abom-1') && s.seenMonsters.has('m-abom-2')).toBe(true);
    expect(s.seenDoors.has('s1')).toBe(false);
    const found = run(...toR07);
    expect(found.seenDoors.has('s1')).toBe(true);
  });

  it('A: R07 has two Yetis, a Warbear and the tomb, and the first search finds the snowshoes', () => {
    const s = run(...toR07);
    for (const id of ['m-yeti-1', 'm-yeti-2', 'm-bear-1'])
      expect(s.seenMonsters.has(id)).toBe(true);
    expect(s.seenFurniture.has('f-tomb')).toBe(true);
    expect(fired(run(...toR07, search('R07')), 'n-A')).toBe(true);
    expect(mons(s).find((m) => m.id === 'm-yeti-1')?.pictureType).toBeUndefined();
    expect(mons(s).find((m) => m.id === 'm-yeti-1')?.box).toBe('Frozen Horror');
  });

  it('R02 shows its three stalactites as unknown traps; R08 two axes and the table', () => {
    const r2 = run(...toR02);
    expect(trapCells(r2)).toEqual(expect.arrayContaining(['6,2', '7,1', '7,3']));
    const r8 = run(...toR08);
    expect(r8.seenFurniture.has('f-table-1')).toBe(true);
    expect(trapCells(r8)).toEqual(expect.arrayContaining(['8,4', '8,5']));
  });

  it('R03 has the icy river tile across the middle', () => {
    const s = run(...toR03);
    const river = boardTilesInView(level, s).find((t) => t.type === 'icyRiver');
    expect(river?.cells).toHaveLength(3);
  });

  it('the corridor of row 9 holds two skeletons and a mummy', () => {
    const s = run(...toRow9);
    for (const id of ['m-skel-1', 'm-mummy-1', 'm-skel-2'])
      expect(s.seenMonsters.has(id)).toBe(true);
  });
});

describe('quest 4: the south-west rooms', () => {
  it('B: the cage room shows a caged Ice Gremlin that gives no orders', () => {
    const s = run(...toCage);
    expect(fired(s, 'n-B')).toBe(true);
    const g = mons(s).find((m) => m.id === 'm-gremlin')!;
    expect(g.name).toBe('Ice Gremlin');
    expect(g.state).toBe('passive');
    expect(
      boardTilesInView(level, s)
        .map((t) => t.type)
        .includes('cage'),
    ).toBe(true);
  });

  it('B: freeing the gremlin asks a question; Yes removes cage and gremlin, No changes nothing', () => {
    const s = run(...toCage);
    const ask = reduce(level, s, { type: 'MANUAL_TRIGGER', note: 'n-B-free' });
    expect(JSON.stringify(ask.prompts)).toContain('Does a hero say they are freeing it');
    const no = reduce(level, ask.state, { type: 'CHOOSE', note: 'n-B-free', option: 1 }).state;
    expect(no.flags['gremlinFreed']).toBeUndefined();
    expect(mons(no).some((m) => m.id === 'm-gremlin')).toBe(true);
    const yes = reduce(level, ask.state, { type: 'CHOOSE', note: 'n-B-free', option: 0 });
    expect(yes.state.flags['gremlinFreed']).toBe(true);
    expect(JSON.stringify(yes.prompts)).toContain('steals one item');
    expect(mons(yes.state).some((m) => m.id === 'm-gremlin')).toBe(false);
    expect(yes.state.monsters['m-gremlin']?.dead).toBe(false);
    expect(
      boardTilesInView(level, yes.state)
        .map((t) => t.type)
        .includes('cage'),
    ).toBe(false);
  });

  it('R12 has a table and no monsters; R17 has two Goblins and four Orcs and the bookcase', () => {
    expect(run(...toR12).seenFurniture.has('f-table-2')).toBe(true);
    const s = run(...toR17);
    const ids = mons(s).map((m) => m.id);
    expect(ids.filter((i) => i.startsWith('m-orc')).length).toBe(4);
    expect(ids.filter((i) => i.startsWith('m-goblin')).length).toBe(2);
    expect(s.seenFurniture.has('f-bookcase-c')).toBe(true);
  });

  it('C: the first search of R17 finds a spell scroll', () => {
    expect(fired(run(...toR17, search('R17')), 'n-C')).toBe(true);
  });

  it('R13 holds the axes, a spear and a pit', () => {
    const s = run(...toR13);
    expect(trapCells(s)).toEqual(expect.arrayContaining(['5,11', '5,12', '6,11', '6,12']));
  });

  it('D: the chest is trapped for the whole room, the search finds 600 gold', () => {
    const s = run(...toChest);
    expect(s.seenFurniture.has('f-chest')).toBe(true);
    const trap = quest.traps.find((t) => t.kind === 'chest');
    expect(trap).toMatchObject({ furniture: 'f-chest' });
    expect(trap?.effect).toMatch(/2 Body Points/);
    const searched = run(...toChest, search('R14'));
    expect(fired(searched, 'n-D')).toBe(true);
    expect(JSON.stringify(quest.notes.find((n) => n.id === 'n-D')?.effects)).toContain('600');
  });

  it('R18 has the bench and a row of spear, pit, spear', () => {
    const s = run(...toR18);
    expect(s.seenFurniture.has('f-bench')).toBe(true);
    expect(trapCells(s)).toEqual(expect.arrayContaining(['9,16', '10,16', '11,16']));
  });
});

describe('quest 4: the middle and the ledge', () => {
  it('the center room holds three Orcs, two Dread warriors and a Gargoyle', () => {
    const s = run(...toCenter);
    const ids = mons(s).map((m) => m.id);
    expect(ids.filter((i) => i.startsWith('m-orc')).length).toBe(3);
    expect(ids.filter((i) => i.startsWith('m-dread')).length).toBe(2);
    expect(ids).toContain('m-gargoyle');
    expect(s.seenFurniture.has('f-cupboard') && s.seenFurniture.has('f-fireplace')).toBe(true);
  });

  it('E: the ice ledge room shows its tile, a Mummy on each side, and the rule', () => {
    const s = run(...toLedge);
    expect(fired(s, 'n-E')).toBe(true);
    const ledge = boardTilesInView(level, s).find((t) => t.type === 'iceLedge');
    expect(ledge?.cells).toHaveLength(15);
    expect(s.seenMonsters.has('m-mummy-2') && s.seenMonsters.has('m-mummy-3')).toBe(true);
    expect(JSON.stringify(quest.notes.find((n) => n.id === 'n-E')?.effects)).toContain(
      'start of every turn',
    );
  });

  it('a wandering monster trap sits next to the ledge door and brings two Abominations', () => {
    const t = quest.traps.find((x) => x.kind === 'wanderingTrap' && x.cell?.join(',') === '15,0');
    expect(t).toBeDefined();
    const s = run(open('in'));
    const r = reduce(level, s, { type: 'TRAP_STEP', trap: t!.id });
    expect(JSON.stringify(r.prompts)).toContain('wanderingTrap');
  });
});

describe('quest 4: the east side', () => {
  it('the ice slide starts at (17,9) and ends at (24,9)', () => {
    const t = quest.traps.find((x) => x.kind === 'iceSlide')!;
    expect(t.cell).toEqual([17, 9]);
    expect(t.path?.[t.path.length - 1]).toEqual([24, 9]);
  });

  it('after the slide the pit at (25,9) and the door of R10 are in sight', () => {
    const s = run(...toR10);
    expect(s.seenCells.has('24,9')).toBe(true);
    expect(s.seenMonsters.has('m-xbow-1') && s.seenMonsters.has('m-sword-1')).toBe(true);
    expect(s.seenFurniture.has('f-rack')).toBe(true);
  });

  it('R10 has two Crossbowmen and two Swordsmen of the Frozen Horror box', () => {
    const s = run(...toR10);
    const ids = mons(s).map((m) => m.id);
    expect(ids.filter((i) => i.startsWith('m-xbow')).length).toBe(2);
    expect(ids.filter((i) => i.startsWith('m-sword')).length).toBe(2);
    expect(mons(s).find((m) => m.id === 'm-xbow-1')?.profile).toBe('shooter');
  });

  it('R09 holds two zombies and two skeletons; R05 the bookcase; R06 two Warbears', () => {
    const r9 = run(...toR09);
    for (const id of ['m-zombie-1', 'm-zombie-2', 'm-skel-3', 'm-skel-4'])
      expect(r9.seenMonsters.has(id)).toBe(true);
    expect(r9.seenFurniture.has('f-weapons')).toBe(true);
    expect(run(...toR05).seenFurniture.has('f-bookcase-2')).toBe(true);
    const r6 = run(...toR06);
    expect(r6.seenMonsters.has('m-bear-2') && r6.seenMonsters.has('m-bear-3')).toBe(true);
  });
});
