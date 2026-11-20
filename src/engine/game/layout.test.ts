import { describe, expect, it } from 'vitest';
import { buildLevel } from '../board/level';
import { testQuest } from '../quest/testQuest';
import type { GameEvent } from './events';
import { replay } from './reducer';

const level = buildLevel(testQuest());
const show = (x: number, y: number): GameEvent => ({ type: 'SHOW_LAYOUT', cell: [x, y] });
const run = (...events: GameEvent[]) => replay(level, 1, events);

describe('Show room (layout only)', () => {
  it('draws a whole closed room without its contents', () => {
    const s = run(show(6, 15)); // R17: orc m1, chest f1, pit t1 and a chest trap
    expect(s.layoutCells.has('5,15')).toBe(true);
    expect(s.layoutCells.has('8,17')).toBe(true);
    expect(s.seenCells.has('5,15')).toBe(false);
    expect(s.revealedRooms.size).toBe(1); // only the start room
    expect(s.seenFurniture.size).toBe(0);
    expect(s.seenMonsters.size).toBe(0);
    expect(s.seenTraps.size).toBe(0);
    expect(s.seenDoors.has('d3')).toBe(false);
    expect(s.openDoors.size).toBe(0);
  });

  it('opening the door later still reveals the contents', () => {
    const s = run(show(6, 15), { type: 'OPEN_DOOR', door: 'd2' });
    expect(s.seenMonsters.has('m1')).toBe(true);
    expect(s.seenFurniture.has('f1')).toBe(true);
  });

  it('on a corridor, draws the corridor squares in sight and stops at a block', () => {
    const s = run(show(3, 18));
    expect(s.layoutCells.has('0,18')).toBe(true);
    expect(s.layoutCells.has('7,18')).toBe(true);
    expect(s.layoutCells.has('9,18')).toBe(false); // the block at (8,18) hides it
    expect(s.layoutCells.has('3,17')).toBe(false); // a room square: not a corridor square
  });

  it('refuses rock with a message, so no event is kept', () => {
    expect(level.rock.has('13,0')).toBe(true);
    expect(() => run(show(13, 0))).toThrow(expect.objectContaining({ code: 'LAYOUT_ROCK' }));
    expect(() => run(show(14, 1))).toThrow(expect.objectContaining({ code: 'LAYOUT_ROCK' })); // room R04 is rock
  });

  it('refuses a room that is already on the map, or already drawn', () => {
    expect(() => run(show(2, 15))).toThrow(expect.objectContaining({ code: 'LAYOUT_KNOWN' }));
    expect(() => run(show(6, 15), show(6, 15))).toThrow(
      expect.objectContaining({ code: 'LAYOUT_KNOWN' }),
    );
  });

  it('is replayed exactly (undo drops it)', () => {
    const a = run(show(6, 15));
    const b = replay(level, 1, [show(6, 15)]);
    expect([...a.layoutCells]).toEqual([...b.layoutCells]);
    expect(run().layoutCells.size).toBe(0);
  });
});
