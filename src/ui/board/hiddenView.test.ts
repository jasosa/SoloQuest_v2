import { describe, expect, it } from 'vitest';
import { buildLevel } from '../../engine/board/level';
import { addMonster, emptyQuest } from '../../engine/editor';
import { startGame } from '../../engine/game/reducer';
import { hiddenView } from './hiddenView';

const quest = (() => {
  const r = addMonster(emptyQuest({ id: 'user-t', number: 1, title: 'T' }), 'orc', [6, 2]);
  if (!r.ok) throw new Error(r.error);
  return r.quest;
})();

describe('hiddenView', () => {
  const level = buildLevel(quest);
  const { state } = startGame(level, 1);
  const before = JSON.stringify([...state.seenCells]);

  it('lists what the heroes have not seen and leaves the state alone', () => {
    const hv = hiddenView(level, state);
    expect(hv.monsters.map((m) => m.id)).toEqual(['m1']);
    expect(hv.cells.length).toBeGreaterThan(100);
    // start room squares are seen, so they are not listed
    expect(hv.cells.some(([x, y]) => x === 1 && y === 14)).toBe(false);
    expect(JSON.stringify([...state.seenCells])).toBe(before);
  });

  it('is the same for the same state (no randomness)', () => {
    expect(hiddenView(level, state)).toEqual(hiddenView(level, state));
  });
});
