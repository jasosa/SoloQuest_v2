import { describe, expect, it } from 'vitest';
import { board } from '../board/board';
import { buildLevel, outsideOf } from '../board/level';
import { parseQuest } from '../quest/loader';
import { testQuestData } from '../quest/testQuest';
import { validateQuest } from '../quest/validate';
import { EventError, reduce, replay, startGame } from './reducer';

// The heroes start outside an iron door in the bottom wall, at (3,18); a wooden exit is at (20,18).
const make = (patch: Record<string, unknown> = {}) =>
  parseQuest({
    ...testQuestData,
    blocks: [],
    start: { door: 'in' },
    edgeDoors: [
      { id: 'in', cell: [3, 18], side: 's', kind: 'ironEntry' },
      { id: 'out', cell: [20, 18], side: 's', kind: 'woodenExit' },
    ],
    ...patch,
  });

const lv = buildLevel(make());
const code = (fn: () => unknown): string | undefined => {
  try {
    fn();
  } catch (e) {
    if (e instanceof EventError) return e.code;
    throw e;
  }
  return undefined;
};

describe('edge doors and the door start', () => {
  it('the outside square is the one past the board edge', () => {
    expect(outsideOf([3, 18], 's')).toEqual([3, 19]);
    expect(outsideOf([0, 4], 'w')).toEqual([-1, 4]);
    expect(lv.doors.get('in')).toMatchObject({ edge: 'ironEntry', a: [3, 18], b: [3, 19] });
    expect(lv.doors.get('out')?.edge).toBe('woodenExit');
  });

  it('at the start the heroes see only the iron door, no room', () => {
    const { state } = startGame(lv, 1);
    expect([...state.seenDoors]).toEqual(['in']);
    expect(state.seenCells.size).toBe(0);
    expect(state.revealedRooms.size).toBe(0);
  });

  it('opening it looks in from the square inside; the exit door is seen like any other door', () => {
    const s = replay(lv, 1, [{ type: 'OPEN_DOOR', door: 'in' }]);
    expect(s.openDoors.has('in')).toBe(true);
    // the whole bottom corridor is in sight
    expect(s.seenCells.has('3,18')).toBe(true);
    expect(s.seenCells.has('20,18')).toBe(true);
    expect(s.seenDoors.has('out')).toBe(true);
    expect(s.seenDoors.has('d1')).toBe(true); // the door into the start room of the old quest
  });

  it('a door that is not seen cannot be opened, and an edge door opens once', () => {
    expect(code(() => replay(lv, 1, [{ type: 'OPEN_DOOR', door: 'out' }]))).toBe('DOOR_NOT_SEEN');
    expect(
      code(() =>
        replay(lv, 1, [
          { type: 'OPEN_DOOR', door: 'in' },
          { type: 'OPEN_DOOR', door: 'in' },
        ]),
      ),
    ).toBe('ALREADY_OPEN');
  });

  it('opening the exit door is allowed and shows nothing new', () => {
    const r = reduce(lv, replay(lv, 1, [{ type: 'OPEN_DOOR', door: 'in' }]), {
      type: 'OPEN_DOOR',
      door: 'out',
    });
    expect(r.state.openDoors.has('out')).toBe(true);
  });

  it('a note can fire when the entry door opens', () => {
    const q = make({
      notes: [
        {
          id: 'n1',
          trigger: { type: 'doorOpened', door: 'in' },
          effects: [{ type: 'showText', text: 'The cold bites.' }],
        },
      ],
    });
    const l = buildLevel(q);
    const r = reduce(l, startGame(l, 1).state, { type: 'OPEN_DOOR', door: 'in' });
    expect(JSON.stringify(r.prompts)).toContain('The cold bites.');
  });
});

describe('the quest file and the validator', () => {
  it('a start needs a room or a door, never both or neither', () => {
    expect(() => make({ start: {} })).toThrow();
    expect(() => make({ start: { area: 'R20', door: 'in' } })).toThrow();
    expect(() => make({ start: { area: 'R20' } })).not.toThrow();
  });

  it('a clean quest with edge doors has no problems', () => {
    expect(validateQuest(make(), board)).toEqual([]);
  });

  it('an edge door must be on the outer edge, on one side, with one iron entry', () => {
    const msgs = (p: Record<string, unknown>) => validateQuest(make(p), board);
    const inner = msgs({
      start: { door: 'in' },
      edgeDoors: [{ id: 'in', cell: [3, 10], side: 's', kind: 'ironEntry' }],
    }).join(' ');
    expect(inner).toMatch(/not on the s edge of the board/);
    const two = msgs({
      edgeDoors: [
        { id: 'in', cell: [3, 18], side: 's', kind: 'ironEntry' },
        { id: 'in2', cell: [5, 18], side: 's', kind: 'ironEntry' },
      ],
    }).join(' ');
    expect(two).toMatch(/only one iron entry/);
  });

  it('the start door must be an iron entry door of the quest', () => {
    const wrong = validateQuest(make({ start: { door: 'out' } }), board).join(' ');
    expect(wrong).toMatch(/not an iron entry door/);
    const gone = validateQuest(make({ start: { door: 'zz' } }), board).join(' ');
    expect(gone).toMatch(/unknown edge door/);
  });
});
