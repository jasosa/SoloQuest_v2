import { describe, expect, it } from 'vitest';
import { board } from '../board/board';
import { buildLevel } from '../board/level';
import { replay } from '../game/reducer';
import { parseQuest } from '../quest/loader';
import { testQuestData } from '../quest/testQuest';
import { validateQuest } from '../quest/validate';
import { behaviorLines, ordersFor } from './orders';

const TEAM = ['barbarian', 'dwarf'] as const;
const quest = (behavior: unknown, markers: unknown[] = []) =>
  parseQuest({
    ...testQuestData,
    markers,
    notes: [],
    monsters: [{ id: 'm1', type: 'orc', cell: [6, 15], behavior }],
  });

describe('monster behavior prompts (decision 71)', () => {
  it('lines for waits and goes toward, with the marker label', () => {
    const q = quest({ waitsFor: 'heroInRoom', goesToward: 'marker', marker: 'k1' }, [
      { id: 'k1', label: 'The altar', cell: [10, 15] },
    ]);
    expect(behaviorLines(q.monsters[0], q.markers)).toEqual([
      'Waits: it does nothing until a hero is in its room.',
      'Goes toward the marked square "The altar", not the nearest hero.',
    ]);
    expect(behaviorLines({}, [])).toEqual([]);
    expect(behaviorLines(quest({ goesToward: 'stayPut' }).monsters[0], [])).toEqual([
      'Stays where it is. It only attacks a hero next to it.',
    ]);
  });

  it('a monster that guards a marked square says so, and needs the marker', () => {
    const q = quest({ goesToward: 'guardMarker', marker: 'k1' }, [
      { id: 'k1', label: 'The chest', cell: [10, 15] },
    ]);
    expect(behaviorLines(q.monsters[0], q.markers)).toEqual([
      'Guards the marked square "The chest": it stays close to it and only attacks a hero who comes near.',
    ]);
    expect(() => quest({ goesToward: 'guardMarker' })).toThrow();
  });

  it('the Zargon order shows the lines before the other special rules', () => {
    const q = quest({ waitsFor: 'heroInSight', goesToward: 'strongestHero' });
    const lv = buildLevel(q);
    const s = replay(lv, 1, [
      { type: 'OPEN_DOOR', door: 'd2' },
      { type: 'OPEN_DOOR', door: 'd3' },
    ]);
    const o = ordersFor(lv, s, [...TEAM]).find((x) => x.monster === 'm1');
    expect(o?.special.slice(0, 2)).toEqual([
      'Waits: it does nothing until a hero is in its line of sight.',
      'Goes toward the hero with the most Body Points left, not the nearest.',
    ]);
  });

  it('the schema needs a marker id with goesToward marker, and nothing else', () => {
    expect(() => quest({ goesToward: 'marker' })).toThrow();
    expect(() => quest({ goesToward: 'stayPut', marker: 'k1' })).toThrow();
    expect(() => quest({ waitsFor: 'nothing' })).toThrow();
  });

  it('the validator rejects a marker that does not exist', () => {
    const bad = quest({ goesToward: 'marker', marker: 'nope' });
    expect(validateQuest(bad, board).some((m) => m.includes('unknown marker nope'))).toBe(true);
    const ok = quest({ goesToward: 'marker', marker: 'k1' }, [
      { id: 'k1', label: 'x', cell: [10, 15] },
    ]);
    expect(validateQuest(ok, board).filter((m) => m.includes('marker'))).toEqual([]);
  });
});
