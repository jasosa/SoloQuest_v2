/** Walk-through of Frozen Horror quest 7, The Halls of Kelvinos (group quest). */
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
  JSON.parse(readFileSync(resolve(import.meta.dirname, 'fh07-the-halls-of-kelvinos.json'), 'utf8')),
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
const mons = (s: ReturnType<typeof run>) => monstersInPlay(level, s);

// Walking: look along the corridors until the door is in sight (as the players do), then open it.
const reach = (base: GameEvent[], door: string, target?: [number, number]): GameEvent[] => {
  // Greedy walk: look from the suggested square nearest to the target until the door is in sight.
  const ev = [...base];
  const done = new Set<string>();
  const [tx, ty] = target ?? [0, 0];
  for (let i = 0; i < 80; i++) {
    const s = run(...ev);
    if (s.seenDoors.has(door)) return [...ev, open(door)];
    const cells = lookHintCells(level, s).filter((c) => !done.has(c.join(',')));
    if (target)
      cells.sort(
        (a, b) =>
          Math.abs(a[0] - tx) + Math.abs(a[1] - ty) - (Math.abs(b[0] - tx) + Math.abs(b[1] - ty)),
      );
    const next = cells[0];
    if (!next) break;
    done.add(next.join(','));
    ev.push({ type: 'LOOK_FROM', cell: next });
  }
  throw new Error(`door ${door} never seen`);
};

const inside: GameEvent[] = [open('in')];
const toR07 = reach(inside, 'd2'); // west corridor, door into R07
const toR01 = [...toR07, open('d1')]; // R07 door into R01
const toR12 = reach(inside, 'd3');
const toR13 = reach(inside, 'd4');
const toR14 = [...toR13, open('d6')];
const toCenter = reach(inside, 'd5');
const toR18 = reach(inside, 'd11');
// The south east corridor (with the wooden exit) is cut off by the blocks at (14,18) and (25,9):
// the only way is the gauntlet R15, the fog room, R22, R21, R19 and then door d21.
const toR15 = reach(inside, 'd17', [20, 9]);
const toFog = [...toR15, open('d18')];
const toR22 = [...toFog, open('d20')];
const toR21 = [...toR22, open('d19')];
const toR19 = [...toR21, open('d22')];
const toExit = reach([...toR19, open('d21')], 'out', [25, 18]);

describe('quest 7: data', () => {
  it('is valid against the board', () => {
    expect(validateQuest(quest, board)).toEqual([]);
    expect(quest.number).toBe(7);
    expect(quest.pack).toBe('frozen-horror');
  });

  it('has the map of the book: doors, secret doors, blocks, furniture, traps', () => {
    expect(quest.edgeDoors.map((e) => e.kind).sort()).toEqual(['ironEntry', 'woodenExit']);
    expect(quest.doors).toHaveLength(22);
    expect(quest.secretDoors).toHaveLength(2);
    expect(quest.blocks).toHaveLength(4);
    expect(quest.furniture).toHaveLength(9);
    expect(quest.monsters).toHaveLength(58);
    const kinds = quest.traps.map((t) => t.kind);
    expect(kinds.filter((k) => k === 'slipperyIce')).toHaveLength(10);
    expect(kinds.filter((k) => k === 'wanderingTrap')).toHaveLength(3);
    expect(kinds.filter((k) => k === 'swingingAxe')).toHaveLength(6);
    expect(kinds.filter((k) => k === 'stalactite')).toHaveLength(3);
    expect(kinds.filter((k) => k === 'pit')).toHaveLength(1);
    expect(quest.rock.rooms.sort()).toEqual(['R03', 'R08', 'R09', 'R10']);
  });

  it('every letter on the map has a note, and the two tiles are listed', () => {
    for (const l of ['A', 'B', 'C', 'D'])
      expect(
        quest.notes.some((n) => n.letter === l),
        `note ${l}`,
      ).toBe(true);
    expect(quest.roomTiles.map((t) => `${t.type}:${t.area}`).sort()).toEqual([
      'iceVault:R02',
      'livingFog:R16',
    ]);
    expect(quest.boardTiles.map((t) => t.type)).toEqual(['icyRiver']);
  });
});

describe('quest 7: the start and the west side', () => {
  it('the heroes stand outside the iron door and see only that door', () => {
    const { state } = startGame(level, 1);
    expect([...state.seenDoors]).toEqual(['in']);
    expect(state.seenCells.size).toBe(0);
  });

  it('opening it shows the corridor and its doors', () => {
    const s = run(...inside);
    expect(s.seenCells.has('0,9')).toBe(true);
    expect(s.seenCells.has('1,9')).toBe(true);
    expect(s.seenDoors.has('d3')).toBe(true);
  });

  it('R07: three orcs, two goblins and two Ice Gremlins that keep their own kind', () => {
    const s = run(...toR07);
    const ids = quest.monsters
      .filter((m) => m.cell !== undefined && m.cell[0] <= 4 && m.cell[1]! >= 4 && m.cell[1]! <= 7)
      .map((m) => m.id);
    const list = mons(s).filter((m) => ids.includes(m.id));
    expect(list).toHaveLength(7);
    const gremlin = list.find((m) => m.id === 'm-gremlin-1')!;
    expect(gremlin.name).toBe('Ice Gremlin');
    expect(gremlin.box).toBe('Frozen Horror');
    expect(gremlin.pictureType).toBeUndefined();
    const orc = list.find((m) => m.id === 'm-orc-1')!;
    expect(orc.pictureType ?? orc.type).toBe('orc');
    expect(s.seenFurniture.has('f-sorc')).toBe(true);
  });

  it('R12 has two mummies and the rack, R13 and R14 are one fight after door d6', () => {
    const s12 = run(...toR12);
    expect(s12.seenMonsters.has('m-mummy-1') && s12.seenMonsters.has('m-mummy-2')).toBe(true);
    expect(s12.seenFurniture.has('f-rack')).toBe(true);
    const s14 = run(...toR14);
    for (const id of ['m-goblin-3', 'm-orc-5', 'm-abom-1', 'm-abom-2'])
      expect(s14.seenMonsters.has(id), id).toBe(true);
  });
});

describe('quest 7: A, the ice vault behind a secret door', () => {
  it('the vault shows its tile, and a secret door search from R01 finds the way in', () => {
    const s = run(...toR01);
    expect(s.seenMonsters.has('m-dw-1')).toBe(true);
    expect(s.seenDoors.has('s1')).toBe(false);
    const found = reduce(level, s, { type: 'SEARCH_SECRET_DOORS', area: 'R01', override: true });
    expect(found.state.seenDoors.has('s1')).toBe(true);
  });

  it('inside, two Yeti guard a chest of 500 gold coins (note A, no card)', () => {
    const s = run(
      ...toR01,
      { type: 'SEARCH_SECRET_DOORS', area: 'R01', override: true },
      open('s1'),
    );
    expect(s.seenMonsters.has('m-yeti-1') && s.seenMonsters.has('m-yeti-2')).toBe(true);
    expect(s.seenFurniture.has('f-chest-a')).toBe(true);
    const yeti = mons(s).find((m) => m.id === 'm-yeti-1')!;
    expect(yeti.name).toBe('Yeti');
    expect(yeti.box).toBe('Frozen Horror');
    expect(
      fired(
        run(
          ...toR01,
          { type: 'SEARCH_SECRET_DOORS', area: 'R01', override: true },
          open('s1'),
          search('R02'),
        ),
        'n-A',
      ),
    ).toBe(true);
  });
});

describe('quest 7: B, the potions and the icy river', () => {
  it('R18 shows the river tile, gremlins, a Warbear and a Yeti; the first search gives the potions', () => {
    const s = run(...toR18);
    expect(boardTilesInView(level, s).map((t) => t.type)).toContain('icyRiver');
    for (const id of ['m-gremlin-3', 'm-gremlin-4', 'm-bear-1', 'm-yeti-3'])
      expect(s.seenMonsters.has(id), id).toBe(true);
    expect(fired(s, 'n-B')).toBe(false);
    expect(fired(run(...toR18, search('R18')), 'n-B')).toBe(true);
  });
});

describe('quest 7: C, Kelvinos and the Amulet of the North', () => {
  it('Kelvinos is a fighter of his own with the stats of the book', () => {
    const s = run(...toR19);
    expect(fired(s, 'n-C')).toBe(true);
    const kel = mons(s).find((m) => m.id === 'm-kel')!;
    expect(kel.name).toBe('Kelvinos');
    expect(quest.monsters.find((m) => m.id === 'm-kel')?.cell).toEqual([14, 14]);
    expect(kel.stats).toMatchObject({ move: 5, att: 4, def: 4, body: 4, mind: 0 });
    expect(kel.pictureType).toBeUndefined();
    const order = ordersFor(level, s, ['dwarf']).find((o) => o.monster === 'm-kel')!;
    expect(order.profile).toBe('fighter');
  });

  it('the room also holds dread warriors, a gargoyle, a Yeti, orcs and a Warbear', () => {
    const s = run(...toR19);
    for (const id of ['m-dw-4', 'm-dw-5', 'm-garg-2', 'm-yeti-5', 'm-orc-6', 'm-orc-7', 'm-bear-4'])
      expect(s.seenMonsters.has(id), id).toBe(true);
  });

  it('the first search finds the Amulet of the North', () => {
    expect(fired(run(...toR19), 'n-C-search')).toBe(false);
    expect(fired(run(...toR19, search('R19')), 'n-C-search')).toBe(true);
  });
});

describe('quest 7: the center room', () => {
  it('has two crossbowmen, a gargoyle, two dread warriors and slippery ice', () => {
    const s = run(...toCenter);
    for (const id of ['m-xbow-1', 'm-xbow-2', 'm-garg-1', 'm-dw-2', 'm-dw-3'])
      expect(s.seenMonsters.has(id), id).toBe(true);
    const xb = mons(s).find((m) => m.id === 'm-xbow-1')!;
    expect(xb.name).toBe('Crossbowman');
    expect(xb.box).toBe('Frozen Horror');
    expect(trapsInView(level, s).filter((t) => t.id.startsWith('t-ice-')).length).toBe(6);
    expect(ordersFor(level, s, ['dwarf']).find((o) => o.monster === 'm-xbow-1')?.profile).toBe(
      'shooter',
    );
  });
});

describe('quest 7: D, the living fog room', () => {
  it('R15 is a goblin pit with a pit trap at the door; the fog room has its tile and its rule', () => {
    const r15 = run(...toR15);
    expect(mons(r15).filter((m) => m.id.startsWith('m-goblin-r15'))).toHaveLength(6);
    expect(trapsInView(level, r15).some((t) => t.id === 't-pit-1')).toBe(true);
    const s = run(...toFog);
    expect(fired(s, 'n-D')).toBe(true);
    for (const id of ['m-gremlin-5', 'm-gremlin-6', 'm-yeti-4', 'm-bear-3'])
      expect(s.seenMonsters.has(id), id).toBe(true);
    const tile = quest.roomTiles.find((t) => t.area === 'R16');
    expect(tile?.type).toBe('livingFog');
  });
});

describe('quest 7: traps and wandering monsters', () => {
  it('a wandering monster is a Yeti with the Yeti stats and its hug rule', () => {
    const lvl = buildLevel(quest);
    const s = replay(lvl, 1, toR07);
    const r = reduce(lvl, s, { type: 'WANDERING_MONSTER', room: 'R07', hero: 'dwarf' });
    const v = monstersInPlay(lvl, r.state).find((m) => m.id === 'w1')!;
    expect(v.name).toBe('Yeti');
    expect(v.stats.body).toBe(5);
    expect(quest.wandering).toMatchObject({ enemy: 'yeti', count: 2 });
  });

  it('a wandering monster trap springs with its kind named', () => {
    const along = reach(inside, 'd12', [15, 0]);
    const r = reduce(level, run(...along), { type: 'TRAP_STEP', trap: 't-wander-1' });
    expect(JSON.stringify(r.prompts)).toContain('wanderingTrap');
  });
});

describe('quest 7: the end', () => {
  it('the exit door is cut off by the blocks: it is not in sight until the heroes come through the fog room and room C', () => {
    expect(run(...toR21).seenDoors.has('out')).toBe(false);
    expect(run(...toR19).seenDoors.has('out')).toBe(false);
    expect(run(...toExit).seenDoors.has('out')).toBe(true);
  });

  it('the goal is done when the wooden exit door is opened, and the heroes leave', () => {
    const before = run(...inside);
    expect(objectivesStatus(level, before).goalDone).toBe(false);
    const s = run(...toExit);
    expect(s.openDoors.has('out')).toBe(true);
    expect(objectivesStatus(level, s).goalDone).toBe(true);
    const ended = reduce(level, s, { type: 'END_QUEST', outcome: 'stairs' }).state;
    expect(ended.ended?.outcome).toBe('stairs');
  });
});
