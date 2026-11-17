import { describe, expect, it } from 'vitest';
import { buildLevel } from '../board/level';
import { initialState, reduce } from './reducer';
import { testQuest } from '../quest/testQuest';
import { squareMarkers } from './view';

const note = (keepMark: boolean) => ({
  id: 'sq',
  trigger: { type: 'squareEntered' as const, cell: [2, 15] as [number, number] },
  effects: [{ type: 'showText' as const, text: 'Cold here.' }],
  ...(keepMark ? { keepMark: true } : {}),
});

describe('square marks after the note fired', () => {
  for (const keep of [false, true])
    it(`keepMark ${keep}: the mark ${keep ? 'stays, with nothing waiting' : 'goes'}`, () => {
      const lv = buildLevel(testQuest({ notes: [note(keep)] }));
      const s = initialState(lv, 1);
      expect(squareMarkers(lv, s)).toHaveLength(1);
      const r = reduce(lv, s, { type: 'SQUARE_TRIGGER', cell: [2, 15] });
      const after = squareMarkers(lv, r.state);
      expect(after).toHaveLength(keep ? 1 : 0);
      if (keep) expect(after[0]?.step).toBe(false);
    });
});
