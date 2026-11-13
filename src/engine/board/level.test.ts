import { describe, expect, it } from 'vitest';
import { testQuest } from '../quest/testQuest';
import { lineOfSight } from './los';
import {
  blocksMove,
  blocksSight,
  buildLevel,
  edgeKey,
  edgeOpen,
  isBlocked,
  isRock,
  isWall,
  sightMap,
} from './level';

const level = buildLevel(testQuest());
const none = new Set<string>();

describe('level', () => {
  it('collects rock from rooms and cells', () => {
    expect(isRock(level, 15, 2)).toBe(true); // R04
    expect(isRock(level, 13, 0)).toBe(true); // single rock cell
    expect(isRock(level, 12, 0)).toBe(false);
    expect(level.rock.size).toBe(15 + 1);
  });

  it('knows blocked squares; rock and blocks stop sight and movement', () => {
    expect(isBlocked(level, 8, 18)).toBe(true);
    expect(blocksSight(level, 8, 18)).toBe(true);
    expect(blocksMove(level, 8, 18)).toBe(true);
    expect(blocksSight(level, 15, 2)).toBe(true);
    expect(blocksSight(level, 3, 18)).toBe(false);
    expect(blocksSight(level, -1, 0)).toBe(true);
    expect(blocksSight(level, 26, 0)).toBe(true);
  });

  it('indexes doors by edge in both directions, with their kind', () => {
    expect(edgeKey([3, 17], [3, 18])).toBe(edgeKey([3, 18], [3, 17]));
    expect(level.doorAtEdge.get(edgeKey([3, 18], [3, 17]))?.id).toBe('d1');
    expect(level.doors.get('s1')?.kind).toBe('secret');
    expect(level.doors.get('x1')?.kind).toBe('false');
    expect(level.doors.get('d2')?.kind).toBe('normal');
    expect(level.doorsAt.get('3,18')?.map((d) => d.id)).toEqual(['d1']);
  });

  it('walls are derived from areas', () => {
    expect(isWall(level, [2, 15], [3, 15])).toBe(false); // same room
    expect(isWall(level, [4, 15], [5, 15])).toBe(true); // R20 | R17
    expect(isWall(level, [0, 5], [0, 6])).toBe(false); // corridor to corridor
    expect(isWall(level, [0, 5], [1, 5])).toBe(true); // corridor | room
    expect(isWall(level, [0, 0], [0, -1])).toBe(true); // board edge
  });

  it('edge open: a wall is closed, a door opens only when open, false and secret doors need care', () => {
    expect(edgeOpen(level, [4, 15], [5, 15], none)).toBe(false); // d2 closed
    expect(edgeOpen(level, [4, 15], [5, 15], new Set(['d2']))).toBe(true);
    expect(edgeOpen(level, [5, 15], [4, 15], new Set(['d2']))).toBe(true);
    expect(edgeOpen(level, [2, 15], [3, 15], none)).toBe(true); // inside a room
    expect(edgeOpen(level, [4, 14], [5, 14], new Set(['d2']))).toBe(false); // plain wall next to the door
    expect(edgeOpen(level, [1, 14], [1, 13], new Set(['x1']))).toBe(false); // false door never opens the way
    expect(edgeOpen(level, [8, 17], [9, 17], none)).toBe(false); // secret door, nobody opened it
    expect(edgeOpen(level, [8, 17], [9, 17], new Set(['s1']))).toBe(true);
  });

  it('sight map: rock and blocks from the quest, doors from the open set', () => {
    const closed = sightMap(level, none);
    expect(closed.cellKind(8, 18)).toBe('block');
    expect(closed.cellKind(15, 2)).toBe('rock');
    expect(closed.cellKind(3, 18)).toBe('floor');
    // from (3,18) along the bottom corridor: sees the block, not beyond
    expect(lineOfSight(closed, [3, 18], [8, 18])).toBe(true);
    expect(lineOfSight(closed, [3, 18], [9, 18])).toBe(false);
    // a closed door blocks sight from the room into the corridor
    expect(lineOfSight(closed, [3, 17], [3, 18])).toBe(false);
    expect(lineOfSight(sightMap(level, new Set(['d1'])), [3, 17], [3, 18])).toBe(true);
  });
});
