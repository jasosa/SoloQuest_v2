import { describe, expect, it } from 'vitest';
import { addNote, type EditResult } from '../../engine/editor';
import { parseQuest } from '../../engine/quest/loader';
import type { Note, Quest } from '../../engine/quest/schema';
import { testQuestData } from '../../engine/quest/testQuest';
import {
  changeTrigger,
  markerSubject,
  parseSubjectKey,
  retarget,
  subjectChoices,
  subjectKey,
  subjectLabel,
  subjectOf,
  triggerChoices,
  triggerFor,
} from './actionSubjects';

const base = (): Quest => parseQuest({ ...testQuestData, zones: [{ id: 'z1', cells: [[2, 15]] }] });
const good = (r: EditResult): Quest => {
  if (!r.ok) throw new Error(r.error);
  return r.quest;
};
const note = (extra: Partial<Note>): Note =>
  ({ id: 'n', trigger: { type: 'questStart' }, effects: [], ...extra }) as Note;

describe('subjectOf', () => {
  it('is the quest when the note has no element, else its target', () => {
    expect(subjectOf(note({}))).toEqual({ kind: 'quest' });
    expect(subjectOf(note({ trigger: { type: 'doorOpened', door: 'd1' } }))).toEqual({
      kind: 'door',
      id: 'd1',
    });
    expect(
      subjectOf(
        note({
          trigger: { type: 'manual', label: 'b' },
          target: { kind: 'zone', id: 'z1' },
        }),
      ),
    ).toEqual({ kind: 'zone', id: 'z1' });
  });
});

describe('triggerChoices', () => {
  it('lists only the triggers that fit', () => {
    const types = (k: Parameters<typeof triggerChoices>[0]) => triggerChoices(k).map((c) => c.type);
    expect(types({ kind: 'quest' })).toEqual([
      'questStart',
      'questEnds',
      'zargonTurn',
      'allKilled',
      'manual',
    ]);
    expect(types({ kind: 'area', id: 'R03' })).toEqual([
      'areaRevealed',
      'areaEntered',
      'treasureSearch',
      'secretDoorSearch',
      'manual',
    ]);
    expect(types({ kind: 'zone', id: 'z1' })).toEqual(['zoneEntered', 'manual']);
    expect(types({ kind: 'square', id: '3,16' })).toEqual(['squareEntered', 'manual']);
    expect(types({ kind: 'monster', id: 'm1' })).toEqual([
      'monsterSeen',
      'monsterKilled',
      'spellCast',
      'manual',
    ]);
    expect(types({ kind: 'furniture', id: 'f1' })).toEqual(['manual']);
  });
});

describe('triggerFor', () => {
  const q = base();
  it('fills the element into the trigger, with no explicit target', () => {
    expect(triggerFor(q, { kind: 'area', id: 'R03' }, 'areaEntered')).toEqual({
      ok: true,
      value: { trigger: { type: 'areaEntered', area: 'R03' }, target: undefined },
    });
    expect(triggerFor(q, { kind: 'square', id: '3,16' }, 'squareEntered')).toMatchObject({
      ok: true,
      value: { trigger: { type: 'squareEntered', cell: [3, 16] } },
    });
    expect(triggerFor(q, { kind: 'zone', id: 'z1' }, 'zoneEntered')).toMatchObject({
      ok: true,
      value: { trigger: { type: 'zoneEntered', zone: 'z1' } },
    });
  });

  it('a button names its subject; the quest button has none', () => {
    expect(triggerFor(q, { kind: 'door', id: 'd2' }, 'manual')).toMatchObject({
      ok: true,
      value: { target: { kind: 'door', id: 'd2' } },
    });
    expect(triggerFor(q, { kind: 'quest' }, 'manual')).toMatchObject({
      ok: true,
      value: { target: undefined },
    });
  });

  it('keeps the label, hint and repeat of an existing button', () => {
    const old = { type: 'manual', label: 'Pull', hint: 'Carefully', repeat: true } as const;
    const r = triggerFor(q, { kind: 'door', id: 'd2' }, 'manual', old);
    expect(r).toMatchObject({ ok: true, value: { trigger: old } });
  });

  it('refuses a trigger that does not fit', () => {
    expect(triggerFor(q, { kind: 'door', id: 'd1' }, 'zoneEntered').ok).toBe(false);
    expect(triggerFor(q, { kind: 'furniture', id: 'f1' }, 'doorOpened').ok).toBe(false);
  });

  it('the quest triggers need no element', () => {
    expect(triggerFor(q, { kind: 'quest' }, 'questStart')).toMatchObject({
      ok: true,
      value: { trigger: { type: 'questStart' } },
    });
    expect(triggerFor(q, { kind: 'quest' }, 'zargonTurn')).toMatchObject({
      ok: true,
      value: { trigger: { type: 'zargonTurn' } },
    });
  });
});

describe('retarget and changeTrigger', () => {
  const q = base();
  it('moving an area action to another area keeps the kind of trigger', () => {
    const n = note({ trigger: { type: 'areaEntered', area: 'R03' } });
    expect(retarget(q, n, { kind: 'area', id: 'R05' })).toEqual({
      ok: true,
      value: { trigger: { type: 'areaEntered', area: 'R05' }, target: null },
    });
  });

  it('moving to a subject where the trigger does not fit takes the first one that does', () => {
    const n = note({ trigger: { type: 'areaEntered', area: 'R03' } });
    expect(retarget(q, n, { kind: 'zone', id: 'z1' })).toEqual({
      ok: true,
      value: { trigger: { type: 'zoneEntered', zone: 'z1', repeat: true }, target: null },
    });
    expect(retarget(q, n, { kind: 'quest' })).toMatchObject({
      ok: true,
      value: { trigger: { type: 'questStart' } },
    });
  });

  it('a button follows its subject', () => {
    const n = note({
      trigger: { type: 'manual', label: 'Pull' },
      target: { kind: 'door', id: 'd1' },
    });
    expect(retarget(q, n, { kind: 'monster', id: 'm1' })).toEqual({
      ok: true,
      value: {
        trigger: { type: 'manual', label: 'Pull' },
        target: { kind: 'monster', id: 'm1' },
      },
    });
  });

  it('changeTrigger stays on the same subject', () => {
    const n = note({ trigger: { type: 'monsterSeen', monster: 'm1' } });
    expect(changeTrigger(q, n, 'monsterKilled')).toEqual({
      ok: true,
      value: { trigger: { type: 'monsterKilled', monster: 'm1' }, target: null },
    });
    expect(changeTrigger(q, n, 'manual')).toMatchObject({
      ok: true,
      value: { target: { kind: 'monster', id: 'm1' } },
    });
  });
});

describe('subjects as a list', () => {
  it('lists the quest, rooms, zones, doors, furniture, monsters and traps of the quest', () => {
    const keys = subjectChoices(base()).map(subjectKey);
    expect(keys[0]).toBe('quest');
    expect(keys).toContain('area:R01');
    expect(keys).toContain('area:C');
    expect(keys).toContain('zone:z1');
    expect(keys).toContain('door:d1');
    expect(keys).toContain('door:s1');
    expect(keys).toContain('furniture:f1');
    expect(keys).toContain('monster:m1');
    expect(keys).toContain('trap:t1');
  });

  it('keys round-trip, and labels are plain words', () => {
    const q = base();
    for (const s of subjectChoices(q)) expect(parseSubjectKey(subjectKey(s))).toEqual(s);
    expect(parseSubjectKey('nonsense')).toBeUndefined();
    expect(subjectLabel(q, { kind: 'quest' })).toBe('The quest');
    expect(subjectLabel(q, { kind: 'area', id: 'R03' })).toBe('Room R03');
    expect(subjectLabel(q, { kind: 'door', id: 's1' })).toBe('Secret door s1');
    expect(subjectLabel(q, { kind: 'monster', id: 'm1' })).toBe('Monster m1 (Orc)');
  });

  it('a marker is its square', () => {
    const q = good(addNote(base(), { id: 'x', trigger: { type: 'squareEntered', cell: [3, 16] } }));
    expect(markerSubject(q, 'nope')).toBeUndefined();
  });
});
