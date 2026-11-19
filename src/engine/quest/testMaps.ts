/**
 * Small two-map quest on the real board, used by engine tests and by the dev fixture
 * `?quest=test-maps`. Made up: no quest content from the book.
 *
 * Map "one" (the top-level fields). Stairway S in the start room R20, then R17 and R18.
 *
 *     x:  1 2 3 4 | 5 6 7 8 | 9 10 11
 *   y14:  . . . . | . . . . | . .  .      R20 = x1-4, y14-17 (start)
 *   y15:  S . . . d2 m1 . . d3 . .  .     R17 = x5-8, y13-17
 *   y16:  S . . . | . . . . | . .  .      R18 = x9-11, y13-17
 *   y17:  . . . . | . . . . | . .  .
 *   S = stairs (1,15)-(1,16), d2 normal door, d3 door locked until the flag "key",
 *   m1 = abomination (2 Body) at (6,15), killing it sets "key".
 *
 * Map "two". Stairway T in R01, a door to R02 with a goblin.
 *
 *     x:  1 2 3 4 | 5 6 7 8
 *   y 1:  T T . . | . . . .               R01 = x1-4, y1-3 (arrival)
 *   y 2:  . . . . e1 m2 . .               R02 = x5-8, y1-3
 *   y 3:  . . . . | . . p .               p = pit trap at (7,3)
 *
 * The link joins the two stairways. Both stairways ask "Are all heroes on the stairway?".
 */
import { parseQuest } from './loader';
import type { Quest } from './schema';

export const MAP_ONE = 'one';
export const MAP_TWO = 'two';

const ask = (id: string, map: string, label: string) => ({
  id,
  map,
  trigger: { type: 'manual', label, repeat: true },
  effects: [
    {
      type: 'promptChoice',
      text: 'Are all heroes on the stairway?',
      options: [
        { label: 'Yes', effects: [{ type: 'crossMap', link: 'l1' }] },
        { label: 'No', effects: [] },
      ],
    },
  ],
});

export const testMapsData = {
  schemaVersion: 1,
  id: 'test-maps',
  number: 98,
  title: 'Test Maps',
  intro: { summary: 'A made-up quest with two maps, for tests.' },
  mapId: MAP_ONE,
  mapName: 'The Upper Hall',
  start: { area: 'R20', kind: 'stairway' },
  doors: [
    { id: 'd2', a: [4, 15], b: [5, 15] },
    { id: 'd3', a: [8, 15], b: [9, 15], lockedUntil: 'key' },
  ],
  furniture: [
    {
      id: 'st1',
      type: 'stairs',
      cells: [
        [1, 15],
        [1, 16],
      ],
    },
  ],
  monsters: [{ id: 'm1', type: 'abomination', cell: [6, 15] }],
  maps: [
    {
      id: MAP_TWO,
      name: 'The Lower Hall',
      start: { area: 'R01', kind: 'stairway' },
      doors: [{ id: 'e1', a: [4, 2], b: [5, 2] }],
      furniture: [
        {
          id: 'st2',
          type: 'stairs',
          cells: [
            [1, 1],
            [2, 1],
          ],
        },
      ],
      monsters: [{ id: 'm2', type: 'goblin', cell: [6, 2] }],
      traps: [{ id: 't1', kind: 'pit', cell: [7, 3] }],
    },
  ],
  links: [{ id: 'l1', a: { map: MAP_ONE, cell: [1, 15] }, b: { map: MAP_TWO, cell: [1, 1] } }],
  notes: [
    ask('ask1', MAP_ONE, 'Go down the stairs'),
    ask('ask2', MAP_TWO, 'Go up the stairs'),
    {
      id: 'rev17',
      map: MAP_ONE,
      letter: 'A',
      trigger: { type: 'areaRevealed', area: 'R17' },
      effects: [{ type: 'showText', text: 'A cold room.' }],
    },
    {
      id: 'rev02',
      map: MAP_TWO,
      letter: 'B',
      trigger: { type: 'areaRevealed', area: 'R02' },
      effects: [{ type: 'showText', text: 'A hall with a goblin.' }],
    },
    // no map: in force everywhere (a kill note)
    {
      id: 'key',
      trigger: { type: 'monsterKilled', monster: 'm1' },
      effects: [{ type: 'setFlag', flag: 'key', value: true }],
    },
  ],
  wandering: { monster: 'goblin' },
  objectives: [{ id: 'o1', text: 'Slay the goblin below.', done: { monsterKilled: 'm2' } }],
} as const;

export function testMapsQuest(patch: Record<string, unknown> = {}): Quest {
  return parseQuest({ ...testMapsData, ...patch });
}
