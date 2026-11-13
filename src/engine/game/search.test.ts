import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildLevel } from '../board/level';
import type { Hero } from '../data/heroes';
import { parseQuest } from '../quest/loader';
import { testQuest } from '../quest/testQuest';
import type { GameEvent } from './events';
import { EventError, initialState, reduce, replay, undo, type Prompt } from './reducer';
import { draftOf } from './state';
import { monstersInPlay, roomsSearchable, searchState, trapsInView } from './view';

const SEED = 11;
const open = (door: string): GameEvent => ({ type: 'OPEN_DOOR', door });
const kill = (monster: string): GameEvent => ({ type: 'MONSTER_KILL', monster });
const treasure = (room: string, hero: Hero, override?: boolean): GameEvent => ({
  type: 'SEARCH_TREASURE',
  room,
  hero,
  ...(override !== undefined ? { override } : {}),
});
const wander = (room: string, hero: Hero): GameEvent => ({
  type: 'WANDERING_MONSTER',
  room,
  hero,
});
const secrets = (area?: string, cell?: [number, number], override?: boolean): GameEvent => ({
  type: 'SEARCH_SECRET_DOORS',
  hero: 'elf',
  ...(area !== undefined ? { area } : {}),
  ...(cell !== undefined ? { cell } : {}),
  ...(override !== undefined ? { override } : {}),
});
const code = (fn: () => unknown): string | undefined => {
  try {
    fn();
  } catch (e) {
    if (e instanceof EventError) return e.code;
    throw e;
  }
  return undefined;
};
const kinds = (ps: readonly Prompt[]) => ps.map((p) => p.kind);

// Fixture: R17 holds orc m1 (6,15), chest f1 with chest trap t2, pit t1. Open d2 to see it.
const fx = buildLevel(testQuest());
const intoR17 = [open('d2'), kill('m1')];

describe('SEARCH_TREASURE: validation', () => {
  it('rejects corridors, unknown areas, unrevealed rooms and unknown heroes', () => {
    const s = replay(fx, SEED, []);
    expect(code(() => reduce(fx, s, treasure('C', 'elf')))).toBe('NOT_A_ROOM');
    expect(code(() => reduce(fx, s, treasure('R99', 'elf')))).toBe('BAD_AREA');
    expect(code(() => reduce(fx, s, treasure('R17', 'elf')))).toBe('ROOM_NOT_REVEALED');
    const bad = { type: 'SEARCH_TREASURE', room: 'R20', hero: 'knight' } as unknown as GameEvent;
    expect(code(() => reduce(fx, s, bad))).toBe('UNKNOWN_HERO');
  });

  it('a hero searches a room once; another hero can search it', () => {
    const s = replay(fx, SEED, [treasure('R20', 'elf')]);
    expect(s.treasureSearched).toEqual({ R20: ['elf'] });
    expect(code(() => reduce(fx, s, treasure('R20', 'elf')))).toBe('ALREADY_SEARCHED');
    expect(code(() => reduce(fx, s, treasure('R20', 'elf', true)))).toBe('ALREADY_SEARCHED');
    const t = reduce(fx, s, treasure('R20', 'dwarf')).state;
    expect(t.treasureSearched.R20).toEqual(['elf', 'dwarf']);
  });

  it('no note and no trap: draw a card', () => {
    const r = reduce(fx, replay(fx, SEED, []), treasure('R20', 'elf'));
    expect(r.prompts).toEqual([{ kind: 'drawCard' }]);
  });
});

describe('SEARCH_TREASURE: monsters in the room guard', () => {
  it('rejects while a seen, living monster started in the room', () => {
    const s = replay(fx, SEED, [open('d2')]);
    expect(code(() => reduce(fx, s, treasure('R17', 'elf')))).toBe('MONSTERS_IN_ROOM');
    expect(searchState(fx, s, 'R17').monstersInRoom).toEqual(['m1']);
  });

  it('override lets the search through', () => {
    const s = replay(fx, SEED, [open('d2')]);
    expect(reduce(fx, s, treasure('R17', 'elf', true)).prompts.at(-1)).toEqual({
      kind: 'drawCard',
    });
    expect(code(() => reduce(fx, s, treasure('R17', 'elf', false)))).toBe('MONSTERS_IN_ROOM');
  });

  it('a dead monster, an unseen monster or a monster of another room does not block', () => {
    expect(code(() => reduce(fx, replay(fx, SEED, intoR17), treasure('R17', 'elf')))).toBe(
      undefined,
    );
    const s = replay(fx, SEED, [open('d2'), kill('m1'), open('d3')]);
    expect(searchState(fx, s, 'R17').monstersInRoom).toEqual([]);
    expect(searchState(fx, s, 'R18').monstersInRoom).toEqual(['m2']);
    // m2 exists in R18 but R19 is not revealed: nothing to guard there
    expect(searchState(fx, replay(fx, SEED, []), 'R18').monstersInRoom).toEqual([]);
  });

  it('a living wandering monster counts in its room; override bypasses; dead ones do not', () => {
    const lv = buildLevel(testQuest({ wandering: { monster: 'orc' } }));
    const s = replay(lv, SEED, [open('d2'), kill('m1'), wander('R17', 'elf')]);
    expect(searchState(lv, s, 'R17').monstersInRoom).toEqual(['w1']);
    expect(searchState(lv, s, 'R20').monstersInRoom).toEqual([]);
    expect(code(() => reduce(lv, s, treasure('R17', 'dwarf')))).toBe('MONSTERS_IN_ROOM');
    expect(code(() => reduce(lv, s, secrets('R17')))).toBe('MONSTERS_IN_ROOM');
    expect(code(() => reduce(lv, s, treasure('R17', 'dwarf', true)))).toBeUndefined();
    const dead = reduce(lv, s, kill('w1')).state;
    expect(searchState(lv, dead, 'R17').monstersInRoom).toEqual([]);
    expect(code(() => reduce(lv, dead, treasure('R17', 'dwarf')))).toBeUndefined();
  });

  it('a wanderer in a room in sight blocks a corridor secret door search', () => {
    const lv = buildLevel(
      testQuest({
        wandering: { monster: 'orc' },
        secretDoors: [{ id: 's2', a: [2, 17], b: [2, 18] }],
      }),
    );
    // R20 is the start room; the hero looks from the corridor through the open door d1.
    const s = replay(lv, SEED, [open('d1'), wander('R20', 'elf')]);
    expect(code(() => reduce(lv, s, secrets(undefined, [3, 18])))).toBe('MONSTERS_IN_ROOM');
    expect(code(() => reduce(lv, s, secrets(undefined, [3, 18], true)))).toBeUndefined();
    // a wanderer in a room the cell cannot see does not block
    const t = replay(lv, SEED, [open('d1'), open('d2'), wander('R17', 'elf')]);
    expect(code(() => reduce(lv, t, secrets(undefined, [0, 18])))).toBeUndefined();
  });

  it('a chest trap is found when any square of its furniture is in the room', () => {
    // f1 spans (6,14),(7,14): both in R17. Make a table that starts in R17 but whose first
    // square is in another room by listing the cells in the other order.
    const lv = buildLevel(
      testQuest({
        furniture: [
          {
            id: 'f1',
            type: 'table',
            cells: [
              [4, 14],
              [5, 14],
            ],
          },
        ],
      }),
    );
    const s = replay(lv, SEED, [open('d2'), kill('m1')]);
    const r = reduce(lv, s, treasure('R17', 'elf'));
    expect(kinds(r.prompts)).toEqual(['trapSprung', 'drawCard']);
  });

  it('roomsSearchable lists the revealed rooms', () => {
    const s = replay(fx, SEED, [treasure('R20', 'elf'), open('d2')]);
    const list = roomsSearchable(fx, s);
    expect(list.map((r) => r.room).sort()).toEqual(['R17', 'R20']);
    expect(list.find((r) => r.room === 'R20')?.searchedBy).toEqual(['elf']);
  });
});

describe('SEARCH_TREASURE: chest trap order', () => {
  it('an armed chest trap springs first, then the search goes on', () => {
    const s = replay(fx, SEED, intoR17);
    const r = reduce(fx, s, treasure('R17', 'elf'));
    expect(kinds(r.prompts)).toEqual(['trapSprung', 'drawCard']);
    expect(r.prompts[0]).toMatchObject({ trap: 't2', trapKind: 'chest', via: 'search' });
    expect(r.state.trapStates.t2).toBe('sprung');
    // the other heroes find it gone
    const r2 = reduce(fx, r.state, treasure('R17', 'dwarf'));
    expect(kinds(r2.prompts)).toEqual(['drawCard']);
  });

  it('a disarmed chest trap does not spring', () => {
    const s = replay(fx, SEED, [
      ...intoR17,
      { type: 'SEARCH_TRAPS', furniture: 'f1' },
      { type: 'TRAP_DISARM', trap: 't2', by: 'dwarf', result: 'other' },
    ]);
    expect(kinds(reduce(fx, s, treasure('R17', 'elf')).prompts)).toEqual(['drawCard']);
  });

  it('prompt order is trap, note, draw', () => {
    const lv = buildLevel(
      testQuest({
        traps: [{ id: 't2', kind: 'chest', furniture: 'f1', effect: 'Zap.' }],
        notes: [
          {
            id: 'n1',
            letter: 'A',
            trigger: { type: 'treasureSearch', area: 'R17' },
            effects: [{ type: 'showText', text: 'A dusty shelf.' }],
          },
        ],
      }),
    );
    const r = reduce(lv, replay(lv, SEED, intoR17), treasure('R17', 'elf'));
    expect(kinds(r.prompts)).toEqual(['trapSprung', 'note', 'drawCard']);
    expect(r.prompts[0]).toMatchObject({ effect: 'Zap.' });
  });
});

describe('SEARCH_TREASURE: notes', () => {
  const lv = buildLevel(
    testQuest({
      notes: [
        {
          id: 'first-empty',
          letter: 'A',
          trigger: { type: 'treasureSearch', area: 'R20', first: true },
          effects: [{ type: 'showText', text: 'Empty.' }],
          consumesTreasure: true,
        },
        {
          id: 'always',
          trigger: { type: 'treasureSearch', area: 'R20' },
          effects: [
            { type: 'showText', text: 'A draught.' },
            { type: 'giveItem', text: 'a key' },
          ],
        },
        {
          id: 'conditional',
          trigger: { type: 'treasureSearch', area: 'R20' },
          when: [
            { flag: 'x', is: true },
            { counter: 'c', gte: 1 },
          ],
          effects: [{ type: 'showText', text: 'Conditional.' }],
        },
        {
          id: 'other-room',
          trigger: { type: 'treasureSearch', area: 'R17', first: true },
          effects: [{ type: 'showText', text: 'Elsewhere.' }],
        },
      ],
    }),
  );

  it('first-only notes fire for the first searcher only; others fire for everyone', () => {
    const a = reduce(lv, replay(lv, SEED, []), treasure('R20', 'elf'));
    // consumed: no card. Unknown conditions are ignored, not a crash.
    expect(a.prompts).toEqual([
      {
        kind: 'note',
        noteId: 'first-empty',
        letter: 'A',
        texts: ['Empty.'],
        consumesTreasure: true,
      },
      { kind: 'note', noteId: 'always', texts: ['A draught.', 'a key'], consumesTreasure: false },
      { kind: 'note', noteId: 'conditional', texts: ['Conditional.'], consumesTreasure: false },
    ]);
    expect(a.state.notesFired).toEqual(['first-empty', 'always', 'conditional']);

    const b = reduce(lv, a.state, treasure('R20', 'dwarf'));
    expect(b.prompts.map((p) => (p.kind === 'note' ? p.noteId : p.kind))).toEqual([
      'always',
      'conditional',
      'drawCard',
    ]);
    expect(b.state.notesFired).toEqual(['first-empty', 'always', 'conditional']); // each id once
  });

  it('first means the first search by anyone', () => {
    const lv2 = buildLevel(testQuest({ notes: [lv.quest.notes[0]!] }));
    const s = replay(lv2, SEED, [treasure('R20', 'wizard')]);
    expect(kinds(reduce(lv2, s, treasure('R20', 'elf')).prompts)).toEqual(['drawCard']);
  });
});

describe('SEARCH_TREASURE: quest 1 notes A and D (decision 17)', () => {
  const q1 = parseQuest(
    JSON.parse(
      readFileSync(resolve(import.meta.dirname, '../../content/quests/q01-the-trial.json'), 'utf8'),
    ),
  );
  const lv = buildLevel(q1);
  const toR18: GameEvent[] = [open('d1'), open('d2'), open('d3')];

  it('note A: the first searcher gets nothing, the next one draws a card', () => {
    const s = replay(lv, 1, toR18);
    expect(s.revealedRooms.has('R18')).toBe(true);
    expect(code(() => reduce(lv, s, treasure('R18', 'barbarian')))).toBe('MONSTERS_IN_ROOM');
    const a = reduce(lv, s, treasure('R18', 'barbarian', true));
    expect(a.prompts).toHaveLength(1);
    expect(a.prompts[0]).toMatchObject({
      kind: 'note',
      noteId: 'n-A',
      letter: 'A',
      consumesTreasure: true,
    });
    const b = reduce(lv, a.state, treasure('R18', 'elf', true));
    expect(kinds(b.prompts)).toEqual(['drawCard']);
    expect(b.state.notesFired).toEqual(['n-A']);
  });

  it('note D: the first searcher gets the gold text and item, the next one draws', () => {
    const d = draftOf(initialState(lv, 1));
    d.revealedRooms.add('R03'); // monsters of the room are not seen in this hand-made state
    const a = reduce(lv, d, treasure('R03', 'dwarf'));
    expect(a.prompts).toEqual([
      expect.objectContaining({
        kind: 'note',
        noteId: 'n-D',
        letter: 'D',
        texts: [expect.stringContaining('84 gold'), '84 gold coins'],
        consumesTreasure: true,
      }),
    ]);
    const b = reduce(lv, a.state, treasure('R03', 'wizard'));
    expect(b.prompts).toEqual([{ kind: 'drawCard' }]);
  });
});

describe('WANDERING_MONSTER', () => {
  const lv = buildLevel(testQuest({ wandering: { monster: 'orc' } }));
  const ready: GameEvent[] = [open('d2'), kill('m1')];

  it('adds a monster to the roster with no square, ids w1, w2...', () => {
    const r = reduce(lv, replay(lv, SEED, ready), wander('R17', 'elf'));
    expect(r.prompts).toEqual([
      {
        kind: 'wanderingMonster',
        monster: 'w1',
        monsterType: 'orc',
        hero: 'elf',
        room: 'R17',
        placement: {
          nextToHero: 'elf',
          attacksAtOnce: true,
          ifNoFreeSquare: { closestInRoom: 'R17', actsNextZargonTurn: true },
        },
      },
    ]);
    const r2 = reduce(lv, r.state, wander('R17', 'wizard'));
    expect(r2.prompts[0]).toMatchObject({ monster: 'w2' });
    const roster = monstersInPlay(lv, r2.state).filter((m) => m.wandering);
    expect(roster.map((m) => m.id)).toEqual(['w1', 'w2']);
    expect(roster[0]).toMatchObject({
      type: 'orc',
      name: 'Orc',
      wanderAt: 'elf',
      fresh: true,
      body: 1,
      maxBody: 1,
      dead: false,
      stats: { att: 3, def: 2, body: 1, mind: 2, move: 8 },
    });
    expect(Object.keys(r2.state.wanderers.w1!)).not.toContain('cell');
  });

  it('ZARGON_TURN_END clears fresh and keeps wandering', () => {
    let s = replay(lv, SEED, [...ready, wander('R17', 'elf')]);
    s = reduce(lv, s, { type: 'ZARGON_TURN_END' }).state;
    const w = monstersInPlay(lv, s).find((m) => m.id === 'w1');
    expect(w).toMatchObject({ wandering: true, fresh: false, wanderAt: 'elf' });
    expect(s.turn).toBe(2);
  });

  it('wounds and kills work on a wanderer', () => {
    const s = replay(lv, SEED, [...ready, wander('R17', 'elf'), kill('w1')]);
    expect(monstersInPlay(lv, s).find((m) => m.id === 'w1')?.dead).toBe(true);
  });

  it('is deterministic, survives undo and replay, and does not use the rng', () => {
    const events = [...ready, wander('R17', 'elf'), wander('R17', 'dwarf')];
    const a = replay(lv, SEED, events);
    expect(replay(lv, SEED, events)).toEqual(a);
    expect(a.rng).toBe(initialState(lv, SEED).rng);
    const u = undo(lv, SEED, events);
    expect(Object.keys(u.state.wanderers)).toEqual(['w1']);
    const again = reduce(lv, u.state, wander('R17', 'dwarf')).state;
    expect(again).toEqual(a);
  });

  it('skips an id that the quest already uses', () => {
    const lv2 = buildLevel(
      testQuest({
        wandering: { monster: 'goblin' },
        monsters: [...testQuest().monsters, { id: 'w1', type: 'goblin', hidden: true }],
      }),
    );
    const r = reduce(lv2, replay(lv2, SEED, [open('d2')]), wander('R17', 'elf'));
    expect(r.prompts[0]).toMatchObject({ monster: 'w2' });
  });

  it('text variant: no monster, only a prompt', () => {
    const lt = buildLevel(testQuest({ wandering: { text: 'Roll for a surprise.' } }));
    const s = replay(lt, SEED, [open('d2')]);
    const r = reduce(lt, s, wander('R17', 'elf'));
    expect(r.prompts).toEqual([{ kind: 'wanderingText', text: 'Roll for a surprise.' }]);
    expect(r.state.wanderCount).toBe(0);
    expect(monstersInPlay(lt, r.state).every((m) => !m.wandering)).toBe(true);
  });

  it('rejects when the quest has none, or for a room not revealed', () => {
    expect(code(() => reduce(fx, replay(fx, SEED, [open('d2')]), wander('R17', 'elf')))).toBe(
      'NO_WANDERING',
    );
    expect(code(() => reduce(lv, replay(lv, SEED, []), wander('R17', 'elf')))).toBe(
      'ROOM_NOT_REVEALED',
    );
    expect(code(() => reduce(lv, replay(lv, SEED, []), wander('C', 'elf')))).toBe('NOT_A_ROOM');
  });
});

describe('SEARCH_SECRET_DOORS', () => {
  it('in a room: finds the secret doors on its walls, closed, then they can be opened', () => {
    const s = replay(fx, SEED, intoR17);
    expect(s.seenDoors.has('s1')).toBe(false);
    const r = reduce(fx, s, secrets('R17'));
    expect(r.prompts).toEqual([{ kind: 'secretDoorsFound', doors: ['s1'] }]);
    expect(r.state.seenDoors.has('s1')).toBe(true);
    expect(r.state.openDoors.has('s1')).toBe(false);
    expect(r.state.revealedRooms.has('R18')).toBe(false);
    const o = reduce(fx, r.state, open('s1'));
    expect(o.state.revealedRooms.has('R18')).toBe(true);
  });

  it('repeat searches are allowed and say nothing found', () => {
    const s = replay(fx, SEED, [...intoR17, secrets('R17')]);
    expect(reduce(fx, s, secrets('R17')).prompts).toEqual([{ kind: 'nothingFound' }]);
  });

  it('works from the other side of the wall too', () => {
    const s = replay(fx, SEED, [open('d2'), kill('m1'), open('d3'), kill('m2')]);
    expect(reduce(fx, s, secrets('R18')).prompts).toEqual([
      { kind: 'secretDoorsFound', doors: ['s1'] },
    ]);
  });

  it('monster guard in a room, with override', () => {
    const s = replay(fx, SEED, [open('d2')]);
    expect(code(() => reduce(fx, s, secrets('R17')))).toBe('MONSTERS_IN_ROOM');
    expect(reduce(fx, s, secrets('R17', undefined, true)).prompts[0]).toMatchObject({
      kind: 'secretDoorsFound',
    });
  });

  it('rooms not revealed, bad targets', () => {
    const s = replay(fx, SEED, []);
    expect(code(() => reduce(fx, s, secrets('R17')))).toBe('ROOM_NOT_REVEALED');
    expect(code(() => reduce(fx, s, secrets()))).toBe('BAD_TARGET');
    expect(code(() => reduce(fx, s, secrets('C')))).toBe('BAD_TARGET');
    expect(code(() => reduce(fx, s, secrets(undefined, [40, 2])))).toBe('BAD_CELL');
    expect(code(() => reduce(fx, s, secrets(undefined, [3, 18])))).toBe('NOT_A_SEEN_CORRIDOR_CELL');
  });

  describe('in a corridor', () => {
    // s2 on the wall of R20 at (2,17)|(2,18): in sight of (3,18).
    // s3 on the wall of R18 at (9,17)|(9,18): behind the block at (8,18), out of sight of (3,18).
    const lv = buildLevel(
      testQuest({
        secretDoors: [
          { id: 's2', a: [2, 17], b: [2, 18] },
          { id: 's3', a: [9, 17], b: [9, 18] },
        ],
        monsters: [...testQuest().monsters, { id: 'm4', type: 'goblin', cell: [6, 18] }],
      }),
    );
    const base: GameEvent[] = [open('d1')];

    it('finds only the secret doors touching corridor squares in sight of the cell', () => {
      const s = replay(lv, SEED, [...base, kill('m4')]);
      const r = reduce(lv, s, secrets(undefined, [3, 18]));
      expect(r.prompts).toEqual([{ kind: 'secretDoorsFound', doors: ['s2'] }]);
      expect(r.state.seenDoors.has('s3')).toBe(false);
      // from the far side of the block it is the other way round
      const d = draftOf(s);
      d.seenCells.add('9,18');
      const far = reduce(lv, d, secrets(undefined, [9, 18]));
      expect(far.prompts).toEqual([{ kind: 'secretDoorsFound', doors: ['s3'] }]);
    });

    it('a living seen monster in sight blocks it, unless override', () => {
      const s = replay(lv, SEED, base);
      expect(s.seenMonsters.has('m4')).toBe(true);
      expect(code(() => reduce(lv, s, secrets(undefined, [3, 18])))).toBe('MONSTERS_IN_ROOM');
      expect(reduce(lv, s, secrets(undefined, [3, 18], true)).prompts[0]).toMatchObject({
        kind: 'secretDoorsFound',
      });
    });

    it('a monster out of sight does not block', () => {
      const d = draftOf(replay(lv, SEED, base));
      d.seenCells.add('9,18');
      expect(code(() => reduce(lv, d, secrets(undefined, [9, 18])))).toBeUndefined();
    });
  });

  describe('notes', () => {
    const lv = buildLevel(
      testQuest({
        notes: [
          {
            id: 'none-here',
            trigger: { type: 'secretDoorSearch', area: 'R17' },
            effects: [{ type: 'showText', text: 'Only bare stone.' }],
          },
        ],
      }),
    );
    it('a text-only note replaces the result and finds nothing', () => {
      const s = replay(lv, SEED, intoR17);
      const r = reduce(lv, s, secrets('R17'));
      expect(r.prompts).toEqual([
        { kind: 'note', noteId: 'none-here', texts: ['Only bare stone.'], consumesTreasure: false },
      ]);
      expect(r.state.seenDoors.has('s1')).toBe(false);
      expect(r.state.notesFired).toEqual(['none-here']);
    });
    it('notes for other areas do not apply', () => {
      const s = replay(lv, SEED, [open('d2'), kill('m1'), open('d3'), kill('m2')]);
      expect(reduce(lv, s, secrets('R18')).prompts).toEqual([
        { kind: 'secretDoorsFound', doors: ['s1'] },
      ]);
    });
  });
});

describe('new events: undo and determinism', () => {
  const lv = buildLevel(testQuest({ wandering: { monster: 'orc' } }));
  const events: GameEvent[] = [
    open('d2'),
    kill('m1'),
    treasure('R17', 'elf'),
    secrets('R17'),
    wander('R17', 'elf'),
    { type: 'TRAP_JUMP', trap: 't1', result: 'skull' },
    { type: 'ZARGON_TURN_END' },
  ];
  it('replay is stable and every undo step equals the replay of its prefix', () => {
    const full = replay(lv, SEED, events);
    expect(replay(lv, SEED, events)).toEqual(full);
    for (let n = events.length; n > 0; n--) {
      const u = undo(lv, SEED, events.slice(0, n));
      expect(u.state).toEqual(replay(lv, SEED, events.slice(0, n - 1)));
    }
  });
  it('reduce never modifies the input state', () => {
    let s = initialState(lv, SEED);
    const snap = (x: typeof s) => JSON.stringify({ ...x, seenCells: [...x.seenCells] });
    for (const e of events) {
      const frozen = snap(s);
      const next = reduce(lv, s, e).state;
      expect(snap(s)).toBe(frozen);
      s = next;
    }
    expect(trapsInView(lv, s).find((t) => t.id === 't1')?.state).toBe('sprung');
  });
});
