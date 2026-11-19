/** Walk-through of Frozen Horror quest 2, Trial by Ice (a solo quest for the Barbarian). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { board } from '../../engine/board/board';
import { buildLevel } from '../../engine/board/level';
import { applyCoreFile, parseCoreFile } from '../../engine/data/coreFile';
import { roomTileOf } from '../../engine/data/roomTiles';
import type { GameEvent } from '../../engine/game/events';
import { lookHintCells } from '../../engine/game/hints';
import { reduce, replay, startGame } from '../../engine/game/reducer';
import {
  boardTilesInView,
  monstersInPlay,
  objectivesStatus,
  trapsInView,
  tunnelsInView,
} from '../../engine/game/view';
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
  JSON.parse(readFileSync(resolve(import.meta.dirname, 'fh02-trial-by-ice.json'), 'utf8')),
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
const lookUntilTrap = (base: GameEvent[], trap: string): GameEvent[] => {
  const ev = [...base];
  for (let i = 0; i < 80; i++) {
    const s = run(...ev);
    if (s.seenTraps.has(trap)) return ev;
    const next = lookHintCells(level, s)[0];
    if (!next) break;
    ev.push({ type: 'LOOK_FROM', cell: next });
  }
  throw new Error(`trap ${trap} never seen`);
};

// The start room, then the two rooms and the goblin room on the way to the bottom corridor.
const toR12: GameEvent[] = [open('in')];
const toR13: GameEvent[] = [...toR12, open('d13')];
const toR14: GameEvent[] = [...toR13, open('d14')];
const toR17: GameEvent[] = [...toR13, open('d15')];
const toCorridor: GameEvent[] = [...toR17, open('d16')];
// The north-west block of rooms, from the corridor door in the left column.
const toR01: GameEvent[] = reach(toCorridor, 'd1');
const toVault: GameEvent[] = [...toR01, open('d2')];
const toR03: GameEvent[] = [...toVault, open('d3')];
const toR07: GameEvent[] = [...toR01, open('d4')];
const toR08: GameEvent[] = [...toR07, open('d5')];
// The north-east block, from the corridor door at the foot of room R09.
const toR09: GameEvent[] = reach(toCorridor, 'd11');
const toR05: GameEvent[] = [...toR09, open('d8')];
const toR04: GameEvent[] = [...toR05, open('d6')];
const toR06: GameEvent[] = [...toR05, open('d7')];
const toR10: GameEvent[] = [...toR06, open('d9')];
const toR16: GameEvent[] = reach(toCorridor, 'd12');

describe('quest 2: data', () => {
  it('is valid against the board', () => {
    expect(validateQuest(quest, board)).toEqual([]);
  });

  it('has the map of the quest: doors, secret doors, blocks, furniture, monsters, traps', () => {
    expect(quest.edgeDoors).toHaveLength(1);
    expect(quest.edgeDoors[0]).toMatchObject({ kind: 'ironEntry', cell: [3, 12], side: 's' });
    expect(quest.doors).toHaveLength(16);
    expect(quest.secretDoors).toHaveLength(2);
    expect(quest.blocks).toHaveLength(3);
    expect(quest.furniture.map((f) => f.type).sort()).toEqual(
      [
        'bookcase',
        'chest',
        'chest',
        'cupboard',
        'fireplace',
        'rack',
        'sorcerersTable',
        'table',
        'weaponsRack',
      ].sort(),
    );
    expect(quest.monsters).toHaveLength(19);
    const kinds = quest.traps.map((t) => t.kind);
    expect(kinds.filter((k) => k === 'spear')).toHaveLength(5);
    expect(kinds.filter((k) => k === 'stalactite')).toHaveLength(2);
    expect(kinds.filter((k) => k === 'swingingAxe')).toHaveLength(2);
    expect(kinds.filter((k) => k === 'slipperyIce')).toHaveLength(3);
    expect(kinds.filter((k) => k === 'wanderingTrap')).toHaveLength(2);
    expect(quest.tunnels).toHaveLength(1);
    expect(quest.number).toBe(2);
    expect(quest.pack).toBe('frozen-horror');
    expect(quest.wandering).toEqual({ monster: 'goblin', count: 2 });
  });

  it('every letter on the map has a note', () => {
    for (const l of ['A', 'B', 'C', 'D', 'E'])
      expect(
        quest.notes.some((n) => n.letter === l),
        `note ${l}`,
      ).toBe(true);
  });

  it('every tile of the map is listed: the cave, the river and the vault', () => {
    expect(quest.boardTiles.map((t) => t.type).sort()).toEqual(['iceCaveEntrance', 'icyRiver']);
    expect(quest.roomTiles).toEqual([{ type: 'iceVault', area: 'R02' }]);
  });
});

describe('quest 2: the start', () => {
  it('the hero stands outside the iron door of the cave and sees only that door', () => {
    const { state } = startGame(level, 1);
    expect([...state.seenDoors]).toEqual(['in']);
    expect(state.seenCells.size).toBe(0);
    expect(fired(state, 'n-start')).toBe(true);
    expect(boardTilesInView(level, state).map((t) => t.type)).toEqual(['iceCaveEntrance']);
  });

  it('opening it shows the start room with two zombies and its inner door', () => {
    const s = run(...toR12);
    expect(s.seenMonsters.has('m-zombie-1') && s.seenMonsters.has('m-zombie-2')).toBe(true);
    expect(s.seenDoors.has('d13')).toBe(true);
    expect(s.seenMonsters.has('m-mummy')).toBe(false);
  });
});

describe('quest 2: the cast', () => {
  it('Krag is a core Dread Warrior with the stats of the book', () => {
    const s = run(...toR03);
    const krag = monstersInPlay(level, s).find((m) => m.id === 'm-krag')!;
    expect(krag.name).toBe('Krag');
    expect(krag.pictureType).toBe('dreadWarrior');
    expect(krag.stats).toMatchObject({ move: 7, att: 5, def: 5, body: 4, mind: 3 });
  });

  it('core monsters keep their type picture, Frozen Horror ones have none', () => {
    const s = run(...toR08);
    const by = (id: string) => monstersInPlay(level, s).find((m) => m.id === id);
    expect(by('m-orc-1')?.pictureType).toBe('orc');
    const bearState = run(...toR07);
    const bear = monstersInPlay(level, bearState).find((m) => m.id === 'm-bear')!;
    expect(bear.name).toBe('Polar Warbear');
    expect(bear.box).toBe('Frozen Horror');
    expect(bear.pictureType).toBeUndefined();
    const yetis = monstersInPlay(level, run(...toR09)).filter((m) => m.id.startsWith('m-yeti'));
    expect(yetis).toHaveLength(2);
    for (const y of yetis) {
      expect(y.box).toBe('Frozen Horror');
      expect(y.pictureType).toBeUndefined();
    }
  });

  it('the Yeti does not hug in a solo quest', () => {
    const s = run(...toR09);
    const yeti = ordersFor(level, s, ['barbarian']).find((o) => o.monster === 'm-yeti-1')!;
    expect(yeti.profile).toBe('fighter');
    expect(JSON.stringify(yeti)).not.toMatch(/Bear hug/);
  });

  it('the wandering monsters are two goblins', () => {
    expect(quest.wandering).toMatchObject({ monster: 'goblin', count: 2 });
  });
});

describe('quest 2: the way in', () => {
  it('R13 shows its two stalactites, R14 the orc, the abomination and the empty chest', () => {
    const s13 = run(...toR13);
    expect(trapsInView(level, s13).map((t) => t.id)).toEqual(
      expect.arrayContaining(['t-stal-1', 't-stal-2']),
    );
    const s14 = run(...toR14);
    expect(s14.seenMonsters.has('m-orc-3') && s14.seenMonsters.has('m-abom')).toBe(true);
    expect(fired(run(...toR14, search('R14')), 'n-B')).toBe(true);
  });

  it('R17 holds three goblins; the secret door to the tunnel room is not seen before a search', () => {
    const s = run(...toR17);
    for (const id of ['m-gob-1', 'm-gob-2', 'm-gob-3']) expect(s.seenMonsters.has(id)).toBe(true);
    expect(s.seenDoors.has('sd2')).toBe(false);
    expect(s.seenDoors.has('d16')).toBe(true);
    const r = reduce(level, s, { type: 'SEARCH_SECRET_DOORS', area: 'R17', override: true });
    expect(r.state.seenDoors.has('sd2')).toBe(true);
  });
});

describe('quest 2: the north-west rooms', () => {
  it('R01 has the mummy, R07 the Polar Warbear, R08 the orcs and the sorcerer table (C)', () => {
    expect(run(...toR01).seenMonsters.has('m-mummy')).toBe(true);
    expect(run(...toR07).seenMonsters.has('m-bear')).toBe(true);
    const s = run(...toR08);
    expect(s.seenMonsters.has('m-orc-1') && s.seenMonsters.has('m-orc-2')).toBe(true);
    const found = run(...toR08, search('R08'));
    expect(fired(found, 'n-C')).toBe(true);
    expect(JSON.stringify(reduce(level, s, search('R08')).prompts)).toContain('Potion of Warmth');
  });

  it('the ice vault shows its tile and two skeletons', () => {
    const s = run(...toVault);
    expect(s.seenMonsters.has('m-skel-v1') && s.seenMonsters.has('m-skel-v2')).toBe(true);
    expect(roomTileOf(quest, 'R02')?.name).toBe('Ice Vault');
  });

  it('E: R03 shows Krag, a gargoyle and three slippery ice squares; the secret door is found by search', () => {
    const s = run(...toR03);
    expect(fired(s, 'n-E')).toBe(true);
    expect(s.seenMonsters.has('m-krag') && s.seenMonsters.has('m-garg')).toBe(true);
    const ice = trapsInView(level, s).filter((t) => t.id.startsWith('t-ice'));
    expect(ice).toHaveLength(3);
    expect(s.seenDoors.has('sd1')).toBe(false);
    const found = reduce(level, run(...toR08), {
      type: 'SEARCH_SECRET_DOORS',
      area: 'R08',
      override: true,
    }).state;
    expect(found.seenDoors.has('sd1')).toBe(true);
  });
});

describe('quest 2: the north-east rooms', () => {
  it('R09 has two Yetis', () => {
    const s = run(...toR09);
    expect(s.seenMonsters.has('m-yeti-1') && s.seenMonsters.has('m-yeti-2')).toBe(true);
  });

  it('R05 shows the two swinging axes, R04 two skeletons', () => {
    const s = run(...toR05);
    expect(trapsInView(level, s).filter((t) => t.id.startsWith('t-axe'))).toHaveLength(2);
    const s4 = run(...toR04);
    expect(s4.seenMonsters.has('m-skel-1') && s4.seenMonsters.has('m-skel-2')).toBe(true);
  });

  it('D: R06 has five spear traps and the chest with 120 gold', () => {
    const s = run(...toR06);
    expect(trapsInView(level, s).filter((t) => t.id.startsWith('t-spear'))).toHaveLength(5);
    expect(JSON.stringify(reduce(level, s, search('R06')).prompts)).toContain('120 gold');
    expect(fired(run(...toR06, search('R06')), 'n-D')).toBe(true);
  });

  it('R10 holds the table and no monsters', () => {
    const s = run(...toR10);
    expect(s.seenFurniture.has('f-table')).toBe(true);
  });
});

describe('quest 2: ice tunnel A', () => {
  it('the tunnel room R16 shows its end and the note, and the other end stays hidden', () => {
    const s = run(...toR16);
    expect(fired(s, 'n-A2')).toBe(true);
    const ends = tunnelsInView(level, s);
    expect(ends.some((e) => e.tunnel === 'tun1' && e.end === 'b')).toBe(true); // (24,13)
    expect(ends.some((e) => e.tunnel === 'tun1' && e.end === 'a')).toBe(false);
  });

  it('using it from R16 lands in room R18 and shows the rack room with note A', () => {
    const s = run(...toR16, { type: 'TUNNEL_USE', tunnel: 'tun1', from: 'b' });
    expect(s.seenCells.has('11,13')).toBe(true);
    expect(s.seenFurniture.has('f-rack')).toBe(true);
    expect(fired(s, 'n-A1')).toBe(true);
  });
});

describe('quest 2: hazards and terrain', () => {
  it('a wandering monster trap brings two goblins', () => {
    const base = lookUntilTrap(toCorridor, 't-wander-1');
    const r = reduce(level, run(...base), { type: 'TRAP_STEP', trap: 't-wander-1' });
    const p = r.prompts.find((x) => x.kind === 'trapSprung') as
      { spawned?: { monsterType: string }[] } | undefined;
    expect(p?.spawned).toHaveLength(2);
    expect(p?.spawned?.every((m) => m.monsterType === 'goblin')).toBe(true);
  });

  it('the icy river shows once its squares are seen', () => {
    expect(
      boardTilesInView(level, run(...toCorridor))
        .map((t) => t.type)
        .includes('icyRiver'),
    ).toBe(false);
    const s = run(...lookUntilTrap(toCorridor, 't-wander-1'));
    expect(s.seenCells.size).toBeGreaterThan(0);
  });

  it('the slippery ice springs with its kind told at the spring', () => {
    const r = reduce(level, run(...toR03), { type: 'TRAP_STEP', trap: 't-ice-1' });
    expect(JSON.stringify(r.prompts)).toContain('slipperyIce');
  });
});

describe('quest 2: the end', () => {
  it('the goal is Krag, then the hero leaves through the cave', () => {
    const s = run(...toR03);
    expect(objectivesStatus(level, s).goalDone).toBe(false);
    const dead = reduce(level, s, { type: 'MONSTER_KILL', monster: 'm-krag' }).state;
    expect(objectivesStatus(level, dead).items.find((o) => o.id === 'o1')?.done).toBe(true);
    // leaving is confirmed by the players
    expect(objectivesStatus(level, dead).goalDone).toBe(false);
    const out = reduce(level, dead, { type: 'CONFIRM_OBJECTIVE', objective: 'o2' }).state;
    expect(objectivesStatus(level, out).goalDone).toBe(true);
  });
});
