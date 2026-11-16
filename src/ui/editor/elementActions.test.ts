import { describe, expect, it } from 'vitest';
import { addNote, updateNote, type EditResult } from '../../engine/editor';
import { addMarker } from '../../engine/editor/ops';
import { parseQuest } from '../../engine/quest/loader';
import { testQuestData } from '../../engine/quest/testQuest';
import type { Quest } from '../../engine/quest/schema';
import { actionTemplates, actionsOf, elementOf } from './elementActions';

const base = (): Quest => parseQuest(testQuestData);
const good = (r: EditResult): Quest => {
  if (!r.ok) throw new Error(r.error);
  return r.quest;
};

describe('elementOf', () => {
  it('a door, monster, trap and furniture are themselves; a marker is its square', () => {
    const q = good(addMarker(base(), 'X', [3, 16], 'editor'));
    const m = q.markers[0]!;
    expect(elementOf(q, { kind: 'door', id: 'd1' })).toEqual({ kind: 'door', id: 'd1' });
    expect(elementOf(q, { kind: 'marker', id: m.id })).toEqual({ kind: 'square', id: '3,16' });
    expect(elementOf(q, { kind: 'block', cell: [8, 18] })).toBeUndefined();
    expect(elementOf(q, null)).toBeUndefined();
  });
});

describe('actionTemplates', () => {
  const q = base();
  it('a normal door can be opened or have a button; a false door only a button', () => {
    expect(actionTemplates(q, { kind: 'door', id: 'd1' }).map((t) => t.key)).toEqual([
      'opened',
      'button',
    ]);
    expect(actionTemplates(q, { kind: 'door', id: 'x1' }).map((t) => t.key)).toEqual(['button']);
  });

  it('monsters, traps and furniture offer their events and a button', () => {
    expect(actionTemplates(q, { kind: 'monster', id: 'm1' }).map((t) => t.key)).toEqual([
      'seen',
      'killed',
      'button',
    ]);
    expect(actionTemplates(q, { kind: 'trap', id: 't1' }).map((t) => t.key)).toEqual([
      'sprung',
      'disarmed',
      'button',
    ]);
    expect(actionTemplates(q, { kind: 'furniture', id: 'f1' }).map((t) => t.key)).toEqual([
      'button',
    ]);
  });

  it('a button names its element; an event does not need to', () => {
    const [opened, button] = actionTemplates(q, { kind: 'door', id: 'd2' });
    expect(opened?.target).toBeUndefined();
    expect(button).toMatchObject({
      trigger: { type: 'manual' },
      target: { kind: 'door', id: 'd2' },
    });
  });

  it('a marker offers "a hero is here" on its square and a button on that square', () => {
    const withMarker = good(addMarker(base(), 'X', [3, 16], 'editor'));
    const m = withMarker.markers[0]!;
    const t = actionTemplates(withMarker, { kind: 'marker', id: m.id });
    expect(t.map((x) => x.key)).toEqual(['here', 'button']);
    expect(t[0]?.trigger).toEqual({ type: 'squareEntered', cell: [3, 16] });
    expect(t[1]?.target).toEqual({ kind: 'square', id: '3,16' });
  });

  it('nothing for a block or no selection', () => {
    expect(actionTemplates(q, { kind: 'block', cell: [8, 18] })).toEqual([]);
    expect(actionTemplates(q, null)).toEqual([]);
  });
});

describe('actionsOf', () => {
  it('lists the notes of the element, derived or explicit, and nothing else', () => {
    let q = base();
    q = good(addNote(q, { id: 'a1', trigger: { type: 'doorOpened', door: 'd2' } }));
    q = good(
      addNote(q, {
        id: 'a2',
        trigger: { type: 'manual', label: 'Pull' },
        target: { kind: 'door', id: 'd2' },
      }),
    );
    q = good(addNote(q, { id: 'a3', trigger: { type: 'doorOpened', door: 'd3' } }));
    expect(actionsOf(q, { kind: 'door', id: 'd2' }).map((n) => n.id)).toEqual(['a1', 'a2']);
    expect(actionsOf(q, { kind: 'door', id: 'd3' }).map((n) => n.id)).toEqual(['a3']);
    expect(actionsOf(q, { kind: 'door', id: 'd1' })).toEqual([]);
  });
});

describe('note target in the editor operations', () => {
  it('addNote keeps the target, updateNote sets and clears it', () => {
    let q = good(
      addNote(base(), {
        id: 'b1',
        trigger: { type: 'manual', label: 'Press' },
        target: { kind: 'monster', id: 'm1' },
      }),
    );
    expect(q.notes.find((n) => n.id === 'b1')?.target).toEqual({ kind: 'monster', id: 'm1' });
    q = good(updateNote(q, 'b1', { target: { kind: 'door', id: 'd1' } }));
    expect(q.notes.find((n) => n.id === 'b1')?.target).toEqual({ kind: 'door', id: 'd1' });
    q = good(updateNote(q, 'b1', { target: null }));
    expect(q.notes.find((n) => n.id === 'b1')?.target).toBeUndefined();
  });
});
