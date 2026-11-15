import { describe, expect, it } from 'vitest';
import { board } from '../../engine/board/board';
import { addMonster, emptyQuest, validateQuestIssues } from '../../engine/editor';
import type { Issue } from '../../engine/quest/validate';
import { countLabel, jumpFor, refLabel, sortIssues } from './problems';

const base = emptyQuest({ id: 'user-test', number: 1, title: 'Test' });
const withMonster = (() => {
  const r = addMonster(base, 'orc', [6, 2]);
  if (!r.ok) throw new Error(r.error);
  return r.quest;
})();

const issue = (severity: Issue['severity'], message: string): Issue => ({ severity, message });

describe('problems panel helpers', () => {
  it('lists errors first and keeps the order inside each group', () => {
    const sorted = sortIssues([
      issue('warning', 'w1'),
      issue('error', 'e1'),
      issue('warning', 'w2'),
      issue('error', 'e2'),
    ]);
    expect(sorted.map((i) => i.message)).toEqual(['e1', 'e2', 'w1', 'w2']);
  });

  it('counts for the header', () => {
    expect(countLabel([])).toBe('No problems');
    expect(countLabel([issue('warning', 'a')])).toBe('1 warning');
    expect(countLabel([issue('error', 'a'), issue('warning', 'b'), issue('error', 'c')])).toBe(
      '2 problems',
    );
  });

  it('jumps to an element: selects it and flashes its square', () => {
    const j = jumpFor(withMonster, { kind: 'monster', id: 'm1' });
    expect(j.panel).toBe('element');
    expect(j.selection).toEqual({ kind: 'monster', id: 'm1' });
    expect(j.flash.cells).toEqual([[6, 2]]);
  });

  it('jumps to a note in the notes tab, and an area flashes the whole area', () => {
    expect(jumpFor(withMonster, { kind: 'note', id: 'nope' })).toMatchObject({
      panel: 'notes',
      noteId: null,
    });
    const a = jumpFor(withMonster, { kind: 'area', area: 'R03' });
    expect(a.flash.areas).toEqual(['R03']);
    expect(a.panel).toBe('problems');
    expect(a.selection).toBeNull();
  });

  it('a block ref selects the block square; refs with nothing to select show the quest', () => {
    expect(jumpFor(base, { kind: 'block', cell: [3, 4] }).selection).toEqual({
      kind: 'block',
      cell: [3, 4],
    });
    const q = jumpFor(base, { kind: 'quest' });
    expect(q.selection).toBeNull();
    expect(q.panel).toBe('element');
    expect(jumpFor(base, undefined).panel).toBe('problems');
  });

  it('every ref the validator gives for an empty quest can be jumped to', () => {
    for (const i of validateQuestIssues(base, board)) {
      expect(() => jumpFor(base, i.ref)).not.toThrow();
      expect(refLabel(i.ref).length).toBeGreaterThan(0);
    }
  });
});
