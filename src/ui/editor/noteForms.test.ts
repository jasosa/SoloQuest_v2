import { describe, expect, it } from 'vitest';
import { emptyQuest } from '../../engine/editor';
import { QuestSchema, type Quest } from '../../engine/quest/schema';
import {
  CONDITION_TYPES,
  EFFECT_TYPES,
  TRIGGER_TYPES,
  defaultCondition,
  defaultEffect,
  defaultTrigger,
  mainTextIndex,
  orderedNotes,
  parseMapLetter,
  parseWhole,
  removeAt,
  replaceAt,
  triggerSummary,
} from './noteForms';

const base = (): Quest => emptyQuest({ id: 'u-t', title: 'T', number: 1 });

describe('note form defaults', () => {
  it('every default trigger, effect and condition passes the schema when the quest has targets', () => {
    const q = {
      ...base(),
      doors: [{ id: 'd1', a: [1, 1], b: [2, 1] }],
      secretDoors: [{ id: 's1', a: [1, 2], b: [2, 2] }],
      monsters: [{ id: 'm1', type: 'orc', cell: [3, 3] }],
      traps: [{ id: 't1', kind: 'pit', cell: [4, 4] }],
      objectives: [{ id: 'o1', text: 'Win' }],
      npcs: [{ id: 'n1', name: 'N', cell: [5, 5], defend: 1, body: 1, text: '' }],
    } as Quest;
    for (const t of TRIGGER_TYPES) {
      const r = defaultTrigger(q, t.type);
      expect(r.ok, t.type).toBe(true);
      if (r.ok)
        expect(
          QuestSchema.safeParse({ ...q, notes: [{ id: 'n', trigger: r.value, effects: [] }] })
            .success,
          t.type,
        ).toBe(true);
    }
    for (const e of EFFECT_TYPES) {
      const r = defaultEffect(q, e.type);
      expect(r.ok, e.type).toBe(true);
      if (r.ok)
        expect(
          QuestSchema.safeParse({
            ...q,
            notes: [{ id: 'n', trigger: { type: 'questStart' }, effects: [r.value] }],
          }).success,
          e.type,
        ).toBe(true);
    }
    for (const c of CONDITION_TYPES) expect(defaultCondition(q, c.key).ok, c.key).toBe(true);
  });

  it('says what is missing when there is nothing to point at', () => {
    const q = base();
    expect(defaultTrigger(q, 'doorOpened')).toEqual({ ok: false, error: 'Add a door first.' });
    expect(defaultEffect(q, 'spawnNpc').ok).toBe(false);
    expect(defaultEffect(q, 'revealAll').ok).toBe(true);
  });
});

describe('note form parsers', () => {
  it('parses whole numbers', () => {
    expect(parseWhole('3')).toEqual({ ok: true, value: 3 });
    expect(parseWhole('', { optional: true })).toEqual({ ok: true, value: undefined });
    expect(parseWhole('').ok).toBe(false);
    expect(parseWhole('1.5').ok).toBe(false);
    expect(parseWhole('0', { min: 1 }).ok).toBe(false);
    expect(parseWhole('-2', { negative: true })).toEqual({ ok: true, value: -2 });
    expect(parseWhole('-2').ok).toBe(false);
  });

  it('a map letter is one capital, never X', () => {
    expect(parseMapLetter(' b ')).toEqual({ ok: true, value: 'B' });
    expect(parseMapLetter('')).toEqual({ ok: true, value: null });
    expect(parseMapLetter('X').ok).toBe(false);
    expect(parseMapLetter('AB').ok).toBe(false);
    expect(parseMapLetter('1').ok).toBe(false);
  });

  it('list helpers do not change the input', () => {
    const a = [1, 2, 3];
    expect(replaceAt(a, 1, 9)).toEqual([1, 9, 3]);
    expect(removeAt(a, 0)).toEqual([2, 3]);
    expect(a).toEqual([1, 2, 3]);
  });
});

describe('note list', () => {
  it('orders lettered notes first, then the rest', () => {
    const q = {
      ...base(),
      notes: [
        { id: 'a', trigger: { type: 'questStart' }, effects: [] },
        { id: 'c', letter: 'C', trigger: { type: 'questStart' }, effects: [] },
        { id: 'b', letter: 'B', trigger: { type: 'questStart' }, effects: [] },
      ],
    } as Quest;
    expect(orderedNotes(q).map((n) => n.id)).toEqual(['b', 'c', 'a']);
    expect(mainTextIndex(q.notes[0]!)).toBe(-1);
    expect(triggerSummary({ type: 'zargonTurn', every: 3 })).toBe('Every 3 Zargon turns');
  });
});
