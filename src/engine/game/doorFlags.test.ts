import { describe, expect, it } from 'vitest';
import { board } from '../board/board';
import { buildLevel, sightMap } from '../board/level';
import { parseQuest } from '../quest/loader';
import { testQuestData } from '../quest/testQuest';
import { validateQuest } from '../quest/validate';
import type { GameEvent } from './events';
import { EventError, reduce, replay } from './reducer';

// Q5-style doors on the test quest: d2 closes and vanishes, d3 waits for a flag, d4 is locked.
const manual = (id: string, effects: unknown[]) => ({
  id,
  trigger: { type: 'manual', label: id },
  effects,
});
const make = (doors: Record<string, unknown>, notes: unknown[]) =>
  parseQuest({
    ...testQuestData,
    doors: testQuestData.doors.map((d) => ({ ...d, ...(doors[d.id] as object | undefined) })),
    notes: [...testQuestData.notes, ...notes],
  });
const run = (lv: ReturnType<typeof buildLevel>, ...e: GameEvent[]) => replay(lv, 5, e);
const code = (fn: () => unknown): string | undefined => {
  try {
    fn();
  } catch (err) {
    if (err instanceof EventError) return err.code;
    throw err;
  }
  return undefined;
};
const trigger = (note: string): GameEvent => ({ type: 'MANUAL_TRIGGER', note });

describe('removeDoor: the door closes and disappears (Q5 B)', () => {
  const lv = buildLevel(
    make({}, [
      manual('vanish', [{ type: 'removeDoor', door: 'd2' }]),
      manual('vanish2', [{ type: 'removeDoor', door: 'd2' }]),
      manual('all', [{ type: 'revealAll' }]),
    ]),
  );
  const open: GameEvent[] = [{ type: 'OPEN_DOOR', door: 'd2' }];

  it('an open door is closed, off the map, and the edge stops sight again', () => {
    const s = run(lv, ...open, trigger('vanish'));
    expect(s.removedDoors).toEqual(['d2']);
    expect(s.openDoors.has('d2')).toBe(false);
    expect(s.seenDoors.has('d2')).toBe(false);
    // the room the heroes saw stays seen
    expect(s.revealedRooms.has('R17')).toBe(true);
    expect(sightMap(lv, s.openDoors).edgeOpen([4, 15], [5, 15])).toBe(false);
  });

  it('it never comes back, not even when the whole map is revealed', () => {
    const s = run(lv, ...open, trigger('vanish'), trigger('all'));
    expect(s.seenDoors.has('d2')).toBe(false);
    expect(code(() => run(lv, ...open, trigger('vanish'), { type: 'OPEN_DOOR', door: 'd2' }))).toBe(
      'DOOR_NOT_SEEN',
    );
  });

  it('removing it twice changes nothing', () => {
    const once = run(lv, ...open, trigger('vanish'));
    const twice = run(lv, ...open, trigger('vanish'), trigger('vanish2'));
    expect(twice.removedDoors).toEqual(once.removedDoors);
  });
});

describe('hiddenUntil: a door that is not on the map until a flag is set (Q5 C)', () => {
  const lv = buildLevel(
    make({ d3: { hiddenUntil: 'gone' } }, [
      manual('flag', [{ type: 'setFlag', flag: 'gone', value: true }]),
    ]),
  );
  const inR17: GameEvent[] = [{ type: 'OPEN_DOOR', door: 'd2' }];

  it('is not seen while its squares are seen, and cannot be opened', () => {
    const s = run(lv, ...inR17);
    expect(s.seenCells.has('8,15')).toBe(true);
    expect(s.seenDoors.has('d3')).toBe(false);
    expect(code(() => run(lv, ...inR17, { type: 'OPEN_DOOR', door: 'd3' }))).toBe('DOOR_NOT_SEEN');
  });

  it('appears as soon as the flag is set, because its square is already seen', () => {
    const s = run(lv, ...inR17, trigger('flag'));
    expect(s.seenDoors.has('d3')).toBe(true);
    expect(
      run(lv, ...inR17, trigger('flag'), { type: 'OPEN_DOOR', door: 'd3' }).openDoors.has('d3'),
    ).toBe(true);
  });

  it('a flag set before the squares are seen shows the door with them', () => {
    const s = run(lv, trigger('flag'), ...inR17);
    expect(s.seenDoors.has('d3')).toBe(true);
  });
});

describe('lockedUntil: a door that will not open until a flag is set (Q9 key door)', () => {
  const lv = buildLevel(
    make({ d2: { lockedUntil: 'key' } }, [
      manual('found', [{ type: 'setFlag', flag: 'key', value: true }]),
    ]),
  );

  it('answers "stuck", changes nothing and fires no door note', () => {
    const start = run(lv);
    const r = reduce(lv, start, { type: 'OPEN_DOOR', door: 'd2' });
    expect(r.prompts).toEqual([{ kind: 'doorStuck', door: 'd2' }]);
    expect(r.state.openDoors.has('d2')).toBe(false);
  });

  it('opens normally once the flag is set', () => {
    const s = run(lv, trigger('found'), { type: 'OPEN_DOOR', door: 'd2' });
    expect(s.openDoors.has('d2')).toBe(true);
    expect(s.revealedRooms.has('R17')).toBe(true);
  });
});

describe('openAllDoors skips removed and waiting doors', () => {
  const lv = buildLevel(
    make({ d3: { hiddenUntil: 'gone' } }, [
      manual('flag', [{ type: 'setFlag', flag: 'gone', value: true }]),
      manual('vanish', [{ type: 'removeDoor', door: 'd5' }]),
      manual('open', [{ type: 'openAllDoors' }]),
    ]),
  );
  it('d3 (waiting for its flag) and d5 (removed) stay shut', () => {
    const s = run(lv, trigger('vanish'), trigger('open'));
    expect(s.openDoors.has('d3')).toBe(false);
    expect(s.openDoors.has('d5')).toBe(false);
    expect(s.openDoors.has('d1')).toBe(true);
  });
});

describe('the validator', () => {
  it('wants a note that sets the flag of a hidden or locked door, and a door that exists', () => {
    const msgs = (q: ReturnType<typeof make>) => validateQuest(q, board).join(' | ');
    expect(msgs(make({ d3: { hiddenUntil: 'nope' } }, []))).toMatch(
      /door d3: hiddenUntil flag nope is never set/,
    );
    expect(msgs(make({ d2: { lockedUntil: 'nope' } }, []))).toMatch(
      /door d2: lockedUntil flag nope is never set/,
    );
    expect(msgs(make({}, [manual('x', [{ type: 'removeDoor', door: 'zz' }])]))).toMatch(
      /unknown door zz/,
    );
    expect(
      msgs(
        make({ d3: { hiddenUntil: 'gone' } }, [
          manual('flag', [{ type: 'setFlag', flag: 'gone', value: true }]),
          manual('v', [{ type: 'removeDoor', door: 'd2' }]),
        ]),
      ),
    ).toBe('');
  });
});
