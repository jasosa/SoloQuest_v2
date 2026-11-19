/** Walk-through of Frozen Horror quest 5, The Deadly Depths (group quest). */
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
  dormantFigures,
  monstersInPlay,
  objectivesStatus,
  trapsInView,
  tunnelsInView,
} from '../../engine/game/view';
import { parseQuest } from '../../engine/quest/loader';
import { validateQuest } from '../../engine/quest/validate';
import { ordersFor } from '../../engine/zargon/orders';

// The Frozen Horror abilities and spells come from the Core library files.
applyCoreFile(
  parseCoreFile(
    JSON.parse(readFileSync(resolve(import.meta.dirname, '../library/frozen-horror.json'), 'utf8')),
  )!,
);

const quest = parseQuest(
  JSON.parse(readFileSync(resolve(import.meta.dirname, 'fh05-the-deadly-depths.json'), 'utf8')),
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
const manual = (note: string): GameEvent => ({ type: 'MANUAL_TRIGGER', note });
const choose = (note: string, option: number): GameEvent => ({ type: 'CHOOSE', note, option });

// The east corridor leads to the B door of the top right room (R06).
const toR06: GameEvent[] = reach([open('in')], 'dB2');
const bYes: GameEvent[] = [manual('n-B-ask'), choose('n-B-ask', 0)];
// With the B doors gone, the way on is R06 > R10 > R09 > R05, then the crypt door C on the east.
const toR05: GameEvent[] = [...toR06, ...bYes, open('d17'), open('d15'), open('d16')];
const toCrypt: GameEvent[] = [...toR05, open('dC2')];
// Row 0 and row 9 are blocked on the east side, so the rest of the board is reached through the
// crypt: its west door C leads to the corridor beside it.
const toWest: GameEvent[] = [...toCrypt, open('dC1')];
const secret = (area: string): GameEvent => ({ type: 'SEARCH_SECRET_DOORS', area, override: true });

describe('quest 5: data', () => {
  it('is valid against the board', () => {
    expect(validateQuest(quest, board)).toEqual([]);
  });

  it('has the map: doors, secret doors, blocks, furniture, monsters, traps, tunnel and tiles', () => {
    expect(quest.edgeDoors.map((e) => e.kind).sort()).toEqual(['ironEntry', 'woodenExit']);
    expect(quest.doors).toHaveLength(22); // 18 plain, 2 B doors, 2 C doors
    expect(quest.secretDoors).toHaveLength(3);
    expect(quest.blocks).toHaveLength(6);
    expect(quest.furniture).toHaveLength(12);
    expect(quest.monsters).toHaveLength(55);
    const kinds = quest.traps.map((t) => t.kind);
    expect(kinds.filter((k) => k === 'pit')).toHaveLength(9);
    expect(kinds.filter((k) => k === 'stalactite')).toHaveLength(12);
    expect(kinds.filter((k) => k === 'swingingAxe')).toHaveLength(6);
    expect(kinds.filter((k) => k === 'slipperyIce')).toHaveLength(2);
    expect(kinds.filter((k) => k === 'wanderingTrap')).toHaveLength(3);
    expect(quest.tunnels).toHaveLength(1);
    expect(quest.boardTiles.map((t) => t.type).sort()).toEqual(['iceLedge', 'icyRiver']);
    expect(quest.roomTiles).toEqual([{ type: 'frozenCrypt', area: 'R04' }]);
    expect(quest.number).toBe(5);
    expect(quest.pack).toBe('frozen-horror');
  });

  it('every letter on the map has a note', () => {
    for (const l of ['A', 'B', 'C', 'D', 'E', 'F', 'G'])
      expect(
        quest.notes.some((n) => n.letter === l),
        `note ${l}`,
      ).toBe(true);
  });

  it('the wandering monsters are 2 Mummies', () => {
    expect(quest.wandering).toMatchObject({ monster: 'mummy', count: 2 });
  });
});

describe('quest 5: the start', () => {
  it('the heroes stand outside the iron door at the lower left and see only that door', () => {
    const { state, prompts } = startGame(level, 1);
    expect([...state.seenDoors]).toEqual(['in']);
    expect(state.seenCells.size).toBe(0);
    expect(fired(state, 'n-start')).toBe(true);
    expect(JSON.stringify(prompts)).toContain('Ice tunnels');
  });

  it('opening it shows the bottom corridor, with the exit door nowhere in sight yet', () => {
    const s = run(open('in'));
    for (const x of [0, 1, 2, 3, 4]) expect(s.seenCells.has(`${x},18`)).toBe(true);
    expect(s.seenDoors.has('out')).toBe(false);
  });

  it('the wooden exit door is on the west edge, behind the icy river', () => {
    const out = quest.edgeDoors.find((e) => e.kind === 'woodenExit')!;
    expect(out.cell).toEqual([0, 9]);
    expect(out.side).toBe('w');
    const river = quest.boardTiles.find((t) => t.type === 'icyRiver')!;
    expect(river.cells).toHaveLength(8);
    expect(river.cells.every(([, y]) => y === 9)).toBe(true);
  });
});

describe('quest 5: the cast', () => {
  it('Vilor is a caster with the five spells and the book stats', () => {
    const s = run(...toR06);
    const def = quest.enemyDefs.find((e) => e.id === 'vilor')!;
    expect(def.overrides).toEqual({ move: 8, att: 4, def: 3, body: 4, mind: 5 });
    expect(def.spells).toEqual(['fhChill', 'fhIceStorm', 'lightningBolt', 'sleep', 'tempest']);
    expect(quest.monsters.find((m) => m.id === 'm-vilor')).toMatchObject({
      cell: [13, 9],
      special: true,
    });
    expect(s.seenMonsters.has('m-vilor')).toBe(false);
  });

  it('Frozen Horror monsters know their box and have no core picture; core ones do', () => {
    const def = (id: string) => quest.monsters.find((m) => m.id === id)!;
    expect(def('m-yeti-1').enemy).toBe('yeti');
    expect(def('m-bear-1').enemy).toBe('polarWarbear');
    expect(def('m-gremlin-1').enemy).toBe('iceGremlin');
    expect(def('m-orc-1').type).toBe('orc');
    expect(def('m-dw-1').type).toBe('dreadWarrior');
    expect(def('m-garg-1').type).toBe('gargoyle');
    expect(def('m-crypt-3').enemy).toBe('yeti');
  });
});

describe('quest 5: the B doors and the vanishing', () => {
  it('R06 is entered by door B: note B fires and asks about the heroes', () => {
    const s = run(...toR06);
    expect(fired(s, 'n-B')).toBe(true);
    expect(s.seenDoors.has('dB1')).toBe(true);
    expect(s.removedDoors).toEqual([]);
    expect(s.flags['doorsGone']).toBeUndefined();
  });

  it('answering No changes nothing, and the question can be asked again', () => {
    const no = run(...toR06, manual('n-B-ask'), choose('n-B-ask', 1));
    expect(no.removedDoors).toEqual([]);
    expect(no.flags['doorsGone']).toBeUndefined();
    const again = reduce(level, no, manual('n-B-ask'));
    expect(again.state.removedDoors).toEqual([]);
  });

  it('Yes: both B doors vanish for good and door C is on the map', () => {
    const before = run(...toR06);
    expect(before.seenDoors.has('dC1') || before.seenDoors.has('dC2')).toBe(false);
    const s = run(...toR06, ...bYes);
    expect([...s.removedDoors].sort()).toEqual(['dB1', 'dB2']);
    expect(s.flags['doorsGone']).toBe(true);
  });

  it('door C stays off the map before the B doors vanish, even beside its squares', () => {
    const s = run(...toR06);
    expect(s.seenDoors.has('dC1')).toBe(false);
    expect(s.seenDoors.has('dC2')).toBe(false);
  });
});

describe('quest 5: the frozen crypt', () => {
  it('the crypt monsters are dormant, and the room has its tile', () => {
    expect(quest.roomTiles[0]?.area).toBe('R04');
    const crypt = quest.monsters.filter((m) => m.id.startsWith('m-crypt-'));
    expect(crypt).toHaveLength(6);
    expect(crypt.every((m) => m.state === 'dormant')).toBe(true);
    expect(crypt.map((m) => m.enemy).sort()).toEqual(
      ['iceGremlin', 'iceGremlin', 'polarWarbear', 'polarWarbear', 'yeti', 'yeti'].sort(),
    );
  });

  it('opening door C wakes all six, and the roster shows them', () => {
    const closed = run(...toR05);
    expect(dormantFigures(level, closed).length === 0).toBe(true); // not seen yet
    const s = run(...toCrypt);
    expect(fired(s, 'n-C-east')).toBe(true);
    const ids = monstersInPlay(level, s).map((m) => m.id);
    for (let i = 1; i <= 6; i++) expect(ids).toContain(`m-crypt-${i}`);
    expect(dormantFigures(level, s)).toEqual([]);
    const gremlin = monstersInPlay(level, s).find((m) => m.id === 'm-crypt-1')!;
    expect(gremlin.name).toBe('Ice Gremlin');
    expect(gremlin.box).toBe('Frozen Horror');
    expect(gremlin.pictureType).toBeUndefined();
  });

  it('the west door C wakes them as well', () => {
    const s = run(...toWest);
    expect(fired(s, 'n-C-west')).toBe(true);
    expect(monstersInPlay(level, s).some((m) => m.id === 'm-crypt-4')).toBe(true);
  });
});

describe('quest 5: rooms and treasure', () => {
  // The west pocket: iron door side, corridor up column 0 to the door of R12.
  const toR12: GameEvent[] = reach([open('in')], 'd5');
  const toR17: GameEvent[] = [...toR12, open('d6')];
  const toR14: GameEvent[] = [...toR17, open('d7')];

  it('R12 shows three orcs; R17 and R14 follow, and the treasure of R14 is note F', () => {
    const a = run(...toR12);
    for (const id of ['m-orc-5', 'm-orc-6', 'm-orc-7']) expect(a.seenMonsters.has(id)).toBe(true);
    const b = run(...toR14);
    expect(fired(b, 'n-F')).toBe(false);
    expect(fired(run(...toR14, search('R14')), 'n-F')).toBe(true);
  });

  it('E: the tomb room R20 hides behind a secret door of R17 and holds the ring', () => {
    const s = run(...toR17);
    expect(s.seenDoors.has('s3')).toBe(false);
    const found = run(...toR17, secret('R17'));
    expect(found.seenDoors.has('s3')).toBe(true);
    const inside = run(...toR17, secret('R17'), open('s3'));
    expect(inside.seenMonsters.has('m-mummy-1') && inside.seenMonsters.has('m-zombie-2')).toBe(
      true,
    );
    expect(fired(run(...toR17, secret('R17'), open('s3'), search('R20')), 'n-E')).toBe(true);
  });

  it('the slippery ice room R13 hides behind a secret door of R14', () => {
    const found = run(...toR14, secret('R14'));
    expect(found.seenDoors.has('s2')).toBe(true);
    const inside = run(...toR14, secret('R14'), open('s2'));
    expect(inside.seenMonsters.has('m-abom-2') && inside.seenMonsters.has('m-abom-3')).toBe(true);
    const ice = trapsInView(level, inside).filter((t) => t.id.startsWith('t-ice'));
    expect(ice).toHaveLength(2);
    expect(ice.every((t) => t.kind === undefined)).toBe(true);
    const r = reduce(level, inside, { type: 'TRAP_STEP', trap: 't-ice-1' });
    expect(JSON.stringify(r.prompts)).toContain('slipperyIce');
  });

  it('D: R01 is the end of a chain of rooms and holds the 400 gold search', () => {
    const toR07: GameEvent[] = reach(toWest, 'd3');
    const toR08: GameEvent[] = [...toR07, open('d4')];
    const found: GameEvent[] = [...toR08, secret('R08')];
    expect(run(...found).seenDoors.has('s1')).toBe(true);
    const toR01: GameEvent[] = [...found, open('s1'), open('d2'), open('d1')];
    const s = run(...toR01);
    expect(s.seenMonsters.has('m-yeti-1') && s.seenMonsters.has('m-bear-1')).toBe(true);
    expect(fired(run(...toR01, search('R01')), 'n-D')).toBe(true);
  });

  it('treasure notes: D gold and scroll, E ring, F potions, each consumed on the first search', () => {
    const r = (room: string, note: string, text: RegExp) => {
      const n = quest.notes.find((x) => x.id === note)!;
      expect(n.trigger).toMatchObject({ type: 'treasureSearch', area: room, first: true });
      expect(n.consumesTreasure).toBe(true);
      expect(JSON.stringify(n.effects)).toMatch(text);
    };
    r('R01', 'n-D', /400 gold/);
    r('R20', 'n-E', /Ring of Warmth/);
    r('R14', 'n-F', /2 potions of healing/);
  });

  it('G: the center room has Vilor between two Dread warriors, note G on the room', () => {
    const s = run(...reach(toWest, 'd18'));
    expect(fired(s, 'n-G')).toBe(true);
    for (const id of ['m-dw-3', 'm-vilor', 'm-dw-4']) expect(s.seenMonsters.has(id)).toBe(true);
    const vilor = monstersInPlay(level, s).find((m) => m.id === 'm-vilor')!;
    expect(vilor.name).toBe('Vilor the Dread Warlock');
    expect(vilor.special).toBe(true);
    expect(vilor.stats).toMatchObject({ move: 8, att: 4, def: 3, body: 4, mind: 5 });
    const orders = ordersFor(level, s, ['dwarf']);
    const v = orders.find((o) => o.monster === 'm-vilor')!;
    expect(v.profile).toBe('caster');
  });
});

describe('quest 5: ice tunnels and the ledge', () => {
  it('there is one tunnel pair, in R16 and the room just below it', () => {
    const t = quest.tunnels[0]!;
    expect(t.design).toBe(1);
    expect(board.cells[t.a[1]]?.[t.a[0]]).toBe('R16');
    expect(board.cells[t.b[1]]?.[t.b[0]]).toBe('R22');
    expect(tunnelsInView(level, run(open('in')))).toEqual([]);
  });

  it('the ice ledge tile covers the whole of R16', () => {
    const ledge = quest.boardTiles.find((t) => t.type === 'iceLedge')!;
    expect(ledge.cells).toHaveLength(16);
    for (const [x, y] of ledge.cells) expect(board.cells[y]?.[x]).toBe('R16');
    expect(boardTilesInView(level, startGame(level, 1).state)).toEqual([]);
  });

  it('A notes sit on both rooms and explain the tunnel', () => {
    const a = quest.notes.filter((n) => n.letter === 'A');
    expect(a.map((n) => n.at).sort()).toEqual([
      [21, 12],
      [21, 15],
    ]);
    expect(a.map((n) => n.trigger)).toEqual([
      { type: 'areaRevealed', area: 'R16' },
      { type: 'areaRevealed', area: 'R22' },
    ]);
  });
});

describe('quest 5: hazards', () => {
  it('traps show as "?" once seen, with the kind hidden', () => {
    const s = run(open('in'));
    const seen = trapsInView(level, s);
    expect(seen.map((t) => t.id)).toContain('t-pit-5'); // (0,17), right by the start
    expect(seen.every((t) => t.kind === undefined)).toBe(true);
  });

  it('a wandering monster trap brings the quest wanderers (2 Mummies)', () => {
    const s = run(open('in'));
    expect(trapsInView(level, s).map((t) => t.id)).toContain('t-hand-3'); // (19,18)
    const r = reduce(level, s, { type: 'TRAP_STEP', trap: 't-hand-3' });
    expect(JSON.stringify(r.prompts)).toContain('wanderingTrap');
  });

  it('a swinging axe is seen in R09 and springs as an axe', () => {
    const s = run(...toR05);
    expect(trapsInView(level, s).filter((t) => t.id.startsWith('t-axe')).length).toBe(4);
    const r = reduce(level, s, { type: 'TRAP_STEP', trap: 't-axe-1' });
    expect(JSON.stringify(r.prompts)).toContain('swingingAxe');
  });
});

describe('quest 5: the exit and the end', () => {
  it('the wooden exit door shows at the end of the icy river corridor', () => {
    const s = run(...reach(toWest, 'out'));
    expect(s.seenDoors.has('out')).toBe(true);
    expect(s.seenCells.has('5,9')).toBe(true);
  });

  it('the only objective is to leave by the wooden exit, confirmed by the players', () => {
    const s = startGame(level, 1).state;
    expect(objectivesStatus(level, s).goalDone).toBe(false);
    const done = reduce(level, s, { type: 'CONFIRM_OBJECTIVE', objective: 'o1' }).state;
    expect(objectivesStatus(level, done).goalDone).toBe(true);
  });
});
