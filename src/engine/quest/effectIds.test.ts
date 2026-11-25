import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { questStrings, translateQuest } from '../../i18n/questText';
import { addNote, updateNote } from '../editor/notes';
import { assignEffectIds } from './effectIds';
import { parseQuest } from './loader';
import type { Effect } from './schema';

const show = (text: string, id?: string): Effect => ({
  type: 'showText',
  text,
  ...(id ? { id } : {}),
});

describe('assignEffectIds', () => {
  it('numbers effects and options, and keeps the ids that exist', () => {
    const out = assignEffectIds([
      show('a', 'e4'),
      show('b'),
      {
        type: 'promptChoice',
        text: 'q',
        options: [
          { label: 'x', effects: [show('c')] },
          { id: 'o2', label: 'y', effects: [] },
        ],
      },
    ]);
    expect(out.map((e) => e.id)).toEqual(['e4', 'e1', 'e2']);
    const choice = out[2]!;
    if (choice.type !== 'promptChoice') throw new Error('choice');
    expect(choice.options.map((o) => o.id)).toEqual(['o1', 'o2']);
    expect(choice.options[0]!.effects[0]!.id).toBe('e1');
  });

  it('replaces a repeated id and returns the same list when nothing is missing', () => {
    const list = assignEffectIds([show('a'), show('b')]);
    expect(assignEffectIds(list)).toBe(list);
    const dup = assignEffectIds([show('a', 'e1'), show('b', 'e1')]);
    expect(dup.map((e) => e.id)).toEqual(['e1', 'e2']);
  });
});

describe('the editor keeps translation keys steady', () => {
  const base = parseQuest(
    JSON.parse(
      readFileSync(resolve(import.meta.dirname, '../../content/quests/q01-the-trial.json'), 'utf8'),
    ),
  );

  it('an effect keeps its key when another is inserted before it', () => {
    const added = addNote(base, { letter: 'next', effects: [show('one'), show('two')] });
    if (!added.ok) throw new Error(added.error);
    const note = added.quest.notes[added.quest.notes.length - 1]!;
    const key = `quest:${base.id}:notes.${note.id}.effects.${note.effects[1]!.id}.text`;
    expect(questStrings(added.quest)[key]).toBe('two');

    const inserted = updateNote(added.quest, note.id, {
      effects: [show('zero'), ...note.effects],
    });
    if (!inserted.ok) throw new Error(inserted.error);
    expect(questStrings(inserted.quest)[key]).toBe('two');
    const translated = translateQuest(inserted.quest, { [key]: 'dos' });
    expect(
      translated.notes
        .find((n) => n.id === note.id)!
        .effects.map((e) => (e as { text: string }).text),
    ).toEqual(['zero', 'one', 'dos']);
  });
});

describe('bundled quests', () => {
  const dir = resolve(import.meta.dirname, '../../content/quests');
  const files = readdirSync(dir).filter((f) => /^(q|fh)\d+.*\.json$/.test(f));
  for (const f of files) {
    it(`${f}: every effect and option has a unique id`, () => {
      const q = parseQuest(JSON.parse(readFileSync(resolve(dir, f), 'utf8')));
      for (const n of q.notes) {
        expect(assignEffectIds(n.effects), `${n.id}`).toBe(n.effects);
      }
    });
  }
});
