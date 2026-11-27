import { describe, expect, it } from 'vitest';
import { board } from '../board/board';
import { parseQuest, QuestParseError } from './loader';
import { migrateQuest, QuestVersionError } from './migrate';
import { testQuest, testQuestData } from './testQuest';
import { validateQuest } from './validate';

const m3 = testQuestData.monsters[2]; // the hidden gargoyle, placed by a note of the fixture
const withPatch = (patch: Record<string, unknown>) => testQuest(patch);

describe('parseQuest', () => {
  it('parses the fixture and fills defaults', () => {
    const q = testQuest();
    expect(q.id).toBe('test-quest');
    expect(q.doors).toHaveLength(5);
    expect(q.secretDoors).toHaveLength(1);
    expect(q.falseDoors).toHaveLength(1);
    expect(q.markers).toEqual([]);
    expect(q.rules).toEqual({});
  });

  it('parses a minimal quest', () => {
    const q = parseQuest({
      schemaVersion: 1,
      id: 'm',
      number: 1,
      title: 'T',
      intro: { summary: 's' },
      start: { area: 'R20' },
    });
    expect(q.rock).toEqual({ rooms: [], cells: [] });
    expect(q.notes).toEqual([]);
  });

  describe('old blocksSearch flag (decision 111)', () => {
    const old = (extra: Record<string, unknown>, effects: unknown[] = []) =>
      withPatch({
        notes: [
          {
            id: 'n-cell',
            trigger: { type: 'treasureSearch', area: 'R17' },
            effects: [{ type: 'showText', text: 'No.' }, ...effects],
            ...extra,
          },
        ],
      }).notes[0]!;

    it('becomes a blockSearch effect after the other effects, and the flag is gone', () => {
      const n = old({ blocksSearch: true });
      expect(n.effects).toEqual([{ type: 'showText', text: 'No.' }, { type: 'blockSearch' }]);
      expect('blocksSearch' in n).toBe(false);
    });
    it('does not add the effect twice', () => {
      const n = old({ blocksSearch: true }, [{ type: 'blockSearch' }]);
      expect(n.effects.filter((e) => e.type === 'blockSearch')).toHaveLength(1);
    });
    it('blocksSearch false is dropped and adds nothing', () => {
      const n = old({ blocksSearch: false });
      expect(n.effects).toEqual([{ type: 'showText', text: 'No.' }]);
      expect('blocksSearch' in n).toBe(false);
    });
  });

  it('parses notes with trigger, conditions and nested effects', () => {
    const q = withPatch({
      markers: [{ id: 'k1', label: 'X', cell: [4, 2], visible: 'editor' }],
      wandering: { monster: 'orc' },
      objectives: [{ id: 'o1', text: 'Kill it', done: { monsterKilled: 'm1' } }],
      rules: { fallingBlock: 'q13', doorTeleport: { dice: '1 red die', squares: 'that many' } },
      notes: [
        {
          id: 'n-A',
          letter: 'A',
          at: [6, 15],
          trigger: { type: 'treasureSearch', area: 'R17', first: true },
          when: [
            { monstersAliveIn: 'R17', is: 0 },
            { flag: 'alarm', is: false },
          ],
          effects: [
            { type: 'showText', text: 'Nothing here.' },
            {
              type: 'promptChoice',
              text: 'Pull the lever?',
              options: [{ label: 'Yes', effects: [{ type: 'revealArea', area: 'R18' }] }],
            },
          ],
          consumesTreasure: true,
        },
        { ...testQuestData.notes[0] },
        {
          id: 'n-B',
          trigger: { type: 'manual', label: 'Alarm' },
          effects: [{ type: 'setFlag', flag: 'alarm', value: true }],
        },
      ],
    });
    expect(q.notes[0]?.effects).toHaveLength(2);
    expect(validateQuest(q, board)).toEqual([]);
  });

  it('reports readable errors with paths', () => {
    const bad = { ...testQuestData, monsters: [{ id: 'm1', type: 'dragon', cell: [1, 1] }] };
    expect(() => parseQuest(bad)).toThrow(QuestParseError);
    try {
      parseQuest(bad);
    } catch (e) {
      expect((e as Error).message).toContain('monsters.0.type');
    }
  });

  it('rejects unknown keys, bad cells, and a monster with no cell unless hidden', () => {
    expect(() => parseQuest({ ...testQuestData, bogus: 1 })).toThrow(QuestParseError);
    expect(() => withPatch({ doors: [{ id: 'd', a: [1, 2, 3], b: [1, 2] }] })).toThrow(
      QuestParseError,
    );
    expect(() => withPatch({ monsters: [{ id: 'm', type: 'orc' }] })).toThrow(/needs a cell/);
  });

  it('checks the trap shape by kind', () => {
    expect(() => withPatch({ traps: [{ id: 't', kind: 'pit', furniture: 'f1' }] })).toThrow(
      QuestParseError,
    );
    expect(() => withPatch({ traps: [{ id: 't', kind: 'chest', cell: [1, 1] }] })).toThrow(
      QuestParseError,
    );
    expect(() => withPatch({ traps: [{ id: 't', kind: 'scripted' }] })).not.toThrow();
  });
});

describe('migrateQuest', () => {
  it('accepts version 1 and rejects others with a clear message', () => {
    expect(migrateQuest(testQuestData)).toEqual(testQuestData);
    // Decision 66: old files with `zargonInfo` or a `zargon` marker still load.
    const old = {
      ...testQuestData,
      zargonInfo: 'x',
      markers: [{ id: 'k1', label: 'X', cell: [4, 2], visible: 'zargon' }],
    };
    const q = parseQuest(old);
    expect('zargonInfo' in q).toBe(false);
    expect(q.markers[0]?.visible).toBe('editor');
    expect(() => migrateQuest({ ...testQuestData, schemaVersion: 2 })).toThrow(QuestVersionError);
    expect(() => migrateQuest({ ...testQuestData, schemaVersion: 2 })).toThrow(/version 1/);
    expect(() => migrateQuest({})).toThrow(/no schemaVersion/);
    expect(() => migrateQuest('x')).toThrow(QuestVersionError);
    expect(() => parseQuest({ ...testQuestData, schemaVersion: 7 })).toThrow(QuestVersionError);
  });
});

describe('validateQuest', () => {
  const problems = (patch: Record<string, unknown>) => validateQuest(withPatch(patch), board);

  it('accepts the fixture', () => {
    expect(validateQuest(testQuest(), board)).toEqual([]);
  });

  it('door cells must be orthogonal neighbours', () => {
    expect(problems({ doors: [{ id: 'd1', a: [3, 17], b: [4, 18] }] })).toEqual([
      expect.stringContaining('not orthogonal neighbours'),
    ]);
    expect(problems({ doors: [{ id: 'd1', a: [3, 17], b: [3, 17] }] })).toEqual([
      expect.stringContaining('not orthogonal neighbours'),
    ]);
  });

  it('door must sit on a wall and inside the board', () => {
    expect(problems({ doors: [{ id: 'd1', a: [2, 15], b: [3, 15] }] })).toEqual([
      expect.stringContaining('not on a wall'),
    ]);
    expect(problems({ doors: [{ id: 'd1', a: [26, 3], b: [25, 3] }] })).toEqual([
      expect.stringContaining('outside the board'),
    ]);
  });

  it('ids must be unique, doors across all three door lists', () => {
    expect(problems({ secretDoors: [{ id: 'd1', a: [8, 17], b: [9, 17] }] })).toEqual([
      expect.stringContaining('duplicate id d1'),
    ]);
    expect(
      problems({
        monsters: [
          { id: 'm1', type: 'orc', cell: [6, 15] },
          { id: 'm1', type: 'orc', cell: [6, 16] },
          m3,
        ],
      }),
    ).toEqual([expect.stringContaining('duplicate id m1')]);
  });

  it('two doors cannot share an edge', () => {
    expect(
      problems({ secretDoors: [{ id: 's1', a: [3, 18], b: [3, 17] }] }).some((p) =>
        p.includes('same edge'),
      ),
    ).toBe(true);
  });

  it('furniture, monsters, blocks must be inside the board and not in rock', () => {
    // R04 is rock (x14-16, y1-4); (13,0) is a rock cell
    expect(problems({ monsters: [{ id: 'm1', type: 'orc', cell: [15, 2] }, m3] })).toEqual([
      expect.stringContaining('in rock'),
    ]);
    expect(problems({ monsters: [{ id: 'm1', type: 'orc', cell: [13, 0] }, m3] })).toEqual([
      expect.stringContaining('in rock'),
    ]);
    expect(problems({ monsters: [{ id: 'm1', type: 'orc', cell: [30, 2] }, m3] })).toEqual([
      expect.stringContaining('outside the board'),
    ]);
    expect(
      problems({
        furniture: [
          {
            id: 'f1',
            type: 'table',
            cells: [
              [6, 14],
              [15, 3],
            ],
          },
        ],
      }),
    ).toEqual([expect.stringContaining('in rock')]);
    expect(problems({ blocks: [{ cells: [[14, 1]] }] })[0]).toContain('in rock');
  });

  it('start area must exist and not be rock', () => {
    // schema rejects R99 shape-wise only if malformed; R99 is well-formed but not on the board
    expect(problems({ start: { area: 'R99' } })).toEqual([
      expect.stringContaining('unknown room R99'),
    ]);
    expect(problems({ start: { area: 'R04' } })).toEqual([expect.stringContaining('is rock')]);
  });

  it('traps on furniture need that furniture; notes need known ids', () => {
    expect(problems({ traps: [{ id: 't2', kind: 'chest', furniture: 'nope' }] })).toEqual([
      expect.stringContaining('unknown furniture'),
    ]);
    const out = problems({
      notes: [
        {
          id: 'n1',
          trigger: { type: 'doorOpened', door: 'zz' },
          effects: [
            { type: 'revealArea', area: 'R77' },
            { type: 'spawnNpc', npc: 'nobody' },
          ],
        },
      ],
    });
    expect(out).toHaveLength(4); // the fixture note n-m3 is gone, so m3 is never placed
  });
});

describe('doors on a merged wall [proposal]', () => {
  /*
   * R20 | R17 share the wall x4|x5 (y 14..16). The fixture door d2 is on it.
   *
   *   x:  3 4 5 6
   *   y15 . 0 7 7      0 = R20, 7 = R17
   *   (4,15) | (5,15) is the door d2
   */
  const merge = { areaOverrides: [{ merge: ['R20', 'R17'] }] };
  it('is an error for a normal door', () => {
    expect(validateQuest(withPatch(merge), board)).toContain(
      'door d2: on the wall between R20 and R17, which are merged into one room',
    );
  });
  it('is an error for a secret door and a false door', () => {
    const q = withPatch({
      ...merge,
      doors: testQuestData.doors.filter((d) => d.id !== 'd2'),
      secretDoors: [{ id: 's1', a: [4, 15], b: [5, 15] }],
      falseDoors: [{ id: 'x1', a: [4, 16], b: [5, 16] }],
    });
    const out = validateQuest(q, board);
    expect(out).toContain(
      'secret door s1: on the wall between R20 and R17, which are merged into one room',
    );
    expect(out).toContain(
      'false door x1: on the wall between R20 and R17, which are merged into one room',
    );
  });
  it('is fine when the door is on another wall, or there is no merge', () => {
    expect(validateQuest(withPatch({}), board).filter((m) => m.includes('merged'))).toEqual([]);
    expect(
      validateQuest(withPatch({ areaOverrides: [{ merge: ['R13', 'R14'] }] }), board).filter((m) =>
        m.includes('merged into one room'),
      ),
    ).toEqual([]);
  });
});
