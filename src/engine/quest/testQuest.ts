/**
 * Small made-up quest on the real board, used by engine tests only.
 *
 *   start room R20 (x1-4, y14-17)
 *   d1  R20 -> bottom corridor (3,17)|(3,18)
 *   d2  R20 -> R17 (4,15)|(5,15)         R17 holds orc m1, table f1 (chest trap t2), pit t1
 *   d3  R17 -> R18 (8,15)|(9,15)         R18 holds goblin m2
 *   d4  R18 -> corridor (11,14)|(12,14)
 *   d5  corridor -> R12 (0,11)|(1,11)
 *   s1  secret door R17 | R18 (8,17)|(9,17)
 *   x1  false door R20 | R12 (1,14)|(1,13)
 *   block at (8,18), rock room R04, rock cell (13,0), spear t3 at (5,18)
 */
import { parseQuest } from './loader';
import type { Quest } from './schema';

export const testQuestData = {
  schemaVersion: 1,
  id: 'test-quest',
  number: 99,
  title: 'Test Quest',
  intro: { summary: 'A made-up quest for tests.' },
  start: { area: 'R20' },
  rock: { rooms: ['R04'], cells: [[13, 0]] },
  doors: [
    { id: 'd1', a: [3, 17], b: [3, 18] },
    { id: 'd2', a: [4, 15], b: [5, 15] },
    { id: 'd3', a: [8, 15], b: [9, 15] },
    { id: 'd4', a: [11, 14], b: [12, 14] },
    { id: 'd5', a: [0, 11], b: [1, 11] },
  ],
  secretDoors: [{ id: 's1', a: [8, 17], b: [9, 17] }],
  falseDoors: [{ id: 'x1', a: [1, 14], b: [1, 13] }],
  blocks: [{ cells: [[8, 18]] }],
  furniture: [
    {
      id: 'f1',
      type: 'table',
      cells: [
        [6, 14],
        [7, 14],
      ],
    },
  ],
  monsters: [
    { id: 'm1', type: 'orc', cell: [6, 15] },
    { id: 'm2', type: 'goblin', cell: [10, 15] },
    { id: 'm3', type: 'gargoyle', hidden: true },
  ],
  traps: [
    { id: 't1', kind: 'pit', cell: [7, 16] },
    { id: 't2', kind: 'chest', furniture: 'f1' },
    { id: 't3', kind: 'spear', cell: [5, 18] },
  ],
  notes: [],
} as const;

export function testQuest(patch: Record<string, unknown> = {}): Quest {
  return parseQuest({ ...testQuestData, ...patch });
}
