import { describe, expect, it } from 'vitest';
import { board } from '../board/board';
import { activeLevel, buildLevel } from '../board/level';
import { validateQuest } from '../quest/validate';
import { MAP_ONE, MAP_TWO, testMapsData, testMapsQuest } from '../quest/testMaps';
import type { GameEvent } from './events';
import { EventError, reduce, replay, startGame, undo } from './reducer';
import { monstersInPlay } from './view';

const root = buildLevel(testMapsQuest());
const SEED = 5;
const ask = (n: 1 | 2, option: number): GameEvent[] => [
  { type: 'MANUAL_TRIGGER', note: `ask${n}` },
  { type: 'CHOOSE', note: `ask${n}`, option },
];
/** Answer "Are all heroes on the stairway?" with Yes, going down (map one) or up (map two). */
const down = ask(1, 0);
const up = ask(2, 0);

/** Run events with the real reducer and keep the prompts of the last one. */
const run = (events: readonly GameEvent[]) => {
  let state = startGame(root, SEED).state;
  let prompts: ReturnType<typeof reduce>['prompts'] = [];
  for (const e of events) {
    const r = reduce(root, state, e);
    state = r.state;
    prompts = r.prompts;
  }
  return { state, prompts };
};
const code = (fn: () => unknown): string | undefined => {
  try {
    fn();
  } catch (e) {
    if (e instanceof EventError) return e.code;
    throw e;
  }
  return undefined;
};
const ids = (xs: readonly { id: string }[]) => xs.map((x) => x.id);

describe('building the levels of a two-map quest', () => {
  it('the root is map 1 and holds every map', () => {
    expect(root.quest.mapId).toBe(MAP_ONE);
    expect([...(root.maps ?? new Map()).keys()]).toEqual([MAP_ONE, MAP_TWO]);
    expect(ids(root.quest.monsters)).toEqual(['m1']);
    expect(root.maps?.get(MAP_ONE)?.maps).toBeUndefined();
  });

  it('each map is an ordinary level with its own board data and notes', () => {
    const one = activeLevel(root, { map: MAP_ONE });
    const two = activeLevel(root, { map: MAP_TWO });
    expect(ids(one.quest.monsters)).toEqual(['m1']);
    expect(ids(two.quest.monsters)).toEqual(['m2']);
    expect([...one.doors.keys()].sort()).toEqual(['d2', 'd3']);
    expect([...two.doors.keys()]).toEqual(['e1']);
    expect(two.quest.mapName).toBe('The Lower Hall');
    expect(two.quest.start).toEqual({ area: 'R01', kind: 'stairway' });
    // a note with a map is only on its map; a note with none is on both
    expect(ids(one.quest.notes).sort()).toEqual(['ask1', 'key', 'rev17']);
    expect(ids(two.quest.notes).sort()).toEqual(['ask2', 'key', 'rev02']);
  });

  it('a state with no map gives map 1, and a single-map level is its own active level', () => {
    expect(activeLevel(root, {})).toBe(root.maps?.get(MAP_ONE));
    const plain = buildLevel(testMapsQuest({ maps: undefined, links: undefined, notes: [] }));
    expect(plain.maps).toBeUndefined();
    expect(activeLevel(plain, { map: 'x' })).toBe(plain);
  });

  it('the game starts on map 1 and reveals its start room', () => {
    const { state } = startGame(root, SEED);
    expect(state.map).toBe(MAP_ONE);
    expect(state.revealedRooms.has('R20')).toBe(true);
    expect(state.seenFurniture.has('st1')).toBe(true);
  });
});

describe('crossing', () => {
  it('"No" stays; "Yes" crosses, reveals the arrival room and keeps the turn', () => {
    const stay = run(ask(1, 1));
    expect(stay.state.map).toBe(MAP_ONE);
    expect(stay.prompts.some((p) => p.kind === 'crossed')).toBe(false);

    const r = run([{ type: 'ZARGON_TURN_END' }, ...down]);
    expect(r.state.map).toBe(MAP_TWO);
    expect(r.state.turn).toBe(2);
    expect(r.prompts[0]).toEqual({ kind: 'crossed', map: MAP_TWO, name: 'The Lower Hall' });
    expect(r.prompts.some((p) => p.kind === 'revealed')).toBe(true);
    // the whole arrival room: its stairway and the closed door on its wall; nothing of map 1
    expect(r.state.revealedRooms).toEqual(new Set(['R01']));
    expect(r.state.seenFurniture).toEqual(new Set(['st2']));
    expect(r.state.seenDoors.has('e1')).toBe(true);
    expect(r.state.seenDoors.has('d2')).toBe(false);
    expect(r.state.seenMonsters.has('m2')).toBe(false);
  });

  it('can go back; the arrival is the stairway of map 1', () => {
    const r = run([...down, ...up]);
    expect(r.state.map).toBe(MAP_ONE);
    expect(r.state.revealedRooms).toEqual(new Set(['R20']));
    expect(r.state.arrival).toEqual({ map: MAP_ONE, cell: [1, 15] });
  });

  it('the CROSS_MAP event crosses the same way; an unknown link is refused', () => {
    const r = run([{ type: 'CROSS_MAP', link: 'l1' }]);
    expect(r.state.map).toBe(MAP_TWO);
    expect(r.state.revealedRooms).toEqual(new Set(['R01']));
    expect(code(() => run([{ type: 'CROSS_MAP', link: 'nope' }]))).toBe('UNKNOWN_LINK');
    const back = run([
      { type: 'CROSS_MAP', link: 'l1' },
      { type: 'CROSS_MAP', link: 'l1' },
    ]);
    expect(back.state.map).toBe(MAP_ONE);
  });

  it('a note of the other map cannot be used here', () => {
    expect(code(() => run([{ type: 'MANUAL_TRIGGER', note: 'ask2' }]))).toBe('UNKNOWN_NOTE');
  });

  it('doors close and the fog resets, but the damage stays', () => {
    const open: GameEvent[] = [
      { type: 'OPEN_DOOR', door: 'd2' },
      { type: 'MONSTER_DAMAGE', monster: 'm1', amount: 1 },
    ];
    const before = run(open).state;
    expect(before.openDoors.has('d2')).toBe(true);
    expect(before.monsters.m1).toEqual({ body: 1, dead: false });

    const below = run([...open, ...down]).state;
    expect(below.openDoors.size).toBe(0);
    // the monster of the map left behind is fog, but its record (the wounds) is kept
    expect(below.seenMonsters.has('m1')).toBe(false);
    expect(below.seenCells.has('6,15')).toBe(false);
    expect(below.monsters.m1).toEqual({ body: 1, dead: false });

    // back on map 1: the room is fog again, the door is closed, the monster keeps its wounds
    const again = run([...open, ...down, ...up]).state;
    expect(again.map).toBe(MAP_ONE);
    expect(again.openDoors.has('d2')).toBe(false);
    expect(again.revealedRooms).toEqual(new Set(['R20']));
    expect(again.monsters.m1).toEqual({ body: 1, dead: false });
    // opening the door shows the same monster, not a new one
    const reopened = run([...open, ...down, ...up, { type: 'OPEN_DOOR', door: 'd2' }]).state;
    expect(reopened.monsters.m1).toEqual({ body: 1, dead: false });
    expect(reopened.seenMonsters.has('m1')).toBe(true);
  });

  it('a kill, a fired note and a flag stay across maps', () => {
    const killed: GameEvent[] = [
      { type: 'OPEN_DOOR', door: 'd2' },
      { type: 'MONSTER_KILL', monster: 'm1' },
    ];
    const s = run([...killed, ...down]).state;
    expect(s.flags.key).toBe(true);
    expect(s.notesFired).toContain('key');
    expect(s.monsters.m1?.dead).toBe(true);
    // the roster of this map has nothing in it yet
    expect(monstersInPlay(activeLevel(root, s), s)).toEqual([]);
    const back = run([...killed, ...down, ...up]).state;
    expect(back.monsters.m1?.dead).toBe(true);
    expect(back.flags.key).toBe(true);
  });

  it('found secret doors stay found; opened doors do not', () => {
    const rt = buildLevel(testMapsQuest({ secretDoors: [{ id: 's1', a: [8, 17], b: [9, 17] }] }));
    let s = startGame(rt, SEED).state;
    s = reduce(rt, s, { type: 'OPEN_DOOR', door: 'd2' }).state;
    s = reduce(rt, s, { type: 'SEARCH_SECRET_DOORS', area: 'R17', override: true }).state;
    expect(s.seenDoors.has('s1')).toBe(true);
    s = reduce(rt, s, { type: 'OPEN_DOOR', door: 's1' }).state;
    s = reduce(rt, s, { type: 'CROSS_MAP', link: 'l1' }).state;
    expect(s.seenDoors.has('s1')).toBe(true);
    expect(s.openDoors.size).toBe(0);
    expect(s.seenDoors.has('d2')).toBe(false);
  });

  it('a dead hero stays dead', () => {
    const s = run([{ type: 'HERO_DIED', hero: 'dwarf' }, ...down]).state;
    expect(s.deadHeroes).toEqual(['dwarf']);
  });

  it('the arrival fires the notes of the room it reveals, once', () => {
    const rt = buildLevel(
      testMapsQuest({
        notes: [
          ...testMapsData.notes,
          {
            id: 'arrive',
            map: MAP_TWO,
            letter: 'C',
            trigger: { type: 'areaRevealed', area: 'R01' },
            effects: [{ type: 'showText', text: 'The stairs end here.' }],
          },
        ],
      }),
    );
    const cross = (s: ReturnType<typeof startGame>['state']) =>
      reduce(rt, s, { type: 'CROSS_MAP', link: 'l1' });
    const noteIds = (p: ReturnType<typeof cross>['prompts']) =>
      p.flatMap((x) => (x.kind === 'note' ? [x.noteId] : []));
    const a = cross(startGame(rt, SEED).state);
    expect(noteIds(a.prompts)).toEqual(['arrive']);
    const c = cross(cross(a.state).state);
    expect(noteIds(c.prompts)).toEqual([]);
  });
});

describe('what belongs to a map stays with its map', () => {
  it('searched rooms and fallen blocks wait for their map', () => {
    const rt = buildLevel(
      testMapsQuest({
        notes: [
          ...testMapsData.notes,
          {
            id: 'drop',
            map: MAP_ONE,
            trigger: { type: 'manual', label: 'Drop a block' },
            effects: [{ type: 'placeBlock', cells: [[2, 17]] }],
          },
        ],
      }),
    );
    let s = startGame(rt, SEED).state;
    s = reduce(rt, s, { type: 'MANUAL_TRIGGER', note: 'drop' }).state;
    s = reduce(rt, s, { type: 'SEARCH_TREASURE', room: 'R20', hero: 'dwarf' }).state;
    expect([...s.placedBlocks]).toEqual(['2,17']);
    expect(s.treasureSearched.R20).toEqual(['dwarf']);
    s = reduce(rt, s, { type: 'CROSS_MAP', link: 'l1' }).state;
    expect(s.placedBlocks.size).toBe(0);
    expect(s.treasureSearched).toEqual({});
    s = reduce(rt, s, { type: 'CROSS_MAP', link: 'l1' }).state;
    expect([...s.placedBlocks]).toEqual(['2,17']);
    expect(s.treasureSearched.R20).toEqual(['dwarf']);
  });

  it('a wandering monster without a square is gone on crossing; one with a square waits on its map', () => {
    const base: GameEvent[] = [
      { type: 'SEARCH_TREASURE', room: 'R20', hero: 'dwarf' },
      { type: 'WANDERING_MONSTER', room: 'R20', hero: 'dwarf' },
      { type: 'WANDERING_MONSTER', room: 'R20', hero: 'dwarf', cell: [2, 16] },
    ];
    const roster = (s: ReturnType<typeof run>['state']) =>
      ids(monstersInPlay(activeLevel(root, s), s));
    const here = run(base).state;
    expect(roster(here)).toEqual(['w1', 'w2']);

    const below = run([...base, ...down]).state;
    expect(Object.keys(below.wanderers)).toEqual(['w2']);
    expect(below.monsters.w1).toBeUndefined();
    expect(below.seenMonsters.has('w1')).toBe(false);
    // the one with a square is on map one, not here
    expect(roster(below)).toEqual([]);

    const back = run([...base, ...down, ...up]).state;
    expect(roster(back)).toEqual(['w2']);
    // a wanderer that comes on map two belongs to map two
    const onTwo = run([...down, { type: 'WANDERING_MONSTER', room: 'R01', hero: 'dwarf' }]).state;
    expect(onTwo.wanderers.w1?.map).toBe(MAP_TWO);
    expect(roster(onTwo)).toEqual(['w1']);
  });
});

describe('undo and replay', () => {
  const log: GameEvent[] = [
    { type: 'OPEN_DOOR', door: 'd2' },
    { type: 'MONSTER_DAMAGE', monster: 'm1', amount: 1 },
    ...down,
    { type: 'OPEN_DOOR', door: 'e1' },
    { type: 'MONSTER_KILL', monster: 'm2' },
  ];

  it('replay gives the same state as playing it live', () => {
    let live = startGame(root, SEED).state;
    for (const e of log) live = reduce(root, live, e).state;
    expect(replay(root, SEED, log)).toEqual(live);
    expect(live.map).toBe(MAP_TWO);
  });

  it('undo of the crossing brings back map 1 and the fog of map 1', () => {
    const r = undo(root, SEED, log.slice(0, 4));
    expect(r.events).toHaveLength(3);
    expect(r.state).toEqual(replay(root, SEED, log.slice(0, 3)));
    // the answer was undone: the question is waiting again, on map 1
    expect(r.state.map).toBe(MAP_ONE);
    expect(r.state.openDoors.has('d2')).toBe(true);
    expect(r.state.pendingChoices).toHaveLength(1);
  });
});

describe('validation of a two-map quest', () => {
  const errors = (patch: Record<string, unknown>) =>
    validateQuest(testMapsQuest(patch), board).join('\n');

  it('the fixture is valid', () => {
    expect(errors({})).toBe('');
  });

  it('a link with a missing end does not parse', () => {
    expect(() =>
      testMapsQuest({ links: [{ id: 'l1', a: { map: MAP_ONE, cell: [1, 15] } }] }),
    ).toThrow(/links/);
  });

  it('a link to an unknown map, to the same map, or off a stairway is an error', () => {
    const link = (b: unknown) => ({
      links: [{ id: 'l1', a: { map: MAP_ONE, cell: [1, 15] }, b }],
    });
    expect(errors(link({ map: 'three', cell: [1, 1] }))).toMatch(/unknown map three/);
    expect(errors(link({ map: MAP_ONE, cell: [1, 16] }))).toMatch(/both ends are on map one/);
    expect(errors(link({ map: MAP_TWO, cell: [3, 3] }))).toMatch(/not on a stairway/);
  });

  it('an id used on two maps is a duplicate', () => {
    const e = errors({
      maps: [
        {
          ...testMapsData.maps[0],
          monsters: [{ id: 'm1', type: 'goblin', cell: [6, 2] }],
          doors: [{ id: 'd2', a: [4, 2], b: [5, 2] }],
        },
      ],
    });
    expect(e).toMatch(/monsters: duplicate id m1/);
    expect(e).toMatch(/doors: duplicate id d2/);
  });

  it('a note letter used on two maps is an error', () => {
    const e = errors({
      notes: testMapsData.notes.map((n) => (n.id === 'rev02' ? { ...n, letter: 'A' } : n)),
    });
    expect(e).toMatch(/letter A is also used on map one/);
  });

  it('map ids, the map of a note, and a room note without a map', () => {
    expect(errors({ mapId: undefined })).toMatch(/needs the id of map 1/);
    expect(errors({ maps: [{ ...testMapsData.maps[0], id: MAP_ONE }] })).toMatch(
      /duplicate map id one/,
    );
    const note = (extra: object) => ({
      id: 'x',
      trigger: { type: 'areaRevealed', area: 'R17' },
      effects: [{ type: 'showText', text: 'x' }],
      ...extra,
    });
    expect(errors({ notes: [...testMapsData.notes, note({ map: 'nine' })] })).toMatch(
      /unknown map nine/,
    );
    expect(errors({ notes: [...testMapsData.notes, note({})] })).toMatch(/needs a map/);
  });

  it('a crossMap effect needs a real link, and a flag set on another map counts', () => {
    const bad = testMapsData.notes.map((n) =>
      n.id === 'ask1' ? { ...n, effects: [{ type: 'crossMap', link: 'zz' }] } : n,
    );
    expect(errors({ notes: bad })).toMatch(/unknown link zz/);
    expect(
      errors({
        doors: [{ id: 'd2', a: [4, 15], b: [5, 15], lockedUntil: 'from2' }],
        notes: [
          ...testMapsData.notes,
          {
            id: 'set2',
            map: MAP_TWO,
            trigger: { type: 'manual', label: 'x' },
            effects: [{ type: 'setFlag', flag: 'from2', value: true }],
          },
        ],
      }),
    ).toBe('');
  });
});
