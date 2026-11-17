import { describe, expect, it } from 'vitest';
import { board } from '../board/board';
import { buildLevel } from '../board/level';
import { addZone, removeZone, toggleZoneCell, type EditResult } from '../editor';
import { parseQuest } from '../quest/loader';
import type { Quest } from '../quest/schema';
import { noteTarget } from '../quest/targets';
import { testQuest, testQuestData } from '../quest/testQuest';
import { validateQuest } from '../quest/validate';
import { EventError } from './errors';
import type { GameEvent } from './events';
import { initialState, reduce } from './reducer';
import { elementQuest, zoneLabels } from './view';

const SEED = 3;
const enter = (zone: string): GameEvent => ({ type: 'ZONE_ENTER', zone });
const text = (t: string) => ({ type: 'showText', text: t }) as const;

// z1 lies in the start room (seen at once), z2 in the study (not seen at the start).
const lv = buildLevel(
  testQuest({
    zones: [
      {
        id: 'z1',
        cells: [
          [3, 15],
          [2, 15],
          [2, 16],
        ],
      },
      { id: 'z2', cells: [[6, 17]] },
    ],
    notes: [
      { id: 'in-z1', trigger: { type: 'zoneEntered', zone: 'z1' }, effects: [text('Cold air.')] },
      {
        id: 'btn-z2',
        trigger: { type: 'manual', label: 'Pull the chain' },
        target: { kind: 'zone', id: 'z2' },
        effects: [text('A gate lifts.')],
      },
    ],
  }),
);

describe('zones (decision 68)', () => {
  it('a seen zone with a note waiting gets one label, at its first seen square', () => {
    const s = initialState(lv, SEED);
    const labels = zoneLabels(lv, s);
    expect(labels).toHaveLength(1);
    expect(labels[0]).toMatchObject({ zone: 'z1', cell: [2, 15], enter: true });
    expect(labels[0]?.cells.length).toBeGreaterThan(0);
  });

  it('ZONE_ENTER fires the note once; the zone stays marked but nothing waits', () => {
    const s = initialState(lv, SEED);
    const r = reduce(lv, s, enter('z1'));
    expect(r.state.notesFired).toContain('in-z1');
    expect(r.prompts.some((p) => p.kind === 'note')).toBe(true);
    expect(zoneLabels(lv, r.state).map((z) => [z.zone, z.enter])).toEqual([['z1', false]]);
    expect(() => reduce(lv, r.state, enter('z1'))).toThrow(EventError);
  });

  it('refuses a zone that is unknown, not seen, or has nothing waiting', () => {
    const s = initialState(lv, SEED);
    expect(() => reduce(lv, s, enter('nope'))).toThrow(EventError);
    expect(() => reduce(lv, s, enter('z2'))).toThrow(EventError); // no zoneEntered note, not seen
  });

  it('a note derives its target from a zoneEntered trigger, and a button names the zone', () => {
    expect(noteTarget(lv.quest.notes[0]!)).toEqual({ kind: 'zone', id: 'z1' });
    expect(noteTarget(lv.quest.notes[1]!)).toEqual({ kind: 'zone', id: 'z2' });
    const s = initialState(lv, SEED);
    expect(elementQuest(lv, s, 'zone', 'z1').read).toEqual([]);
    expect(elementQuest(lv, s, 'zone', 'z2').buttons).toEqual([
      { note: 'btn-z2', label: 'Pull the chain' },
    ]);
  });

  it('after the entry note is read, the zone lists it under For this quest', () => {
    const r = reduce(lv, initialState(lv, SEED), enter('z1'));
    expect(elementQuest(lv, r.state, 'zone', 'z1').read.map((e) => e.id)).toEqual(['in-z1']);
  });
});

describe('zones in the validator and the editor', () => {
  const good = (r: EditResult): Quest => {
    if (!r.ok) throw new Error(r.error);
    return r.quest;
  };
  const base = (): Quest => parseQuest(testQuestData);

  it('the test quest with zones is valid', () => {
    expect(validateQuest(lv.quest, board).filter((m) => m.includes('zone'))).toEqual([]);
  });

  it('rejects a trigger or a target that names a zone that does not exist', () => {
    const q = parseQuest({
      ...testQuestData,
      notes: [
        ...testQuestData.notes,
        { id: 'bad1', trigger: { type: 'zoneEntered', zone: 'zz' }, effects: [text('x')] },
        {
          id: 'bad2',
          trigger: { type: 'manual', label: 'b' },
          target: { kind: 'zone', id: 'zz' },
          effects: [text('x')],
        },
      ],
    });
    const msgs = validateQuest(q, board);
    expect(msgs.some((m) => m.includes('unknown zone zz'))).toBe(true);
    expect(msgs.some((m) => m.includes('target zone zz does not exist'))).toBe(true);
  });

  it('addZone starts a zone, toggleZoneCell grows and shrinks it, removeZone deletes it', () => {
    let q = good(addZone(base(), [2, 15]));
    expect(q.zones).toEqual([{ id: 'z1', cells: [[2, 15]] }]);
    q = good(toggleZoneCell(q, 'z1', [3, 15]));
    expect(q.zones[0]?.cells).toEqual([
      [2, 15],
      [3, 15],
    ]);
    q = good(toggleZoneCell(q, 'z1', [2, 15]));
    expect(q.zones[0]?.cells).toEqual([[3, 15]]);
    const last = toggleZoneCell(q, 'z1', [3, 15]);
    expect(last.ok).toBe(false); // the last square: delete the zone instead
    q = good(removeZone(q, 'z1'));
    expect(q.zones).toEqual([]);
  });

  it('a zone cannot start in rock or outside the board', () => {
    expect(addZone(base(), [-1, 0]).ok).toBe(false);
    expect(addZone(base(), [40, 40]).ok).toBe(false);
  });

  it('removing a zone that a note points at warns about the note', () => {
    const withNote = parseQuest({
      ...testQuestData,
      zones: [{ id: 'z1', cells: [[2, 15]] }],
      notes: [
        ...testQuestData.notes,
        { id: 'n-z', trigger: { type: 'zoneEntered', zone: 'z1' }, effects: [text('x')] },
      ],
    });
    const r = removeZone(withNote, 'z1');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.warnings.some((w) => w.message.includes('zone z1'))).toBe(true);
  });
});

describe('updateMarker', () => {
  it('changes the label and who sees it, and refuses an empty label', async () => {
    const { addMarker, updateMarker } = await import('../editor');
    const q0 = parseQuest(testQuestData);
    const a = addMarker(q0, 'X', [3, 16], 'editor');
    if (!a.ok) throw new Error(a.error);
    const id = a.quest.markers[0]!.id;
    const b = updateMarker(a.quest, id, { label: ' 7 ', visible: 'players' });
    if (!b.ok) throw new Error(b.error);
    expect(b.quest.markers[0]).toMatchObject({ label: '7', visible: 'players' });
    expect(updateMarker(a.quest, id, { label: '  ' }).ok).toBe(false);
    expect(updateMarker(a.quest, 'nope', { label: 'A' }).ok).toBe(false);
  });
});
