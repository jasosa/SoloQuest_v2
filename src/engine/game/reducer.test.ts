import { describe, expect, it } from 'vitest';
import { board, cellsOf } from '../board/board';
import { buildLevel } from '../board/level';
import { testQuest } from '../quest/testQuest';
import type { GameEvent } from './events';
import { EventError, initialState, reduce, replay, undo } from './reducer';
import { nextInt } from './rng';
import { draftOf, type GameState } from './state';

const level = buildLevel(testQuest());
const SEED = 42;
const open = (door: string): GameEvent => ({ type: 'OPEN_DOOR', door });
const look = (x: number, y: number): GameEvent => ({ type: 'LOOK_FROM', cell: [x, y] });

const run = (...events: GameEvent[]) => replay(level, SEED, events);
const seen = (s: GameState, x: number, y: number) => s.seenCells.has(`${x},${y}`);

describe('initial state', () => {
  const s = initialState(level, SEED);

  it('reveals the start room and what is on its walls', () => {
    expect(s.turn).toBe(1);
    expect(s.revealedRooms).toEqual(new Set(['R20']));
    expect(s.seenCells.size).toBe(16);
    expect(seen(s, 1, 14)).toBe(true);
    expect(seen(s, 4, 17)).toBe(true);
    expect(seen(s, 5, 15)).toBe(false);
    // closed doors on the room walls, including the false door (it looks like a door)
    expect(s.seenDoors).toEqual(new Set(['d1', 'd2', 'x1']));
    expect(s.openDoors.size).toBe(0);
  });

  it('is deterministic for a seed and keeps the rng as a number', () => {
    expect(typeof s.rng).toBe('number');
    expect(initialState(level, SEED)).toEqual(s);
    expect(initialState(level, 43).rng).not.toBe(s.rng);
  });
});

describe('OPEN_DOOR into a room', () => {
  const s = run(open('d2'));

  it('opens the door and reveals the whole room behind it', () => {
    expect(s.openDoors).toEqual(new Set(['d2']));
    expect(s.revealedRooms).toEqual(new Set(['R20', 'R17']));
    for (let y = 13; y <= 17; y++) for (let x = 5; x <= 8; x++) expect(seen(s, x, y)).toBe(true);
  });

  it('shows monsters, furniture, trap "?" markers and doors on its walls', () => {
    expect(s.seenMonsters).toEqual(new Set(['m1'])); // m3 is hidden, m2 is in another room
    expect(s.seenFurniture).toEqual(new Set(['f1']));
    expect(s.seenTraps).toEqual(new Set(['t1'])); // the pit; the chest trap stays hidden
    expect(s.seenDoors.has('d3')).toBe(true);
  });

  it('never reveals secret doors, and leaves other rooms alone', () => {
    expect(s.seenDoors.has('s1')).toBe(false);
    expect(seen(s, 9, 15)).toBe(false);
    expect(s.seenTraps.has('t3')).toBe(false);
  });

  it('returns a revealed prompt with the new cells and the door as origin', () => {
    const r = reduce(level, initialState(level, SEED), open('d2'));
    expect(r.prompts).toHaveLength(1);
    const p = r.prompts[0];
    expect(p?.kind).toBe('revealed');
    if (p?.kind === 'revealed') {
      expect(p.cells).toHaveLength(20);
      expect(p.origin).toEqual([5, 15.5]);
    }
  });

  it('opening the next door reveals the next room, and its monster', () => {
    const t = run(open('d2'), open('d3'));
    expect(t.revealedRooms.has('R18')).toBe(true);
    expect(t.seenMonsters).toEqual(new Set(['m1', 'm2']));
    expect(t.seenDoors.has('d4')).toBe(true);
  });
});

describe('OPEN_DOOR into a corridor', () => {
  const s = run(open('d1'));

  it('reveals corridor squares by line of sight from the square beyond the door', () => {
    for (let x = 0; x <= 7; x++) expect(seen(s, x, 18)).toBe(true);
    expect(s.looked.has('3,18')).toBe(true);
    expect(seen(s, 3, 18)).toBe(true);
  });

  it('shows a blocked square in sight, and nothing behind it', () => {
    expect(s.seenBlocks).toEqual(new Set(['b1']));
    expect(seen(s, 8, 18)).toBe(false); // a block is not a floor square
    expect(seen(s, 9, 18)).toBe(false);
  });

  it('shows traps in sight, not rooms behind walls', () => {
    expect(s.seenTraps.has('t3')).toBe(true);
    expect(s.revealedRooms).toEqual(new Set(['R20']));
    expect(seen(s, 9, 14)).toBe(false);
    expect(s.seenMonsters.size).toBe(0);
  });

  it('a door seen along the corridor can be opened into the next room', () => {
    const t = run(open('d1'), look(0, 18));
    expect(seen(t, 0, 11)).toBe(true);
    expect(t.seenDoors.has('d5')).toBe(true);
    const u = reduce(level, t, open('d5')).state;
    expect(u.revealedRooms.has('R12')).toBe(true);
  });

  it('seeing a room square through an open door reveals the whole room', () => {
    // Hand-made state: d4 is open, R18 is not revealed, a hero stands at (12,14).
    const d = draftOf(initialState(level, SEED));
    d.seenCells.add('12,14');
    d.openDoors.add('d4');
    const s = reduce(level, d, look(12, 14)).state;
    expect(s.revealedRooms.has('R18')).toBe(true);
    expect(seen(s, 11, 17)).toBe(true); // not in line of sight, but the room is whole
    expect(s.seenMonsters.has('m2')).toBe(true);
  });

  it('a room is never partly revealed, whatever the order of events', () => {
    const doors = [...level.doors.keys()];
    const rooms = new Set(board.cells.flat().filter((a) => a !== 'C'));
    const corridorCells: [number, number][] = [];
    for (let y = 0; y < board.height; y++)
      for (let x = 0; x < board.width; x++)
        if (board.cells[y]![x] === 'C') corridorCells.push([x, y]);
    for (let trial = 0; trial < 60; trial++) {
      let s = initialState(level, trial);
      let rng = s.rng;
      const pick = (n: number): number => {
        const [v, next] = nextInt(rng, n);
        rng = next;
        return v;
      };
      for (let i = 0; i < 25; i++) {
        try {
          s = reduce(
            level,
            s,
            pick(2) === 0
              ? open(doors[pick(doors.length)]!)
              : look(...corridorCells[pick(corridorCells.length)]!),
          ).state;
        } catch {
          // invalid events (door not seen, square not seen) are simply skipped
        }
        for (const room of rooms) {
          const floor = cellsOf(board, room).filter(([x, y]) => !level.rock.has(`${x},${y}`));
          const seenCount = floor.filter(([x, y]) => seen(s, x, y)).length;
          if (floor.length === 0) continue;
          expect(seenCount === 0 || seenCount === floor.length, `${room} partly seen`).toBe(true);
          expect(s.revealedRooms.has(room), room).toBe(seenCount > 0);
        }
      }
    }
  });
});

describe('OPEN_DOOR edge cases', () => {
  it('room already revealed, corridor beyond seen but not looked from: looks from beyond the door', () => {
    const d = draftOf(initialState(level, SEED));
    d.seenCells.add('3,18');
    const r = reduce(level, d, open('d1'));
    expect(r.state.openDoors).toEqual(new Set(['d1']));
    expect(r.state.looked.has('3,18')).toBe(true);
    expect(r.state.seenCells.size).toBeGreaterThan(d.seenCells.size);
  });

  it('both sides known and the corridor already looked from: only flips to open', () => {
    const d = draftOf(initialState(level, SEED));
    d.seenCells.add('3,18');
    d.looked.add('3,18');
    const r = reduce(level, d, open('d1'));
    expect(r.state.openDoors).toEqual(new Set(['d1']));
    expect(r.state.seenCells).toEqual(d.seenCells);
    expect(r.prompts).toEqual([]);
  });

  it('a false door opens, shows nothing and keeps blocking sight', () => {
    const r = reduce(level, initialState(level, SEED), open('x1'));
    expect(r.state.openDoors.has('x1')).toBe(true);
    expect(r.state.seenCells.size).toBe(16);
    expect(r.state.revealedRooms).toEqual(new Set(['R20']));
    expect(r.prompts).toEqual([{ kind: 'nothingNew' }]);
    // d1 then opens: sight from the corridor still cannot pass the false door
    expect(seen(r.state, 1, 13)).toBe(false);
  });

  it('rejects unknown, unseen, secret and already open doors without touching the state', () => {
    const s0 = initialState(level, SEED);
    const before = structuredClone(s0);
    const code = (door: string, s = s0) => {
      try {
        reduce(level, s, open(door));
      } catch (e) {
        expect(e).toBeInstanceOf(EventError);
        return (e as EventError).code;
      }
      return 'no error';
    };
    expect(code('zz')).toBe('UNKNOWN_DOOR');
    expect(code('d3')).toBe('DOOR_NOT_SEEN');
    expect(code('s1')).toBe('DOOR_NOT_SEEN');
    expect(code('d1', run(open('d1')))).toBe('ALREADY_OPEN');
    expect(s0).toEqual(before);
  });
});

describe('LOOK_FROM', () => {
  it('reveals corridor squares in line of sight; rock is never revealed', () => {
    // d2, d3, d4 lead to the east corridor band; walk the corridor north by looking (the centre
    // room blocks column 12 between y 7 and 11, so go round by column 9)
    const s = run(
      open('d2'),
      open('d3'),
      open('d4'),
      look(12, 12),
      look(9, 12),
      look(9, 6),
      look(12, 6),
      look(12, 0),
    );
    expect(seen(s, 12, 14)).toBe(true);
    expect(seen(s, 12, 0)).toBe(true);
    for (let x = 0; x <= 11; x++) expect(seen(s, x, 0)).toBe(true);
    expect(seen(s, 13, 0)).toBe(false); // rock cell
    expect(seen(s, 14, 0)).toBe(false); // hidden behind it
    expect(s.looked.has('12,0')).toBe(true);
  });

  it('shows "nothing new" when there is nothing to reveal', () => {
    const s = run(open('d1'));
    const r = reduce(level, s, look(7, 18));
    expect(r.prompts).toEqual([{ kind: 'nothingNew' }]);
    expect(r.state.looked.has('7,18')).toBe(true);
  });

  it('only works from a seen corridor square', () => {
    const s = run(open('d1'));
    const code = (x: number, y: number) => {
      try {
        reduce(level, s, look(x, y));
      } catch (e) {
        return (e as EventError).code;
      }
      return 'no error';
    };
    expect(code(20, 18)).toBe('NOT_A_SEEN_CORRIDOR_CELL'); // not seen
    expect(code(2, 15)).toBe('NOT_A_SEEN_CORRIDOR_CELL'); // a room square
    expect(code(30, 1)).toBe('BAD_CELL');
    expect(code(1.5, 1)).toBe('BAD_CELL');
  });
});

describe('replay and undo', () => {
  const events = [open('d1'), open('d2'), look(0, 18)];

  it('replay is deterministic and does not mutate earlier states', () => {
    const a = replay(level, SEED, events);
    const b = replay(level, SEED, events);
    expect(a).toEqual(b);
    const s0 = initialState(level, SEED);
    const snap = structuredClone(s0);
    reduce(level, s0, open('d1'));
    expect(s0).toEqual(snap);
  });

  it('undo drops the last event and replays', () => {
    const u = undo(level, SEED, events);
    expect(u.events).toEqual(events.slice(0, 2));
    expect(u.state).toEqual(replay(level, SEED, events.slice(0, 2)));
    expect(u.state.looked.has('0,18')).toBe(false);
    expect(events).toHaveLength(3); // input untouched
  });

  it('undo to the very start, and undo with nothing to undo', () => {
    const one = undo(level, SEED, [open('d1')]);
    expect(one.state).toEqual(initialState(level, SEED));
    const none = undo(level, SEED, []);
    expect(none.events).toEqual([]);
    expect(none.state).toEqual(initialState(level, SEED));
  });
});
