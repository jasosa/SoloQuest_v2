/** Walk-through of Frozen Horror quest 0, Into the Northlands (the online prelude). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { board } from '../../engine/board/board';
import { buildLevel } from '../../engine/board/level';
import { applyCoreFile, parseCoreFile } from '../../engine/data/coreFile';
import type { GameEvent } from '../../engine/game/events';
import { lookHintCells } from '../../engine/game/hints';
import { reduce, replay, startGame } from '../../engine/game/reducer';
import { monstersInPlay, objectivesStatus, trapsInView } from '../../engine/game/view';
import { parseQuest } from '../../engine/quest/loader';
import { validateQuest } from '../../engine/quest/validate';
import { ordersFor } from '../../engine/zargon/orders';

// The Frozen Horror abilities and the Tempest spell come from the Core library files.
applyCoreFile(
  parseCoreFile(
    JSON.parse(readFileSync(resolve(import.meta.dirname, '../library/frozen-horror.json'), 'utf8')),
  )!,
);

const quest = parseQuest(
  JSON.parse(readFileSync(resolve(import.meta.dirname, 'fh00-into-the-northlands.json'), 'utf8')),
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
  for (let i = 0; i < 60; i++) {
    const s = run(...ev);
    if (s.seenDoors.has(door)) return [...ev, open(door)];
    const next = lookHintCells(level, s)[0];
    if (!next) break;
    ev.push({ type: 'LOOK_FROM', cell: next });
  }
  throw new Error(`door ${door} never seen`);
};
const tunnel = (marker: string): GameEvent => ({ type: 'MANUAL_TRIGGER', note: `n-${marker}` });

const toA: GameEvent[] = [open('in'), open('d1')];
const toR03: GameEvent[] = reach([open('in')], 'd2');
const toCage: GameEvent[] = [...toR03, open('d3')];
const toR05: GameEvent[] = reach(reach([...toR03, open('d4')], 'd5'), 'd6');
// Row 6 is blocked at (11,6) and (14,6): the way to the center room is ice tunnel 3, from
// room R09 (20,8) to the corridor at (15,6). Then door F is on the corridor, column 16.
const toCenter: GameEvent[] = reach([...toR05, open('d7'), tunnel('tun3b')], 'd8');

describe('quest 0: data', () => {
  it('is valid against the board', () => {
    expect(validateQuest(quest, board)).toEqual([]);
  });

  it('has the map of the prelude: doors, blocks, furniture, monsters, traps and tunnels', () => {
    expect(quest.edgeDoors).toHaveLength(1);
    expect(quest.doors).toHaveLength(13);
    expect(quest.blocks).toHaveLength(10);
    expect(quest.furniture.map((f) => f.type).sort()).toEqual(
      ['bookcase', 'rack', 'throne', 'tomb'].sort(),
    );
    expect(quest.monsters).toHaveLength(13);
    const kinds = quest.traps.map((t) => t.kind);
    expect(kinds.filter((k) => k === 'stalactite')).toHaveLength(8);
    expect(kinds.filter((k) => k === 'slipperyIce')).toHaveLength(2);
    expect(kinds.filter((k) => k === 'fallingBlock')).toHaveLength(1);
    expect(quest.markers).toHaveLength(6);
    expect(quest.number).toBe(0);
    expect(quest.pack).toBe('frozen-horror');
  });

  it('the two ends of each ice tunnel are paired by design', () => {
    for (const d of ['1', '2', '3'])
      expect(quest.markers.filter((m) => m.label === `Ice tunnel ${d}`)).toHaveLength(2);
  });

  it('every letter on the map has a note', () => {
    for (const l of ['A', 'B', 'C', 'D', 'E', 'F', 'G'])
      expect(
        quest.notes.some((n) => n.letter === l),
        `note ${l}`,
      ).toBe(true);
  });
});

describe('quest 0: the start', () => {
  it('the hero stands outside the iron door of the cave and sees only that door', () => {
    const { state, prompts } = startGame(level, 1);
    expect([...state.seenDoors]).toEqual(['in']);
    expect(state.seenCells.size).toBe(0);
    expect(fired(state, 'n-start')).toBe(true);
    expect(JSON.stringify(prompts)).toContain('Snowdasher');
  });

  it('opening it shows the corridor to the first door and the slippery ice on the way', () => {
    const s = run(open('in'));
    for (const x of [6, 7, 8, 9]) expect(s.seenCells.has(`${x},9`)).toBe(true);
    expect(s.seenDoors.has('d1')).toBe(true);
    expect(trapsInView(level, s).map((t) => t.id)).toContain('t-ice-1');
  });
});

describe('quest 0: rooms and notes', () => {
  it('A: a gremlin among the remains, and a backpack in the search', () => {
    const s = run(...toA);
    expect(fired(s, 'n-A')).toBe(true);
    expect(s.seenMonsters.has('m-gremlin-a')).toBe(true);
    expect(fired(run(...toA, search('R14')), 'n-A-search')).toBe(true);
  });

  it('C: the cage room, a passive Warbear, a lever button and a longsword', () => {
    const s = run(...toCage);
    expect(fired(s, 'n-C')).toBe(true);
    const bear = monstersInPlay(level, s).find((m) => m.id === 'm-bear')!;
    expect(bear.state).toBe('passive');
    expect(bear.name).toBe('Polar Warbear');
    expect(ordersFor(level, s, ['dwarf']).find((o) => o.monster === 'm-bear')?.status).toBe(
      'stone',
    );
    const lever = reduce(level, s, { type: 'MANUAL_TRIGGER', note: 'n-C-lever' });
    expect(lever.state.flags['cageOpen']).toBe(true);
    // "It left" takes it off the roster, not as a kill
    const left = run(...toCage, { type: 'MONSTER_LEAVE', monster: 'm-bear', reason: 'freed' });
    expect(monstersInPlay(level, left).some((m) => m.id === 'm-bear')).toBe(false);
    expect(left.monsters['m-bear']?.dead).toBe(false);
    expect(fired(run(...toCage, search('R02')), 'n-C-search')).toBe(true);
  });

  it('the cage room and the top row of R08 are one room', () => {
    expect(level.board.cells[4]?.[6]).toBe('R02');
    expect(level.board.cells[8]?.[6]).toBe('R02'); // the rest of R08 joins too, but it is rock
    expect(level.rock.has('6,8')).toBe(true);
  });

  it('D: the tomb room, with the two skeletons and the bracers', () => {
    const s = run(...toR05);
    expect(s.seenMonsters.has('m-skel-1') && s.seenMonsters.has('m-skel-2')).toBe(true);
    expect(fired(run(...toR05, search('R05')), 'n-D')).toBe(true);
  });

  it('F and G: door F lets out the cold, the center room has Jracksfot and a Yeti', () => {
    const s = run(...toCenter);
    expect(fired(s, 'n-F')).toBe(true);
    expect(fired(s, 'n-G')).toBe(true);
    expect(s.seenMonsters.has('m-jrack') && s.seenMonsters.has('m-yeti-1')).toBe(true);
  });

  it('Jracksfot is a caster with Tempest, the Yeti a plain brute, the Gremlin a thief', () => {
    const s = run(...toCenter);
    const orders = ordersFor(level, s, ['dwarf']);
    const jr = orders.find((o) => o.monster === 'm-jrack')!;
    expect(jr.profile).toBe('caster');
    expect(jr.spell?.spell).toBe('tempest');
    const yeti = orders.find((o) => o.monster === 'm-yeti-1')!;
    expect(yeti.profile).toBe('fighter');
    expect(yeti.special.join(' ')).toMatch(/does not hug/);
    expect(JSON.stringify(yeti)).not.toMatch(/Bear hug/);
    const thief = ordersFor(level, run(...toA), ['dwarf']).find(
      (o) => o.monster === 'm-gremlin-a',
    )!;
    expect(thief.profile).toBe('thief');
  });

  it('killing Jracksfot melts the throne, completes the goal and allows the exit', () => {
    const s = run(...toCenter);
    expect(objectivesStatus(level, s).goalDone).toBe(false);
    const dead = reduce(level, s, { type: 'MONSTER_KILL', monster: 'm-jrack' }).state;
    expect(fired(dead, 'n-throne')).toBe(true);
    expect(dead.flags['throneMelted']).toBe(true);
    expect(objectivesStatus(level, dead).items.find((o) => o.id === 'o1')?.done).toBe(true);
    expect(fired(run(...toCenter, search('R11')), 'n-G-search')).toBe(true);
  });
});

describe('quest 0: hazards', () => {
  it('the slippery ice springs with its kind told at the spring', () => {
    const r = reduce(level, run(open('in')), { type: 'TRAP_STEP', trap: 't-ice-1' });
    expect(JSON.stringify(r.prompts)).toContain('slipperyIce');
  });
});
