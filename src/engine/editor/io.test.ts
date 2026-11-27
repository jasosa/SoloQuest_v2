import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseQuest } from '../quest/loader';
import type { Quest } from '../quest/schema';
import { testQuest } from '../quest/testQuest';
import {
  QUEST_FILE_EXTENSION,
  exportQuest,
  exportQuestChecked,
  importQuest,
  questFileName,
} from './io';
import { emptyQuest } from './ops';

const q01 = parseQuest(
  JSON.parse(
    readFileSync(resolve(import.meta.dirname, '../../content/quests/q01-the-trial.json'), 'utf8'),
  ),
);

describe('export', () => {
  it('uses the .hqquest.json extension', () => {
    expect(QUEST_FILE_EXTENSION).toBe('.hqquest.json');
    expect(questFileName(q01)).toBe('q01-the-trial.hqquest.json');
  });
  it('strips userText and nothing else', () => {
    const withText: Quest = { ...q01, intro: { ...q01.intro, userText: 'my private notes' } };
    const text = exportQuest(withText);
    expect(text).not.toContain('userText');
    expect(text).not.toContain('my private notes');
    expect(withText.intro.userText).toBe('my private notes');
    expect(JSON.parse(text).intro).toEqual(q01.intro);
  });
  it('has a stable key order and compact cell pairs', () => {
    const text = exportQuest(q01);
    expect(Object.keys(JSON.parse(text)).slice(0, 5)).toEqual([
      'schemaVersion',
      'id',
      'number',
      'title',
      'intro',
    ]);
    expect(text).toContain('"a": [3, 17]');
    expect(text.endsWith('}\n')).toBe(true);
    expect(exportQuest(parseQuest(JSON.parse(text)))).toBe(text);
  });
  it('does not touch text that looks like a cell pair', () => {
    const q = {
      ...emptyQuest({ id: 'user-a', number: 1, title: 'A' }),
      rewards: 'pair [1,   2] stays',
    };
    expect(JSON.parse(exportQuest(q)).rewards).toBe('pair [1,   2] stays');
  });
  it('checked export refuses a quest with errors and passes warnings', () => {
    const empty = emptyQuest({ id: 'user-a', number: 1, title: 'A' });
    const r = exportQuestChecked(empty);
    expect(r).toEqual({ ok: false, errors: ['The quest has no objective. Add at least one.'] });
    const done: Quest = {
      ...empty,
      objectives: [{ id: 'o1', text: 'Win', done: { flag: 'won' } }],
      notes: [
        {
          id: 'n1',
          trigger: { type: 'manual', label: 'win' },
          effects: [{ type: 'setFlag', flag: 'won', value: true }],
        },
        {
          id: 'n-Q',
          letter: 'Q',
          trigger: { type: 'questStart' },
          effects: [],
        },
      ],
    };
    const ok = exportQuestChecked(done);
    expect(ok.ok).toBe(true);
    expect(ok.ok && ok.warnings.map((w) => w.message)).toEqual([
      'note n-Q: letter Q is not on the map',
    ]);
  });
});

describe('import', () => {
  it('round-trips quest 1 (minus userText)', () => {
    const r = importQuest(exportQuest(q01));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.quest).toEqual({ ...q01, status: 'draft' }); // an import is a draft
      expect(r.warnings).toEqual([]);
    }
    const withText: Quest = { ...q01, intro: { ...q01.intro, userText: 'x' } };
    const again = importQuest(exportQuest(withText));
    expect(again.ok && again.quest).toEqual({ ...q01, status: 'draft' });
  });
  it('drops userText found in a file and says so', () => {
    const data = JSON.parse(exportQuest(q01));
    data.intro.userText = 'not mine';
    const r = importQuest(JSON.stringify(data));
    expect(r.ok && r.quest.intro.userText).toBeUndefined();
    expect(r.ok && r.warnings[0]?.message).toMatch(/userText/);
  });
  it('rejects text that is not JSON', () => {
    const r = importQuest('this is not json');
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errors[0]).toMatch(/not valid JSON/);
    expect(importQuest('').ok).toBe(false);
  });
  it('rejects a wrong or missing version with a clear message', () => {
    const data = JSON.parse(exportQuest(q01));
    const wrong = importQuest(JSON.stringify({ ...data, schemaVersion: 7 }));
    expect(!wrong.ok && wrong.errors[0]).toMatch(/Unsupported quest schemaVersion 7/);
    const none = importQuest(JSON.stringify({ ...data, schemaVersion: undefined }));
    expect(!none.ok && none.errors[0]).toMatch(/no schemaVersion/);
    for (const v of ['[]', 'null', '42', '"quest"']) {
      const r = importQuest(v);
      expect(r.ok).toBe(false);
    }
  });
  it('reports wrong types with paths', () => {
    const data = JSON.parse(exportQuest(q01));
    data.title = 5;
    data.doors[0].a = 'x';
    const r = importQuest(JSON.stringify(data));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errors.join('\n')).toMatch(/title:/);
    expect(!r.ok && r.errors.join('\n')).toMatch(/doors\.0\.a/);
  });
  it('rejects huge, negative and fractional numbers without crashing', () => {
    const data = JSON.parse(exportQuest(q01));
    for (const n of ['1e999', '99999999999999999999', '-1', '0.5']) {
      const text = JSON.stringify(data).replace('"a":[3,17]', `"a":[${n},17]`);
      const r = importQuest(text);
      expect(r.ok, n).toBe(false);
    }
    const huge = { ...data, number: 1e300 };
    // a huge number is a valid integer for the schema: it must still not crash
    expect(() => importQuest(JSON.stringify(huge))).not.toThrow();
  });
  it('reports game-rule errors from the validator', () => {
    const data = JSON.parse(exportQuest(q01));
    data.doors[0].b = [3, 17];
    const r = importQuest(JSON.stringify(data));
    expect(!r.ok && r.errors.join('\n')).toMatch(/not orthogonal|same area|not on a wall/);
  });
  it('rejects unknown keys, a huge file and deep nesting', () => {
    const data = JSON.parse(exportQuest(q01));
    expect(importQuest(JSON.stringify({ ...data, extra: 1 })).ok).toBe(false);
    expect(importQuest(JSON.stringify({ ...data, ['__proto__']: 1 })).ok).toBe(false);
    expect(importQuest('x'.repeat(3_000_000)).ok).toBe(false);
    const deep = '['.repeat(50_000) + ']'.repeat(50_000);
    expect(() => importQuest(deep)).not.toThrow();
    expect(importQuest(deep).ok).toBe(false);
  });
  it('a quest with an editor-only error does not import', () => {
    const text = JSON.stringify(testQuest());
    const r = importQuest(text);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errors).toEqual(['The quest has no objective. Add at least one.']);
  });
});

describe('import with options (the UI import flow)', () => {
  it('keeps the id when no options are given', () => {
    const r = importQuest(exportQuest(q01));
    expect(r.ok && r.quest.id).toBe('q01-the-trial');
    expect(r.ok && r.idRewritten).toBeUndefined();
  });
  it('rewrites a bundled id to a free user id and says so', () => {
    const r = importQuest(exportQuest(q01), { takenIds: ['user-the-trial'] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.quest.id).toBe('user-the-trial-2');
    expect(r.idRewritten).toEqual({ from: 'q01-the-trial', to: 'user-the-trial-2' });
    expect(r.warnings.map((w) => w.message).join()).toMatch(
      /q01-the-trial was changed to user-the-trial-2/,
    );
  });
  it('rewrites a user id that is taken, and keeps a free one', () => {
    const user = exportQuest({ ...q01, id: 'user-mine' });
    const taken = importQuest(user, { takenIds: ['user-mine'] });
    expect(taken.ok && taken.quest.id).toBe('user-the-trial');
    const free = importQuest(user, { takenIds: [] });
    expect(free.ok && free.quest.id).toBe('user-mine');
    expect(free.ok && free.idRewritten).toBeUndefined();
    expect(free.ok && free.warnings).toEqual([]);
  });
});
