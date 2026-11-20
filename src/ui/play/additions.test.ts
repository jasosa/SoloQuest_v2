import { describe, expect, it } from 'vitest';
import { buildLevel } from '../../engine/board/level';
import { testQuest } from '../../engine/quest/testQuest';
import { additionCells } from './additions';

const level = buildLevel(testQuest());

describe('additionCells', () => {
  it('pulses placed blocks and secret doors', () => {
    expect(additionCells(level, [{ kind: 'blockPlaced', cells: [[3, 4]] }])).toEqual([[3, 4]]);
    expect(additionCells(level, [{ kind: 'secretDoorsFound', doors: ['s1'] }])).toEqual([[8, 17]]);
    expect(additionCells(level, [{ kind: 'secretDoorAdded', door: 's1' }])).toEqual([[8, 17]]);
  });
  it('ignores other prompts and unknown doors', () => {
    expect(
      additionCells(level, [{ kind: 'nothingNew' }, { kind: 'secretDoorAdded', door: 'zz' }]),
    ).toEqual([]);
  });
});
