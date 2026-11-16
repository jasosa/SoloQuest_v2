import { describe, expect, it } from 'vitest';
import { board } from '../board/board';
import { buildLevel } from '../board/level';
import { parseQuest } from '../quest/loader';
import { testQuestData } from '../quest/testQuest';
import { validateQuest } from '../quest/validate';
import { reduce, replay } from './reducer';
import { endSummary } from './view';

const note = (id: string, trigger: unknown, text: string) => ({
  id,
  trigger,
  effects: [{ type: 'showText', text }],
});
const quest = (notes: unknown[], extra: Record<string, unknown> = {}) =>
  parseQuest({ ...testQuestData, notes, ...extra });

describe('the quest ends trigger (decision 71)', () => {
  it('its note shows in the end summary, for any outcome', () => {
    const lv = buildLevel(quest([note('n1', { type: 'questEnds' }, 'The cellar goes quiet.')]));
    const s = replay(lv, 1, [{ type: 'END_QUEST', outcome: 'stairs' }]);
    expect(endSummary(lv, s)?.endNotes).toEqual(['The cellar goes quiet.']);
    const f = replay(lv, 1, [{ type: 'END_QUEST', outcome: 'fell' }]);
    expect(endSummary(lv, f)?.endNotes).toEqual(['The cellar goes quiet.']);
  });

  it('an outcome limits it', () => {
    const lv = buildLevel(
      quest([note('n1', { type: 'questEnds', outcome: 'fell' }, 'They fell.')]),
    );
    expect(
      endSummary(lv, replay(lv, 1, [{ type: 'END_QUEST', outcome: 'stairs' }]))?.endNotes,
    ).toEqual([]);
    expect(
      endSummary(lv, replay(lv, 1, [{ type: 'END_QUEST', outcome: 'fell' }]))?.endNotes,
    ).toEqual(['They fell.']);
  });

  it('a custom ending can have its own note', () => {
    const lv = buildLevel(
      quest(
        [
          note('n1', { type: 'questEnds', outcome: 'ending', ending: 'e1' }, 'Ragnar is gone.'),
          note('n2', { type: 'questEnds' }, 'Always.'),
        ],
        { endings: [{ id: 'e1', label: 'Ragnar died' }] },
      ),
    );
    const s = reduce(lv, replay(lv, 1, []), {
      type: 'END_QUEST',
      outcome: 'ending',
      ending: 'e1',
    }).state;
    expect(endSummary(lv, s)?.endNotes).toEqual(['Ragnar is gone.', 'Always.']);
  });

  it('with no such note the list is empty, and the quest still ends once', () => {
    const lv = buildLevel(quest([]));
    const s = replay(lv, 1, [{ type: 'END_QUEST', outcome: 'stairs' }]);
    expect(endSummary(lv, s)?.endNotes).toEqual([]);
    expect(() => reduce(lv, s, { type: 'END_QUEST', outcome: 'stairs' })).toThrow();
  });

  it('the validator checks the ending id', () => {
    const bad = quest([note('n1', { type: 'questEnds', outcome: 'ending', ending: 'zz' }, 'x')]);
    expect(validateQuest(bad, board).some((m) => m.includes('unknown ending zz'))).toBe(true);
    const noOutcome = quest([note('n1', { type: 'questEnds', ending: 'e1' }, 'x')], {
      endings: [{ id: 'e1', label: 'L' }],
    });
    expect(validateQuest(noOutcome, board).some((m) => m.includes('needs outcome'))).toBe(true);
  });
});
