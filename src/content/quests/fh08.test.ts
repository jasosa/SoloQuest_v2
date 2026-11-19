/** Walk-through of Frozen Horror quest 8, The Search for the Scepter (a group quest). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { board } from '../../engine/board/board';
import { buildLevel } from '../../engine/board/level';
import { applyCoreFile, parseCoreFile } from '../../engine/data/coreFile';
import type { GameEvent } from '../../engine/game/events';
import { lookHintCells } from '../../engine/game/hints';
import { elementQuest, goalDoneText, objectiveConfirms } from '../../engine/game/noteView';
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

// The Frozen Horror abilities come from the Core library file.
applyCoreFile(
  parseCoreFile(
    JSON.parse(readFileSync(resolve(import.meta.dirname, '../library/frozen-horror.json'), 'utf8')),
  )!,
);

const quest = parseQuest(
  JSON.parse(
    readFileSync(resolve(import.meta.dirname, 'fh08-the-search-for-the-scepter.json'), 'utf8'),
  ),
);
const level = buildLevel(quest);
const open = (door: string): GameEvent => ({ type: 'OPEN_DOOR', door });
const run = (...events: GameEvent[]) => replay(level, 1, events);
const fired = (s: ReturnType<typeof run>, id: string) => s.notesFired.includes(id);
const tunnel = (id: string, from: 'a' | 'b'): GameEvent => ({
  type: 'TUNNEL_USE',
  tunnel: id,
  from,
});
const searchRoom = (room: string): GameEvent => ({
  type: 'SEARCH_TREASURE',
  room,
  hero: 'dwarf',
  override: true,
});

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
const secret = (ev: GameEvent[], area: string, door: string): GameEvent[] => [
  ...ev,
  { type: 'SEARCH_SECRET_DOORS', area, override: true },
  open(door),
];
const by = (s: ReturnType<typeof run>, id: string) =>
  monstersInPlay(level, s).find((m) => m.id === id)!;

// The iron door opens on top of the ice slide, so the heroes go down it first. That pocket of the
// board (the bottom corridor east of the block at (11,18), the middle corridors) only leads to room
// R19. The way on is ice tunnel A to R18, then R17, R14 and R13, whose door gives on the west.
const slide: GameEvent[] = [open('in'), { type: 'TRAP_STEP', trap: 't-slide' }];
const toR19: GameEvent[] = reach(slide, 'd19');
const toR21: GameEvent[] = secret(toR19, 'R19', 's3');
const toR22: GameEvent[] = [...toR21, open('d18')];
const toR18: GameEvent[] = [...toR19, tunnel('tunA', 'b')];
const toR13: GameEvent[] = reach(reach(reach(toR18, 'd17'), 'd16'), 'd15');
const outside: GameEvent[] = [...toR13, open('d7')];
const toR08: GameEvent[] = [...outside, open('d6')];
const toR02: GameEvent[] = [...toR08, open('d4')];
const toR01: GameEvent[] = [...toR02, open('d2')];
const toR07: GameEvent[] = [...toR01, open('d3')];
const toExit: GameEvent[] = reach([...toR01, open('d1')], 'out');
const toR04: GameEvent[] = reach(outside, 'd9');
const toR09: GameEvent[] = [...toR04, open('d10')];
const toR05: GameEvent[] = secret(toR04, 'R04', 's1');
const toR06: GameEvent[] = [...toR05, open('d11')];
const toR10: GameEvent[] = [...toR06, open('d12')];
const destroy: GameEvent[] = [
  { type: 'MANUAL_TRIGGER', note: 'n-G-scepter' },
  { type: 'CHOOSE', note: 'n-G-scepter', option: 0 },
];

describe('quest 8: data', () => {
  it('is valid against the board', () => {
    expect(validateQuest(quest, board)).toEqual([]);
  });

  it('has the map of the quest: doors, blocks, furniture, monsters, traps and tunnels', () => {
    expect(quest.doors).toHaveLength(19);
    expect(quest.secretDoors).toHaveLength(3);
    expect(quest.edgeDoors.map((e) => e.kind)).toEqual(['ironEntry', 'woodenExit']);
    expect(quest.blocks).toHaveLength(7);
    expect(quest.furniture.map((f) => f.type).sort()).toEqual(
      ['alchemistsBench', 'bookcase', 'chest', 'cupboard', 'table', 'weaponsRack'].sort(),
    );
    expect(quest.monsters).toHaveLength(63);
    const kinds = quest.traps.map((t) => t.kind);
    const count = (k: string) => kinds.filter((x) => x === k).length;
    expect(count('spear')).toBe(4);
    expect(count('pit')).toBe(4);
    expect(count('stalactite')).toBe(6);
    expect(count('wanderingTrap')).toBe(3);
    expect(count('slipperyIce')).toBe(2);
    expect(count('iceSlide')).toBe(1);
    expect(count('chest')).toBe(1);
    expect(quest.tunnels).toHaveLength(3);
    expect(quest.tunnels.map((t) => t.design).sort()).toEqual([1, 2, 3]);
    expect(quest.number).toBe(8);
    expect(quest.pack).toBe('frozen-horror');
    expect(quest.rock.rooms).toEqual(['R15', 'R16']);
  });

  it('every tile of the map is listed, so the players are told to put it on the board', () => {
    expect(quest.roomTiles).toEqual([
      { type: 'scepterRoom', area: 'R06' },
      { type: 'iceVault', area: 'R21' },
    ]);
    expect(quest.boardTiles.map((t) => t.type)).toEqual(['iceLedge']);
    expect(quest.boardTiles[0]?.cells).toHaveLength(15); // the whole of room R04
  });

  it('every letter that needs a note has one', () => {
    for (const l of ['B', 'C', 'F', 'G'])
      expect(
        quest.notes.some((n) => n.letter === l),
        `note ${l}`,
      ).toBe(true);
  });

  it('the wandering monsters are 3 Ice Gremlins', () => {
    expect(quest.wandering).toEqual({ monster: 'goblin', enemy: 'iceGremlin', count: 3 });
  });
});

describe('quest 8: the start', () => {
  it('the heroes stand outside the iron door on the east edge and see only that door', () => {
    const { state, prompts } = startGame(level, 1);
    expect([...state.seenDoors]).toEqual(['in']);
    expect(state.seenCells.size).toBe(0);
    expect(fired(state, 'n-start')).toBe(true);
    expect(JSON.stringify(prompts)).toContain('Ice tunnels');
  });

  it('opening it shows the east corridor with the ice slide, which is the only way on', () => {
    const s = run(open('in'));
    for (let y = 9; y <= 18; y++) expect(s.seenCells.has(`25,${y}`)).toBe(true);
    expect(trapsInView(level, s).map((t) => t.id)).toEqual(
      expect.arrayContaining(['t-slide', 't-spear-4']),
    );
    // the blocks at (24,9) and (25,8) close the entrance square on the other sides
    expect(level.blockAt.has('24,9') && level.blockAt.has('25,8')).toBe(true);
  });

  it('the slide springs as an ice slide that runs down the whole column', () => {
    const r = reduce(level, run(open('in')), { type: 'TRAP_STEP', trap: 't-slide' });
    expect(JSON.stringify(r.prompts)).toContain('iceSlide');
    expect(quest.traps.find((t) => t.id === 't-slide')?.path).toHaveLength(8);
  });

  it('the pocket leads to room R19 and nowhere else: the bottom corridor is blocked at (11,18)', () => {
    const s = run(...toR19);
    expect([...s.revealedRooms]).toEqual(['R19']);
    expect(s.seenDoors.has('d19')).toBe(true);
    expect(s.seenDoors.has('out')).toBe(false);
    expect(level.blockAt.has('11,18')).toBe(true);
  });
});

describe('quest 8: ice tunnels and secret doors', () => {
  it('a tunnel end shows only after its square is seen, the other end stays hidden', () => {
    const s = run(...toR19);
    const ends = tunnelsInView(level, s);
    expect(ends.some((e) => e.tunnel === 'tunA' && e.end === 'b')).toBe(true); // (14,13) in R19
    expect(ends.some((e) => e.tunnel === 'tunA' && e.end === 'a')).toBe(false); // (11,13) in R18
    expect(() => run(...slide, tunnel('tunD', 'a'))).toThrow(/has not been seen yet/);
  });

  it('tunnel A takes the heroes from R19 to R18 and shows what is in sight there', () => {
    const s = run(...toR18);
    expect(s.seenCells.has('11,13')).toBe(true);
    expect(s.seenCells.has('11,14')).toBe(true);
    const again = reduce(level, s, tunnel('tunA', 'b'));
    expect(again.prompts.some((p) => p.kind === 'tunnelUsed')).toBe(true);
  });

  it('tunnel D joins R08 to the center room, tunnel E joins R07 to R12', () => {
    const d = run(...toR08, tunnel('tunD', 'a'));
    expect(d.revealedRooms.has('R11')).toBe(true);
    expect(by(d, 'm-garg-1').name).toBe('Gargoyle');
    expect(d.seenMonsters.has('m-dw-5') && d.seenMonsters.has('m-dw-7')).toBe(true);
    const e = run(...toR07, tunnel('tunE', 'a'));
    expect(e.revealedRooms.has('R12')).toBe(true);
  });

  it('the secret door of R19 leads to the ice vault, and is not seen before the search', () => {
    expect(run(...toR19).seenDoors.has('s3')).toBe(false);
    const s = run(...toR21);
    expect(s.seenDoors.has('s3')).toBe(true);
    expect(s.revealedRooms.has('R21')).toBe(true);
    expect(trapsInView(level, s).map((t) => t.id)).toEqual(
      expect.arrayContaining(['t-ice-1', 't-ice-2']),
    );
  });
});

describe('quest 8: rooms and notes', () => {
  it('B: the bookcase hides a spell scroll for the first searcher', () => {
    const s = run(...toR22);
    expect(s.revealedRooms.has('R22')).toBe(true);
    expect(s.seenMonsters.has('m-abom-6')).toBe(true);
    const n = reduce(level, s, searchRoom('R22'));
    expect(fired(n.state, 'n-B')).toBe(true);
    expect(JSON.stringify(n.prompts)).toContain('spell scroll');
  });

  it('C: the chest of R13 carries the poison needle and holds 200 gold and 2 potions', () => {
    const s = run(...toR13);
    expect(s.seenFurniture.has('f-chest-c')).toBe(true);
    const n = reduce(level, s, searchRoom('R13'));
    expect(fired(n.state, 'n-C')).toBe(true);
    const text = JSON.stringify(n.prompts);
    expect(text).toContain('poison needle');
    expect(text).toContain('200 gold');
    expect(quest.traps.find((t) => t.id === 't-chest-c')?.effect).toMatch(/2 Body Points/);
  });

  it('west rooms: R01 weapons rack, R02 Dread Warrior, R07 Gremlins, Yetis and Warbears', () => {
    const s = run(...toR07);
    expect(s.seenFurniture.has('f-weapons')).toBe(true);
    expect(s.seenMonsters.has('m-dw-1')).toBe(true);
    for (const id of ['m-gremlin-1', 'm-yeti-2', 'm-bear-3'])
      expect(s.seenMonsters.has(id), id).toBe(true);
    expect(by(s, 'm-bear-3').name).toBe('Polar Warbear');
  });

  it('the western corridor leads down to the wooden exit door and a wandering monster trap', () => {
    const s = run(...toExit);
    expect(s.seenDoors.has('out')).toBe(true);
    expect(level.doors.get('out')?.edge).toBe('woodenExit');
    expect(s.seenTraps.has('t-wander-3')).toBe(true);
    const w = reduce(level, s, { type: 'TRAP_STEP', trap: 't-wander-3' });
    const wanderers = monstersInPlay(level, w.state).filter((m) => m.id.startsWith('w'));
    expect(wanderers.map((m) => m.name)).toEqual(['Ice Gremlin', 'Ice Gremlin', 'Ice Gremlin']);
    expect(wanderers[0]?.profile).toBe('thief');
  });

  it('R09 holds a Warbear, a Yeti, two Abominations and a Mummy; its door leads to a closed corridor', () => {
    const s = run(...toR09);
    expect(s.revealedRooms.has('R09')).toBe(true);
    for (const id of ['m-bear-2', 'm-yeti-4', 'm-abom-3', 'm-abom-4', 'm-mummy-2'])
      expect(s.seenMonsters.has(id), id).toBe(true);
    expect(s.seenDoors.has('d13')).toBe(true);
    // the corridor beyond d13 lies between the blocks (16,9) and (24,9)
    expect(level.blockAt.has('16,9') && level.blockAt.has('24,9')).toBe(true);
  });

  it('F: the ice ledge tile and its note show with the room', () => {
    const s = run(...toR04);
    expect(fired(s, 'n-F')).toBe(true);
    expect(boardTilesInView(level, s).map((t) => t.type)).toEqual(['iceLedge']);
    expect(boardTilesInView(level, run(...outside))).toHaveLength(0);
    expect(s.seenMonsters.has('m-mummy-1') && s.seenMonsters.has('m-zomb-1')).toBe(true);
  });

  it('the secret door of R04 leads to R05 with its three spear traps', () => {
    expect(run(...toR04).seenDoors.has('s1')).toBe(false);
    const s = run(...toR05);
    expect(s.revealedRooms.has('R05')).toBe(true);
    const spears = trapsInView(level, s).filter((t) => t.id.startsWith('t-spear'));
    expect(spears.map((t) => t.id)).toEqual(
      expect.arrayContaining(['t-spear-1', 't-spear-2', 't-spear-3']),
    );
    expect(s.seenMonsters.has('m-orc-1') && s.seenMonsters.has('m-orc-6')).toBe(true);
  });

  it('G: the scepter room shows its guards and six stalactites, and the scepter has a button', () => {
    const s = run(...toR06);
    expect(fired(s, 'n-G')).toBe(true);
    const stal = trapsInView(level, s).filter((t) => t.id.startsWith('t-stal'));
    expect(stal).toHaveLength(6);
    for (const id of ['m-bear-1', 'm-dw-2', 'm-dw-3', 'm-dw-4', 'm-yeti-1'])
      expect(s.seenMonsters.has(id), id).toBe(true);
    expect(s.flags['scepterDestroyed']).toBeUndefined();
    const ask = reduce(level, s, { type: 'MANUAL_TRIGGER', note: 'n-G-scepter' });
    expect(ask.prompts.some((p) => p.kind === 'choice')).toBe(true);
  });

  it('R10 (below the scepter room) holds the mercenaries of Zargon, who keep their own kind', () => {
    const s = run(...toR10);
    for (const id of ['m-xbow-1', 'm-xbow-2', 'm-sword-1', 'm-scout-1'])
      expect(s.seenMonsters.has(id), id).toBe(true);
    const names = ['m-xbow-1', 'm-sword-1', 'm-scout-1'].map((id) => by(s, id).name);
    expect(names).toEqual(['Crossbowman', 'Swordsman', 'Scout']);
    for (const id of ['m-xbow-1', 'm-sword-1', 'm-scout-1']) {
      expect(by(s, id).box).toBe('Frozen Horror');
      expect(by(s, id).pictureType).toBeUndefined();
    }
  });

  it('Frozen Horror monsters have their own kind and no core picture; core monsters keep theirs', () => {
    const s = run(...toR07);
    for (const id of ['m-gremlin-1', 'm-yeti-2', 'm-bear-3']) {
      expect(by(s, id).box).toBe('Frozen Horror');
      expect(by(s, id).pictureType).toBeUndefined();
    }
    expect(by(s, 'm-dw-1').pictureType).toBe('dreadWarrior');
    expect(by(s, 'm-dw-1').box).toBeUndefined();
  });
});

describe('quest 8: destroying the scepter', () => {
  it('a failed attack changes nothing and the button stays; the blast is not told in advance', () => {
    const s = run(...toR06);
    const ask = reduce(level, s, { type: 'MANUAL_TRIGGER', note: 'n-G-scepter' });
    expect(JSON.stringify(ask.prompts)).not.toMatch(/explode|2 Body Points/);
    const no = reduce(level, ask.state, { type: 'CHOOSE', note: 'n-G-scepter', option: 1 }).state;
    expect(no.flags['scepterDestroyed']).toBeUndefined();
    expect(objectivesStatus(level, no).items.find((o) => o.id === 'o1')?.done).toBe(false);
    expect(() => reduce(level, no, { type: 'MANUAL_TRIGGER', note: 'n-G-scepter' })).not.toThrow();
  });

  it('a skull destroys it: the blast text, the flag and the first goal', () => {
    const s = run(...toR06);
    const ask = reduce(level, s, { type: 'MANUAL_TRIGGER', note: 'n-G-scepter' });
    const yes = reduce(level, ask.state, { type: 'CHOOSE', note: 'n-G-scepter', option: 0 });
    expect(JSON.stringify(yes.prompts)).toMatch(/2 Body Points/);
    expect(yes.state.flags['scepterDestroyed']).toBe(true);
    const obj = objectivesStatus(level, yes.state);
    expect(obj.items.find((o) => o.id === 'o1')?.done).toBe(true);
    expect(obj.goalDone).toBe(false);
  });

  it('the scepter button is on its square until it is destroyed, then it is gone', () => {
    const before = elementQuest(level, run(...toR06), 'square', '24,1');
    expect(before.buttons.map((b) => b.label)).toEqual(['A hero attacks the scepter']);
    const done = run(...toR06, ...destroy);
    expect(elementQuest(level, done, 'square', '24,1').buttons).toEqual([]);
  });

  it('leaving through the wooden door can be confirmed only after the scepter is gone', () => {
    expect(objectiveConfirms(level, run(...toR06))).toEqual([]);
    const done = run(...toR06, ...destroy);
    expect(objectiveConfirms(level, done).map((c) => c.objective)).toEqual(['o2']);
    const after = run(...toR06, ...destroy, { type: 'CONFIRM_OBJECTIVE', objective: 'o2' });
    expect(objectivesStatus(level, after).goalDone).toBe(true);
    expect(goalDoneText(level)).toContain('wooden exit door');
  });
});

describe('quest 8: hazards', () => {
  it('slippery ice and a pit spring with their own kinds', () => {
    const slip = reduce(level, run(...toR21), { type: 'TRAP_STEP', trap: 't-ice-1' });
    expect(JSON.stringify(slip.prompts)).toContain('slipperyIce');
    const pit = reduce(level, run(...toR13), { type: 'TRAP_STEP', trap: 't-pit-4' });
    expect(JSON.stringify(pit.prompts)).toContain('"pit"');
  });
});
