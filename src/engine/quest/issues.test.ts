import { describe, expect, it } from 'vitest';
import { board, cellsOf } from '../board/board';
import type { Quest } from './schema';
import { testQuest } from './testQuest';
import { validateQuest, validateQuestIssues } from './validate';

const withObjective = (patch: Record<string, unknown> = {}): Quest =>
  testQuest({ objectives: [{ id: 'o1', text: 'Win', done: { monsterKilled: 'm1' } }], ...patch });

const rockRoomCell = cellsOf(board, 'R04')[0] as [number, number];

describe('validateQuestIssues', () => {
  it('has the same messages as validateQuest for the game checks', () => {
    const q = testQuest({
      doors: [{ id: 'd1', a: [3, 17], b: [3, 17] }],
      monsters: [{ id: 'm1', type: 'orc', cell: [13, 0] }],
    });
    const issues = validateQuestIssues(q, board, { editor: false });
    expect(issues.map((i) => i.message)).toEqual(validateQuest(q, board));
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.every((i) => i.severity === 'error')).toBe(true);
  });

  it('gives each issue a ref to jump to', () => {
    const q = withObjective({
      doors: [{ id: 'd1', a: [3, 17], b: [5, 19] }],
      monsters: [{ id: 'm1', type: 'orc', cell: [13, 0] }],
      traps: [{ id: 't1', kind: 'pit', cell: [6, 14] }],
      blocks: [{ cells: [[8, 18]] }],
      markers: [{ id: 'k1', label: 'X', cell: [13, 0] }],
      notes: [{ id: 'n1', trigger: { type: 'doorOpened', door: 'zz' }, effects: [] }],
      npcs: [{ id: 'p1', name: 'P', cell: [30, 0], defend: 1, body: 1, text: '' }],
      start: { area: 'R04' },
    });
    const refs = validateQuestIssues(q, board).map((i) => i.ref);
    const kinds = new Set(refs.map((r) => r?.kind));
    for (const k of ['door', 'monster', 'trap', 'marker', 'note', 'npc', 'area'])
      expect(kinds.has(k as 'door'), k).toBe(true);
    const door = validateQuestIssues(q, board).find((i) => i.ref?.kind === 'door');
    expect(door?.ref).toEqual({ kind: 'door', id: 'd1', cell: [3, 17] });
    expect(validateQuestIssues(q, board).find((i) => i.ref?.kind === 'monster')?.ref).toEqual({
      kind: 'monster',
      id: 'm1',
      cell: [13, 0],
    });
  });

  it('refs furniture, blocks and objectives', () => {
    const q = testQuest({
      furniture: [{ id: 'f1', type: 'chest', cells: [rockRoomCell] }],
      traps: [],
      blocks: [{ cells: [[13, 0]] }],
      objectives: [{ id: 'o1', text: 'x', done: { monsterKilled: 'nope' } }],
    });
    const refs = validateQuestIssues(q, board).map((i) => i.ref);
    expect(refs).toContainEqual({ kind: 'furniture', id: 'f1', cell: rockRoomCell });
    expect(refs).toContainEqual({ kind: 'block', id: 'b1', cell: [13, 0] });
    expect(refs).toContainEqual({ kind: 'objective', id: 'o1' });
  });

  it('editor check: a quest needs an objective (error), the game check does not', () => {
    const q = testQuest();
    expect(validateQuest(q, board)).toEqual([]);
    const issues = validateQuestIssues(q, board);
    expect(issues).toEqual([
      {
        message: 'The quest has no objective. Add at least one.',
        severity: 'error',
        ref: { kind: 'quest' },
      },
    ]);
    expect(validateQuestIssues(withObjective(), board)).toEqual([]);
  });

  it('editor check: lettered furniture needs a note with that letter', () => {
    const q = withObjective({
      furniture: [{ id: 'f1', type: 'chest', cells: [[6, 14]], letter: 'A' }],
    });
    const issues = validateQuestIssues(q, board);
    expect(issues).toEqual([
      expect.objectContaining({
        severity: 'error',
        message: 'furniture f1: letter A has no note',
        ref: { kind: 'furniture', id: 'f1', cell: [6, 14] },
      }),
    ]);
    const withNote = withObjective({
      furniture: [{ id: 'f1', type: 'chest', cells: [[6, 14]], letter: 'A' }],
      notes: [
        ...testQuest().notes,
        { id: 'n-A', letter: 'A', trigger: { type: 'treasureSearch', area: 'R17' }, effects: [] },
      ],
    });
    expect(validateQuestIssues(withNote, board)).toEqual([]);
  });

  it('editor check: a letter marker without a note is a warning, X is not a letter', () => {
    const q = withObjective({
      markers: [
        { id: 'k1', label: 'B', cell: [6, 15] },
        { id: 'k2', label: 'X', cell: [7, 15] },
        { id: 'k3', label: '12', cell: [7, 16] },
      ],
    });
    expect(validateQuestIssues(q, board)).toEqual([
      expect.objectContaining({
        severity: 'warning',
        ref: { kind: 'marker', id: 'k1', cell: [6, 15] },
      }),
    ]);
  });

  it('editor check: a note letter with nothing on the map is a warning, unless it has an `at`', () => {
    const lonely = withObjective({
      notes: [
        ...testQuest().notes,
        { id: 'n-C', letter: 'C', trigger: { type: 'questStart' }, effects: [] },
      ],
    });
    expect(validateQuestIssues(lonely, board)).toEqual([
      expect.objectContaining({ severity: 'warning', ref: { kind: 'note', id: 'n-C' } }),
    ]);
    const placed = withObjective({
      notes: [
        ...testQuest().notes,
        { id: 'n-C', letter: 'C', at: [6, 15], trigger: { type: 'questStart' }, effects: [] },
      ],
    });
    expect(validateQuestIssues(placed, board)).toEqual([]);
  });
});

describe('block names in messages', () => {
  it('use the same id as the ref (b1, b2...)', () => {
    const q = testQuest({ blocks: [{ cells: [[8, 18]] }, { cells: [[13, 0]] }] });
    const issues = validateQuestIssues(q, board, { editor: false });
    expect(issues).toEqual([
      expect.objectContaining({
        message: 'block b2: cell 13,0 is in rock',
        ref: { kind: 'block', id: 'b2', cell: [13, 0] },
      }),
    ]);
    const two = testQuest({ blocks: [{ cells: [[8, 18]] }, { cells: [[8, 18]] }] });
    expect(validateQuest(two, board)[0]).toBe('block b2: cell 8,18 is already used by block b1');
  });
});
