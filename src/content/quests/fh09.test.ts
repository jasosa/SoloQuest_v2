/**
 * Walk-through of the Frozen Horror double quest (quests 9 and 10), The Heart of Ice: two maps in one
 * quest, the Frozen Halls (map 1, letters A to F) and the Catacombs (map 2, letters G to M).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { areaAt, board } from '../../engine/board/board';
import { activeLevel, buildLevel } from '../../engine/board/level';
import { applyCoreFile, parseCoreFile } from '../../engine/data/coreFile';
import type { GameEvent } from '../../engine/game/events';
import { lookHintCells } from '../../engine/game/hints';
import { elementQuest, mapLetters } from '../../engine/game/noteView';
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

// The Frozen Horror abilities and spells come from the Core library file.
applyCoreFile(
  parseCoreFile(
    JSON.parse(readFileSync(resolve(import.meta.dirname, '../library/frozen-horror.json'), 'utf8')),
  )!,
);

const quest = parseQuest(
  JSON.parse(readFileSync(resolve(import.meta.dirname, 'fh09-the-heart-of-ice.json'), 'utf8')),
);
const root = buildLevel(quest);
const HALLS = 'halls';
const CATA = 'catacombs';
const halls = activeLevel(root, { map: HALLS });
const cata = activeLevel(root, { map: CATA });
type State = ReturnType<typeof replay>;
const lv = (s: State) => activeLevel(root, s);

const open = (door: string): GameEvent => ({ type: 'OPEN_DOOR', door });
const run = (...events: GameEvent[]) => replay(root, 1, events);
const fired = (s: State, id: string) => s.notesFired.includes(id);
const manual = (note: string): GameEvent => ({ type: 'MANUAL_TRIGGER', note });
const choose = (note: string, option: number): GameEvent => ({ type: 'CHOOSE', note, option });
const search = (room: string): GameEvent => ({
  type: 'SEARCH_TREASURE',
  room,
  hero: 'dwarf',
  override: true,
});
const secret = (ev: GameEvent[], area: string, door: string): GameEvent[] => [
  ...ev,
  { type: 'SEARCH_SECRET_DOORS', area, override: true },
  open(door),
];
const tunnel = (id: string, from: 'a' | 'b'): GameEvent => ({
  type: 'TUNNEL_USE',
  tunnel: id,
  from,
});
const by = (s: State, id: string) => monstersInPlay(lv(s), s).find((m) => m.id === id)!;

// Walking: look along the corridors until a door is in sight (as the players do), then open it.
const reach = (base: GameEvent[], door: string): GameEvent[] => {
  const ev = [...base];
  for (let i = 0; i < 120; i++) {
    const s = run(...ev);
    if (s.seenDoors.has(door)) return [...ev, open(door)];
    const next = lookHintCells(lv(s), s)[0];
    if (!next) break;
    ev.push({ type: 'LOOK_FROM', cell: next });
  }
  throw new Error(`door ${door} never seen`);
};

// ---- map 1: the stairway room R08 is behind R07, R01, R02 and R03 (west side)
const toR07: GameEvent[] = reach([open('in')], 'dh9');
const toR01: GameEvent[] = [...toR07, open('dh6')];
const toR02: GameEvent[] = [...toR01, open('dh4')];
const toR03: GameEvent[] = [...toR02, open('dh5')];
const toR08: GameEvent[] = [...toR03, open('dh7')];
const down: GameEvent[] = [manual('n-A-down'), choose('n-A-down', 0)];
const up: GameEvent[] = [manual('n-G-up'), choose('n-G-up', 0)];

// ---- map 1: the Seat of Power is behind the east pocket (R04 > R05 > R06 > secret door > R10)
const toR04: GameEvent[] = reach([open('in')], 'dh2');
const toR05: GameEvent[] = [...toR04, open('dh3')];
const toR06: GameEvent[] = [...toR05, open('dh8')];
const toR10: GameEvent[] = secret(toR06, 'R06', 'sh3');
const toFDoor: GameEvent[] = reach([...toR10, open('dh10')], 'dF');
const toFDoorNoOpen = toFDoor.slice(0, -1);

// ---- map 2: from the arrival room R08 along the corridors to the key chest in R21
const arrive: GameEvent[] = [...toR08, ...down];
const toCataR07: GameEvent[] = [...arrive, open('dc8')];
const toCorridor: GameEvent[] = [...toCataR07, open('dc7')];
const toR19: GameEvent[] = reach(toCorridor, 'dc9');
const toR15: GameEvent[] = [...toR19, open('dc12')];
const toR21: GameEvent[] = secret(toR15, 'R15', 'sc3');
const withKey: GameEvent[] = [...toR21, search('R21')];
// R20 and R12 (the Gremlins) are reached from the bottom corridor; K is behind a secret door
const toR20: GameEvent[] = reach(toCorridor, 'dc14');
const toR12: GameEvent[] = [...toR20, open('dc11')];
const toK: GameEvent[] = secret(toR12, 'R12', 'sc2');
const stealKey: GameEvent[] = [
  { type: 'MONSTER_LEAVE', monster: 'c-gremlin-1', reason: 'escaped' },
  choose('n-key-stolen', 0),
];

describe('fh09: data', () => {
  it('is valid against the board', () => {
    expect(validateQuest(quest, board)).toEqual([]);
  });

  it('is one quest with two maps, the pack and the number', () => {
    expect(quest.number).toBe(9);
    expect(quest.pack).toBe('frozen-horror');
    expect(quest.title).toContain('double quest');
    expect(quest.mapId).toBe(HALLS);
    expect(quest.mapName).toBe('The Frozen Halls');
    expect(quest.maps?.map((m) => [m.id, m.name])).toEqual([[CATA, 'The Catacombs']]);
    expect(quest.links).toEqual([
      { id: 'l1', a: { map: HALLS, cell: [7, 7] }, b: { map: CATA, cell: [8, 8] } },
    ]);
    expect(quest.start).toEqual({ door: 'in' });
    expect(quest.maps?.[0]?.start).toEqual({ area: 'R08', kind: 'stairway' });
  });

  it('map 1 has the doors, blocks, furniture, monsters, traps, tunnel and tiles of the scan', () => {
    expect(quest.edgeDoors.map((e) => [e.id, e.kind])).toEqual([
      ['in', 'ironEntry'],
      ['out', 'woodenExit'],
    ]);
    expect(quest.doors).toHaveLength(17); // 16 plain doors and the key door dF
    expect(quest.secretDoors).toHaveLength(3);
    expect(quest.blocks).toHaveLength(6);
    expect(quest.furniture.map((f) => f.type).sort()).toEqual(
      [
        'alchemistsBench',
        'bookcase',
        'chest',
        'chest',
        'fireplace',
        'sorcerersTable',
        'stairs',
        'tomb',
        'weaponsRack',
      ].sort(),
    );
    expect(quest.monsters).toHaveLength(61);
    const kinds = quest.traps.map((t) => t.kind);
    const count = (k: string) => kinds.filter((x) => x === k).length;
    expect(count('swingingAxe')).toBe(4);
    expect(count('spear')).toBe(2);
    expect(count('pit')).toBe(2);
    expect(count('wanderingTrap')).toBe(3);
    expect(count('chest')).toBe(1);
    // the slippery ice is tiles, not trap squares
    expect(count('slipperyIce')).toBe(0);
    expect(quest.rock.rooms).toEqual(['R09', 'R15', 'R16', 'R22']);
    expect(quest.tunnels).toHaveLength(1);
    expect(quest.roomTiles).toEqual([
      { type: 'livingFog', area: 'R12' },
      { type: 'seatOfPower', area: 'R11' },
      { type: 'iceVault', area: 'R21' },
    ]);
    expect(quest.boardTiles.map((t) => [t.type, t.cells.length])).toEqual([
      ['icyRiver', 3],
      ['icyRiver', 8],
      ['slipperyIce', 2],
      ['slipperyIce', 2],
      ['slipperyIce', 3],
    ]);
  });

  it('map 2 has the doors, blocks, furniture, monsters, traps, tunnels and tiles of the scan', () => {
    const m = quest.maps![0]!;
    expect(m.edgeDoors).toEqual([]);
    expect(m.doors).toHaveLength(14);
    expect(m.secretDoors).toHaveLength(3);
    expect(m.blocks).toHaveLength(1);
    expect(m.furniture.map((f) => f.type).sort()).toEqual(
      [
        'bookcase',
        'chest',
        'cupboard',
        'rack',
        'sorcerersTable',
        'stairs',
        'table',
        'table',
        'weaponsRack',
      ].sort(),
    );
    expect(m.monsters).toHaveLength(69);
    const kinds = m.traps.map((t) => t.kind);
    const count = (k: string) => kinds.filter((x) => x === k).length;
    expect(count('pit')).toBe(4);
    expect(count('spear')).toBe(3);
    expect(count('stalactite')).toBe(3);
    expect(count('swingingAxe')).toBe(2);
    expect(count('wanderingTrap')).toBe(3);
    expect(count('iceSlide')).toBe(1);
    expect(count('chest')).toBe(1);
    expect(m.traps.find((t) => t.kind === 'iceSlide')?.path).toHaveLength(8);
    expect(m.tunnels.map((t) => t.design).sort()).toEqual([1, 2, 3]);
    expect(m.rock.rooms).toEqual(['R09', 'R17', 'R18']);
    expect(m.roomTiles).toEqual([
      { type: 'gremlinTreasure', area: 'R13' },
      { type: 'chasmRoom', area: 'R20' },
    ]);
    expect(m.areaOverrides).toEqual([{ merge: ['R13', 'R14'] }]);
    expect(m.boardTiles.map((t) => [t.type, t.cells.length])).toEqual([
      ['slipperyIce', 6],
      ['slipperyIce', 2],
    ]);
  });

  it('every letter of both maps has a note, and no letter is used on both maps', () => {
    const letters = (map: string) =>
      new Set(quest.notes.filter((n) => n.map === map && n.letter).map((n) => n.letter));
    expect([...letters(HALLS)].sort()).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
    expect([...letters(CATA)].sort()).toEqual(['G', 'H', 'I', 'J', 'K', 'L', 'M']);
  });

  it('the wandering monsters are 2 Polar Warbears', () => {
    expect(quest.wandering).toEqual({ monster: 'goblin', enemy: 'polarWarbear', count: 2 });
  });

  it('the Frozen Horror is one 2 x 2 special caster, and every figure has its own picture', () => {
    const fh = quest.monsters.find((m) => m.id === 'm-fh')!;
    expect(fh).toMatchObject({ enemy: 'frozenHorror', cell: [10, 10], size: 2, special: true });
    const def = quest.enemyDefs.find((e) => e.id === 'frozenHorror')!;
    expect(def.overrides).toEqual({ move: 8, att: 5, def: 4, body: 6, mind: 4 });
    expect(def.profile).toBe('caster');
    expect(def.spells).toHaveLength(6);
    for (const m of [...quest.monsters, ...quest.maps![0]!.monsters])
      if (m.enemy)
        expect(
          quest.enemyDefs.some((e) => e.id === m.enemy),
          m.id,
        ).toBe(true);
  });

  it('every id is told apart per map (the validator checks the repeats)', () => {
    expect(halls.quest.monsters.length + cata.quest.monsters.length).toBe(130);
    expect(halls.quest.notes.some((n) => n.id === 'n-G')).toBe(false);
    expect(cata.quest.notes.some((n) => n.id === 'n-A')).toBe(false);
    // the key notes work on both maps
    expect(halls.quest.notes.some((n) => n.id === 'n-key-stolen')).toBe(true);
    expect(cata.quest.notes.some((n) => n.id === 'n-key-stolen')).toBe(true);
  });
});

describe('fh09: the start and map 1', () => {
  it('the heroes stand outside the iron door on the west edge and see only that door', () => {
    const { state, prompts } = startGame(root, 1);
    expect(state.map).toBe(HALLS);
    expect([...state.seenDoors]).toEqual(['in']);
    expect(state.seenCells.size).toBe(0);
    expect(fired(state, 'n-start')).toBe(true);
    const text = JSON.stringify(prompts);
    expect(text).toContain('iron door');
    expect(text).toContain('Frozen Horror');
    // no spoilers in the start message: no tunnels, no hidden doors, no traps
    expect(text).not.toMatch(/tunnel|secret|trap/i);
  });

  it('the first corridor shows the west corridor and the wooden exit is not in sight yet', () => {
    const s = run(open('in'));
    expect(s.seenCells.has('0,8') && s.seenCells.has('0,10')).toBe(true);
    expect(lv(s).doors.get('out')?.edge).toBe('woodenExit');
    expect(s.seenDoors.has('out')).toBe(false);
  });

  it('the west rooms lead to the stairway room: R07, R01, R02, R03 and R08', () => {
    const s = run(...toR08);
    for (const r of ['R07', 'R01', 'R02', 'R03', 'R08'])
      expect(s.revealedRooms.has(r), r).toBe(true);
    expect(s.seenFurniture.has('f-h-stairs')).toBe(true);
    // R07: three Skeletons and two Orcs, the Sorcerer's table; R02 has a Yeti between Warbears
    expect(s.seenMonsters.has('h-skel-1') && s.seenMonsters.has('h-orc-2')).toBe(true);
    expect(s.seenFurniture.has('f-h-sorc')).toBe(true);
    expect(by(s, 'h-yeti-1').name).toBe('Yeti');
    expect(by(s, 'h-bear-1').name).toBe('Polar Warbear');
    // R03: three Abominations beside the bookcase
    for (const id of ['h-abom-1', 'h-abom-2', 'h-abom-3'])
      expect(s.seenMonsters.has(id)).toBe(true);
    expect(s.seenFurniture.has('f-h-bookcase')).toBe(true);
    // the river tile of R02 shows with the room
    expect(boardTilesInView(lv(s), s).map((t) => t.type)).toContain('icyRiver');
  });

  it('A: the stairway note shows with its room and the letter stays on the map', () => {
    const s = run(...toR08);
    expect(fired(s, 'n-A')).toBe(true);
    expect(mapLetters(lv(s), s).map((l) => l.letter)).toContain('A');
    expect(boardTilesInView(lv(s), s).filter((t) => t.type === 'slipperyIce')).toHaveLength(0);
  });

  it('B: the living fog room has its tile and the fog rule, and an Abomination, Yeti and Warbear', () => {
    // R12 is behind R20: the bottom corridor leads to R20 and then R12
    const s = run(...reach(reach([open('in')], 'dh15'), 'dh14'));
    expect(s.revealedRooms.has('R12')).toBe(true);
    expect(fired(s, 'n-B')).toBe(true);
    for (const id of ['h-abom-6', 'h-yeti-4', 'h-bear-5', 'h-abom-7'])
      expect(s.seenMonsters.has(id), id).toBe(true);
    expect(JSON.stringify(lv(s).quest.roomTiles)).toContain('livingFog');
  });

  it('the Gremlins of R17 are behind the Dread Warriors of R13 and the swinging axes of R14', () => {
    // R20 (bottom corridor), then R12, R13, R14 and R17 in a chain of doors
    const toR14 = [...reach(reach([open('in')], 'dh15'), 'dh14'), open('dh11'), open('dh12')];
    const s = run(...toR14);
    expect(s.revealedRooms.has('R13') && s.revealedRooms.has('R14')).toBe(true);
    expect(s.seenMonsters.has('h-dw-8') && s.seenMonsters.has('h-dw-9')).toBe(true);
    expect(trapsInView(lv(s), s).filter((t) => t.id.includes('swingingAxe'))).toHaveLength(2);
    const r17 = run(...toR14, open('dh13'));
    expect(r17.revealedRooms.has('R17')).toBe(true);
    expect(by(r17, 'h-gremlin-1').name).toBe('Ice Gremlin');
  });

  it('the Dread Warriors, crossbowmen and orcs of the north: R04 with the alchemist (E)', () => {
    const s = run(...toR04);
    expect(s.revealedRooms.has('R04')).toBe(true);
    expect(s.seenFurniture.has('f-h-bench')).toBe(true);
    expect(by(s, 'h-xbow-1').name).toBe('Crossbowman');
    const n = reduce(root, s, search('R04'));
    expect(fired(n.state, 'n-E')).toBe(true);
    expect(JSON.stringify(n.prompts)).toContain('spell scroll');
  });

  it('R05 has the slippery ice tiles and two swinging axes next to the door', () => {
    const s = run(...toR05);
    const tiles = boardTilesInView(lv(s), s).filter((t) => t.type === 'slipperyIce');
    expect(tiles.map((t) => t.cells.length)).toEqual([2, 2]);
    expect(trapsInView(lv(s), s).filter((t) => t.id.includes('swingingAxe'))).toHaveLength(2);
  });

  it('R06: three Dread Warriors, a spear, a pit and the secret door on its south wall', () => {
    const s = run(...toR06);
    for (const id of ['h-dw-3', 'h-dw-4', 'h-dw-5']) expect(s.seenMonsters.has(id)).toBe(true);
    expect(s.seenDoors.has('sh3')).toBe(false);
    const found = run(...secret(toR06, 'R06', 'sh3'));
    expect(found.seenDoors.has('sh3')).toBe(true);
    expect(found.revealedRooms.has('R10')).toBe(true);
    expect(by(found, 'h-garg-1').name).toBe('Gargoyle');
  });

  it('R10 has a plain chest and leads out by its east door to the east corridors', () => {
    const s = run(...toR10);
    expect(s.seenFurniture.has('f-h-chest-b')).toBe(true);
    const out = run(...toFDoorNoOpen);
    expect(out.seenDoors.has('dF')).toBe(true);
    expect(out.seenDoors.has('out')).toBe(true);
    expect(out.revealedRooms.has('R11')).toBe(false);
    const tiles = boardTilesInView(lv(out), out).map((t) => t.type);
    expect(tiles).toContain('icyRiver');
  });
});

describe('fh09: the hazards of map 1', () => {
  it('a wandering monster trap brings the two Warbears', () => {
    const s = run(...toR04);
    const k = 't-h-wanderingTrap-1';
    expect(s.seenTraps.has(k)).toBe(true);
    const w = reduce(root, s, { type: 'TRAP_STEP', trap: k });
    const wanderers = monstersInPlay(lv(w.state), w.state).filter((m) => m.id.startsWith('w'));
    expect(wanderers.map((m) => m.name)).toEqual(['Polar Warbear', 'Polar Warbear']);
  });

  it('D: the ice vault is behind R17, R18 and the ice tunnel C; its chest has the latch trap', () => {
    // R17 > secret door > R18 > tunnel C to R19 > secret door > R21
    const toR18 = secret(reach([open('in')], 'dh16'), 'R17', 'sh1');
    const s18 = run(...toR18);
    expect(s18.revealedRooms.has('R18')).toBe(true);
    expect(s18.seenFurniture.has('f-h-weapons')).toBe(true);
    const ends = tunnelsInView(lv(s18), s18);
    expect(ends.some((e) => e.tunnel === 'tunC' && e.end === 'a')).toBe(true); // (11,13) in R18
    expect(ends.some((e) => e.tunnel === 'tunC' && e.end === 'b')).toBe(false); // (14,13) in R19
    const toR19 = [...toR18, tunnel('tunC', 'a')];
    const s19 = run(...toR19);
    expect(s19.revealedRooms.has('R19')).toBe(true);
    expect(s19.seenFurniture.has('f-h-tomb')).toBe(true);
    for (const id of ['h-skel-4', 'h-skel-5', 'h-zomb-1', 'h-mummy-1', 'h-zomb-2', 'h-skel-6'])
      expect(s19.seenMonsters.has(id), id).toBe(true);
    const s21 = run(...secret(toR19, 'R19', 'sh2'));
    expect(s21.revealedRooms.has('R21')).toBe(true);
    expect(s21.seenFurniture.has('f-h-chest-d')).toBe(true);
    expect(by(s21, 'h-yeti-5').name).toBe('Yeti');
    // the ice vault tile shows with its room
    expect(JSON.stringify(lv(s21).quest.roomTiles)).toContain('iceVault');
    // the search: the latch springs first, then the first hero finds the gold and the potions
    const n = reduce(root, s21, search('R21'));
    expect(fired(n.state, 'n-D')).toBe(true);
    expect(JSON.stringify(n.prompts)).toContain('400 gold');
    const trap = quest.traps.find((t) => t.id === 't-h-chest-d')!;
    expect(trap.effect).toMatch(/1 Body Point/);
    // the treasure text does not repeat the trap text
    expect(JSON.stringify(quest.notes.find((x) => x.id === 'n-D')?.effects)).not.toMatch(/latch/);
  });
});

describe('fh09: the stairway and crossing', () => {
  it('"No" stays on map 1 and the question is asked again', () => {
    const s = run(...toR08, manual('n-A-down'), choose('n-A-down', 1));
    expect(s.map).toBe(HALLS);
    const again = reduce(root, s, manual('n-A-down'));
    expect(again.prompts.some((p) => p.kind === 'choice')).toBe(true);
  });

  it('the button is on the stairway square only', () => {
    const s = run(...toR08);
    const stairs = elementQuest(lv(s), s, 'furniture', 'f-h-stairs');
    expect(stairs.buttons.map((b) => b.label)).toEqual(['Go down the stairway']);
    expect(elementQuest(lv(s), s, 'furniture', 'f-h-bookcase').buttons).toEqual([]);
  });

  it('"Yes" crosses to the arrival room of map 2: it shows whole, with its note G', () => {
    const r = reduce(root, run(...toR08), manual('n-A-down'));
    const asked = reduce(root, r.state, choose('n-A-down', 0));
    expect(asked.state.map).toBe(CATA);
    expect(asked.prompts.some((p) => p.kind === 'crossed')).toBe(true);
    const s = asked.state;
    expect([...s.revealedRooms]).toEqual(['R08']);
    expect(s.seenFurniture.has('f-c-stairs')).toBe(true);
    expect(fired(s, 'n-G')).toBe(true);
    // the fog of map 1 is gone, the doors are closed, the notes that fired stay
    expect(s.openDoors.size).toBe(0);
    expect(s.seenMonsters.size).toBe(0);
    expect(fired(s, 'n-A')).toBe(true);
    expect(s.turn).toBe(1);
  });

  it('the crossing text tells the players to clear the board and keeps the points', () => {
    const r = reduce(root, run(...toR08, manual('n-A-down')), {
      type: 'CHOOSE',
      note: 'n-A-down',
      option: 0,
    });
    expect(JSON.stringify(r.prompts)).toContain('Take every piece');
  });

  it('crossing back reveals the stairway room of map 1; monsters killed stay dead', () => {
    const kill: GameEvent = { type: 'MONSTER_KILL', monster: 'h-abom-1' };
    const s = run(...toR08, kill, ...down, ...up);
    expect(s.map).toBe(HALLS);
    expect([...s.revealedRooms]).toEqual(['R08']);
    expect(s.monsters['h-abom-1']?.dead).toBe(true);
    expect(s.seenMonsters.has('h-abom-1')).toBe(false);
    expect(s.openDoors.size).toBe(0);
    expect(s.notesFired.filter((n) => n === 'n-A')).toHaveLength(1);
  });

  it('turns continue and killed heroes stay dead across the stairway', () => {
    const s = run(
      ...toR08,
      { type: 'ZARGON_TURN_END' },
      { type: 'HERO_DIED', hero: 'dwarf' },
      ...down,
      { type: 'ZARGON_TURN_END' },
    );
    expect(s.turn).toBe(3);
    expect(s.deadHeroes).toEqual(['dwarf']);
  });
});

describe('fh09: map 2, the Catacombs', () => {
  it('G: the arrival room has the stairway, a note and a secret door on its east wall', () => {
    const s = run(...arrive);
    expect(mapLetters(lv(s), s).map((l) => l.letter)).toContain('G');
    const ask = elementQuest(lv(s), s, 'furniture', 'f-c-stairs');
    expect(ask.buttons.map((b) => b.label)).toEqual(['Go up the stairway']);
    expect(s.seenDoors.has('sc1')).toBe(false);
    const found = run(...secret(arrive, 'R08', 'sc1'));
    expect(found.revealedRooms.has('R03')).toBe(true);
    // the three Orcs, the Dread Warrior and the tunnel H of R03
    for (const id of ['c-orc-1', 'c-orc-2', 'c-orc-3', 'c-dw-1'])
      expect(found.seenMonsters.has(id), id).toBe(true);
  });

  it('R07 and R01 beyond the west door: pit traps, Orcs and Abominations, Yeti and Warbear', () => {
    const s = run(...toCataR07);
    expect(s.revealedRooms.has('R07')).toBe(true);
    expect(trapsInView(lv(s), s).filter((t) => t.id.includes('-pit-'))).toHaveLength(3);
    for (const id of ['c-orc-4', 'c-abom-1', 'c-orc-5', 'c-orc-6', 'c-abom-2'])
      expect(s.seenMonsters.has(id), id).toBe(true);
    const r01 = run(...toCataR07, open('dc3'));
    expect(r01.revealedRooms.has('R01')).toBe(true);
    expect(r01.seenFurniture.has('f-c-weapons')).toBe(true);
    expect(by(r01, 'c-yeti-1').name).toBe('Yeti');
    expect(by(r01, 'c-bear-1').name).toBe('Polar Warbear');
  });

  it('the ice slide runs along the whole top corridor, and a step on it springs it', () => {
    const slide = quest.maps![0]!.traps.find((t) => t.kind === 'iceSlide')!;
    expect(slide.cell).toEqual([1, 0]);
    expect(slide.path?.[7]).toEqual([8, 0]);
    const s = run(...reach(toCorridor, 'dc1'));
    expect(s.seenTraps.has('t-c-slide')).toBe(true);
    const r = reduce(root, s, { type: 'TRAP_STEP', trap: 't-c-slide' });
    expect(JSON.stringify(r.prompts)).toContain('iceSlide');
  });

  it('H: the tunnel joins R04 and R03 (the east end shows only after R04 is open)', () => {
    const toR04 = reach(toCorridor, 'dc6');
    const s = run(...toR04);
    expect(s.revealedRooms.has('R04')).toBe(true);
    expect(fired(s, 'n-H2')).toBe(true);
    expect(fired(s, 'n-H1')).toBe(false);
    // R04: a Swordsman, a Halberdier and a Yeti, with the 3 x 2 slippery ice tile at the door
    for (const id of ['c-sword-1', 'c-halb-1', 'c-yeti-2'])
      expect(s.seenMonsters.has(id)).toBe(true);
    const tile = boardTilesInView(lv(s), s).filter((t) => t.type === 'slipperyIce');
    expect(tile.map((t) => t.cells.length)).toEqual([6]);
    const ends = tunnelsInView(lv(s), s);
    expect(ends.some((e) => e.tunnel === 'tunH' && e.end === 'b')).toBe(true); // (14,1)
    expect(ends.some((e) => e.tunnel === 'tunH' && e.end === 'a')).toBe(false); // (11,1)
    const through = run(...toR04, tunnel('tunH', 'b'));
    expect(through.revealedRooms.has('R03')).toBe(true);
    expect(fired(through, 'n-H1')).toBe(true);
    expect(through.seenMonsters.has('c-orc-1')).toBe(true);
    expect(mapLetters(lv(through), through).filter((l) => l.letter === 'H')).toHaveLength(2);
  });

  it('I and J: the tunnel from R10 leads into the room of the bookcase; the first search finds the scroll', () => {
    // R05 (top corridor), R06, R10 (abominations, spears) and tunnel I into R11
    const toR06 = [...reach(toCorridor, 'dc1'), open('dc4')];
    const toR10 = [...toR06, open('dc5')];
    const s10 = run(...toR10);
    expect(s10.revealedRooms.has('R10')).toBe(true);
    expect(fired(s10, 'n-I1')).toBe(true);
    expect(s10.seenFurniture.has('f-c-sorc') || run(...toR06).seenFurniture.has('f-c-sorc')).toBe(
      true,
    );
    // the two spears of R10 (the spear of the arrival room is in view as well)
    const spears = trapsInView(lv(s10), s10).map((t) => t.id);
    expect(spears).toEqual(expect.arrayContaining(['t-c-spear-2', 't-c-spear-3']));
    const toR11 = [...toR10, tunnel('tunI', 'a')];
    const s11 = run(...toR11);
    expect(s11.revealedRooms.has('R11')).toBe(true);
    expect(fired(s11, 'n-I2')).toBe(true);
    expect(s11.seenFurniture.has('f-c-bookcase-j')).toBe(true);
    expect(by(s11, 'c-garg-1').name).toBe('Gargoyle');
    const n = reduce(root, s11, search('R11'));
    expect(fired(n.state, 'n-J')).toBe(true);
    expect(JSON.stringify(n.prompts)).toContain('2 potions of healing');
    // a second search is an ordinary one: the note does not fire again
    const again = reduce(root, n.state, search('R11'));
    expect(again.state.notesFired.filter((x) => x === 'n-J')).toHaveLength(1);
  });

  it('R05 of map 2: two Skeletons, two Goblins, two Zombies and two Mummies', () => {
    const s = run(...reach(toCorridor, 'dc1'));
    expect(s.revealedRooms.has('R05')).toBe(true);
    for (const id of ['c-skel-4', 'c-skel-5', 'c-goblin-1', 'c-goblin-2', 'c-zomb-1', 'c-mummy-3'])
      expect(s.seenMonsters.has(id), id).toBe(true);
  });

  it('the key room R21 is behind R19, R15 and a secret door; R19 has the slippery ice tile', () => {
    const s19 = run(...toR19);
    expect(s19.revealedRooms.has('R19')).toBe(true);
    expect(s19.seenFurniture.has('f-c-table-2')).toBe(true);
    const tile = boardTilesInView(lv(s19), s19).filter((t) => t.type === 'slipperyIce');
    expect(tile.map((t) => t.cells.length)).toEqual([2]);
    const s15 = run(...toR15);
    expect(s15.revealedRooms.has('R15')).toBe(true);
    expect(s15.seenFurniture.has('f-c-cupboard')).toBe(true);
    for (const id of ['c-sword-2', 'c-sword-3', 'c-halb-2'])
      expect(s15.seenMonsters.has(id)).toBe(true);
    expect(trapsInView(lv(s15), s15).filter((t) => t.id.includes('stalactite'))).toHaveLength(3);
    const s21 = run(...toR21);
    expect(s21.revealedRooms.has('R21')).toBe(true);
    expect(by(s21, 'c-yeti-3').name).toBe('Yeti');
    expect(s21.seenFurniture.has('f-c-chest-m')).toBe(true);
  });

  it('L: the tunnel joins R16 and R22; R22 holds the Goblins and Orcs of the south east', () => {
    const toR16 = [...toR15, open('dc10')];
    const s16 = run(...toR16);
    expect(s16.revealedRooms.has('R16')).toBe(true);
    expect(fired(s16, 'n-L1')).toBe(true);
    for (const id of ['c-skel-6', 'c-dw-5', 'c-abom-6', 'c-skel-7', 'c-dw-6'])
      expect(s16.seenMonsters.has(id), id).toBe(true);
    const s22 = run(...toR16, tunnel('tunL', 'a'));
    expect(s22.revealedRooms.has('R22')).toBe(true);
    expect(fired(s22, 'n-L2')).toBe(true);
    for (const id of ['c-goblin-3', 'c-goblin-8', 'c-orc-11', 'c-orc-16'])
      expect(s22.seenMonsters.has(id), id).toBe(true);
  });

  it('the wandering monster trap of the middle corridor brings the two Warbears', () => {
    const s = run(...reach(toCorridor, 'dc6'));
    const w = reduce(root, s, {
      type: 'TRAP_STEP',
      trap: 't-c-wanderingTrap-2',
    });
    const wanderers = monstersInPlay(lv(w.state), w.state).filter((m) => m.id.startsWith('w'));
    expect(wanderers.map((m) => m.name)).toEqual(['Polar Warbear', 'Polar Warbear']);
  });

  it('the bottom left: R20 is a bottomless chasm room with two Crossbowmen', () => {
    const s = run(...toR20);
    expect(s.revealedRooms.has('R20')).toBe(true);
    expect(JSON.stringify(lv(s).quest.roomTiles)).toContain('chasmRoom');
    expect(by(s, 'c-xbow-1').name).toBe('Crossbowman');
    const r12 = run(...toR12);
    expect(r12.seenFurniture.has('f-c-rack')).toBe(true);
    for (const id of ['c-gremlin-1', 'c-gremlin-2', 'c-gremlin-3'])
      expect(by(r12, id).profile, id).toBe('thief');
  });
});

describe('fh09: the Gremlin treasure room (two rooms made one)', () => {
  it('K: the tile covers R13 and R14, so they are one room with no wall between', () => {
    const s = run(...toK);
    expect(s.seenDoors.has('sc2')).toBe(true);
    expect(s.revealedRooms.has('R13')).toBe(true);
    expect(areaAt(lv(s).board, 7, 11)).toBe('R13'); // a square of the old R14
    expect(fired(s, 'n-K')).toBe(true);
    expect(JSON.stringify(lv(s).quest.roomTiles)).toContain('gremlinTreasure');
    // the room is seen whole, also the old R14 side
    expect(s.seenCells.has('8,12') && s.seenCells.has('5,10')).toBe(true);
  });

  it('with the key still with the heroes there is no button in the hoard', () => {
    const s = run(...toK);
    expect(elementQuest(lv(s), s, 'area', 'R13').buttons).toEqual([]);
  });
});

describe('fh09: the Crystal Key and the locked door', () => {
  it('M: the chest holds the key and a potion; the trap text is separate', () => {
    const s = run(...toR21);
    const n = reduce(root, s, search('R21'));
    expect(fired(n.state, 'n-M')).toBe(true);
    const text = JSON.stringify(n.prompts);
    expect(text).toContain('Crystal Key');
    expect(n.state.flags['crystalKey']).toBe(true);
    expect(n.state.flags['keyFound']).toBe(true);
    const trap = quest.maps![0]!.traps.find((t) => t.id === 't-c-chest-m')!;
    expect(trap.effect).toMatch(/2 Body Points/);
    expect(JSON.stringify(cata.quest.notes.find((x) => x.id === 'n-M')?.effects)).not.toMatch(
      /needle|poison|latch/,
    );
    expect(objectivesStatus(lv(n.state), n.state).items.find((o) => o.id === 'o1')?.done).toBe(
      true,
    );
  });

  it('the key door of the Seat of Power does not open before the key is found', () => {
    const s = run(...toFDoorNoOpen);
    const r = reduce(root, s, open('dF'));
    expect(r.prompts.map((p) => p.kind)).toEqual(['doorStuck']);
    expect(r.state.openDoors.has('dF')).toBe(false);
    // and the button of the door is not offered yet
    expect(elementQuest(lv(s), s, 'door', 'dF').buttons).toEqual([]);
  });

  it('an Ice Gremlin that escapes asks about the key only once the key is found', () => {
    const before = run(...toR12);
    const noKey = reduce(root, before, {
      type: 'MONSTER_LEAVE',
      monster: 'c-gremlin-1',
      monsterType: 'goblin',
      reason: 'escaped',
    } as GameEvent);
    expect(noKey.prompts.some((p) => p.kind === 'choice')).toBe(false);
    expect(noKey.state.flags['keyStolen']).toBeUndefined();
  });

  it('the key stolen: the flag goes, the hoard of R13 gets a button, a hero takes it back', () => {
    // find the key, then the gremlins of R12 take it
    const found: GameEvent[] = [
      ...reach(toR12, 'dc9'),
      open('dc12'),
      ...secret([], 'R15', 'sc3'),
      search('R21'),
    ];
    const s0 = run(...found);
    expect(s0.flags['crystalKey']).toBe(true);
    const asked = reduce(root, s0, stealKey[0]!);
    expect(asked.prompts.some((p) => p.kind === 'choice')).toBe(true);
    // "No, something else" changes nothing
    const other = reduce(root, asked.state, choose('n-key-stolen', 1)).state;
    expect(other.flags['crystalKey']).toBe(true);
    // "Yes, the key"
    const stolen: GameEvent[] = [...found, ...stealKey];
    const s = run(...stolen);
    expect(s.flags['crystalKey']).toBe(false);
    expect(s.flags['keyStolen']).toBe(true);
    // the goal "find the key" stays done: the heroes did find it
    expect(objectivesStatus(lv(s), s).items.find((o) => o.id === 'o1')?.done).toBe(true);
    // the key door cannot be tried while the key is gone (no button on it)
    expect(elementQuest(lv(s), s, 'door', 'dF').buttons).toEqual([]);
    // the hoard room R13 has the button; a hero takes the key back and the flags turn again
    const hoard = run(...secret(stolen, 'R12', 'sc2'));
    expect(hoard.revealedRooms.has('R13')).toBe(true);
    const btn = elementQuest(lv(hoard), hoard, 'area', 'R13').buttons;
    expect(btn.map((b) => b.label)).toEqual(['A hero takes the Crystal Key back']);
    const back = run(...secret(stolen, 'R12', 'sc2'), manual('n-K-key'));
    expect(back.flags['crystalKey']).toBe(true);
    expect(back.flags['keyStolen']).toBe(false);
    expect(elementQuest(lv(back), back, 'area', 'R13').buttons).toEqual([]);
  });
});

describe('fh09: back up, the Seat of Power and the end', () => {
  const withKeyBack: GameEvent[] = [...withKey, ...up];
  // on map 1 again: out of the stairway room, along the top corridor, the east pocket, the door
  const out: GameEvent[] = [...withKeyBack, open('dh7'), open('dh5'), open('dh4'), open('dh1')];
  const east: GameEvent[] = reach(out, 'dh2');
  const atDoor: GameEvent[] = reach(
    secret([...east, open('dh3'), open('dh8')], 'R06', 'sh3').concat(open('dh10')),
    'dF',
  ).slice(0, -1);

  it('the way back keeps the flags: map 1 again, with the key', () => {
    const s = run(...withKeyBack);
    expect(s.map).toBe(HALLS);
    expect(s.flags['crystalKey']).toBe(true);
    expect(s.flags['keyFound']).toBe(true);
    expect(fired(s, 'n-M')).toBe(true);
    expect([...s.revealedRooms]).toEqual(['R08']);
  });

  it('a hero with the key tries the door: "no" changes nothing, "yes" turns the key', () => {
    const s = run(...atDoor);
    // the door is stuck until a hero with the key tries it, but its button is there now
    expect(reduce(root, s, open('dF')).prompts.map((p) => p.kind)).toEqual(['doorStuck']);
    const btn = elementQuest(lv(s), s, 'door', 'dF').buttons;
    expect(btn.map((b) => b.label)).toEqual(['A hero with the Crystal Key tries the door']);
    const no = run(...atDoor, manual('n-F-door'), choose('n-F-door', 1));
    expect(no.flags['keyTurned']).toBeUndefined();
    expect(reduce(root, no, open('dF')).prompts.map((p) => p.kind)).toEqual(['doorStuck']);
    const yes = run(...atDoor, manual('n-F-door'), choose('n-F-door', 0), open('dF'));
    expect(yes.openDoors.has('dF')).toBe(true);
  });

  it('F: the door opens onto the Seat of Power: the Frozen Horror and its guards', () => {
    const s = run(...atDoor, manual('n-F-door'), choose('n-F-door', 0), open('dF'));
    expect(s.revealedRooms.has('R11')).toBe(true);
    expect(fired(s, 'n-F')).toBe(true);
    expect(JSON.stringify(lv(s).quest.roomTiles)).toContain('seatOfPower');
    for (const id of ['h-bear-3', 'h-yeti-2', 'h-dw-6', 'h-bear-4', 'h-yeti-3', 'h-dw-7', 'm-fh'])
      expect(s.seenMonsters.has(id), id).toBe(true);
    const fh = by(s, 'm-fh');
    expect(fh.name).toBe('Frozen Horror');
    expect(fh.size).toBe(2);
    expect(fh.special).toBe(true);
    expect(fh.stats).toMatchObject({
      move: 8,
      att: 5,
      def: 4,
      body: 6,
      mind: 4,
    });
    expect(fh.profile).toBe('caster');
    expect(fh.box).toBe('Frozen Horror');
    expect(boardTilesInView(lv(s), s).some((t) => t.type === 'slipperyIce')).toBe(true);
    const orders = ordersFor(lv(s), s, ['dwarf']);
    expect(orders.find((o) => o.monster === 'm-fh')?.profile).toBe('caster');
  });

  it('killing the Frozen Horror ends the quest goal, wherever the heroes are', () => {
    const s = run(...atDoor, manual('n-F-door'), choose('n-F-door', 0), open('dF'));
    const before = objectivesStatus(lv(s), s);
    expect(before.goalDone).toBe(false);
    expect(before.items.find((o) => o.id === 'o2')?.done).toBe(false);
    const dead = reduce(root, s, {
      type: 'MONSTER_KILL',
      monster: 'm-fh',
    }).state;
    const after = objectivesStatus(lv(dead), dead);
    expect(after.items.find((o) => o.id === 'o2')?.done).toBe(true);
    expect(after.goalDone).toBe(true);
    expect(quest.endText).toContain('1,000 gold');
    expect(quest.rewards).toContain('1,000 gold');
    // the goal stays done when the heroes go down the stairway again
    const below = run(
      ...atDoor,
      manual('n-F-door'),
      choose('n-F-door', 0),
      open('dF'),
      {
        type: 'MONSTER_KILL',
        monster: 'm-fh',
      },
      ...down,
    );
    expect(below.map).toBe(CATA);
    expect(objectivesStatus(lv(below), below).goalDone).toBe(true);
  });
});
