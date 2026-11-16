import { describe, expect, it } from 'vitest';
import { parseQuest } from '../quest/loader';
import type { Quest } from '../quest/schema';
import { testQuestData } from '../quest/testQuest';
import { addSpell, removeSpell, updateSpell } from './meta';
import { updateMonster } from './ops';
import type { EditResult } from './result';

const base = (): Quest => parseQuest(testQuestData);
const good = (r: EditResult): Quest => {
  if (!r.ok) throw new Error(r.error);
  return r.quest;
};

describe('spells in the editor (decision 70)', () => {
  it('adds a spell with situations, a text and a warning, with a free id', () => {
    const q = good(
      addSpell(base(), {
        name: ' Mud ',
        text: ' The floor turns to mud. ',
        tags: ['heroAdjacent', 'heroAdjacent', 'any'],
        warning: ' It also slows monsters. ',
      }),
    );
    expect(q.spellDefs).toEqual([
      {
        id: 'sp1',
        name: 'Mud',
        text: 'The floor turns to mud.',
        tags: ['heroAdjacent', 'any'],
        warning: 'It also slows monsters.',
      },
    ]);
    expect(good(addSpell(q, { name: 'Fog', question: 'Is it dark?' })).spellDefs[1]?.id).toBe(
      'sp2',
    );
  });

  it('needs a name and a situation or a question, and knows only real situations', () => {
    expect(addSpell(base(), { name: '', tags: ['any'] }).ok).toBe(false);
    expect(addSpell(base(), { name: 'X' }).ok).toBe(false);
    expect(addSpell(base(), { name: 'X', tags: ['nope' as never] }).ok).toBe(false);
    expect(addSpell(base(), { name: 'X', tags: ['any'], id: 'fear' }).ok).toBe(false);
    expect(addSpell(base(), { name: 'X', question: ' Is it dark? ' }).ok).toBe(true);
  });

  it('edits a spell: tags, a question that replaces them, the escape rule', () => {
    let q = good(addSpell(base(), { name: 'Mud', tags: ['any'], id: 'mud' }));
    q = good(
      updateSpell(q, 'mud', { tags: ['heroAdjacent', 'manyInSight'], offerWhen: 'escapePoint' }),
    );
    expect(q.spellDefs[0]).toMatchObject({
      tags: ['heroAdjacent', 'manyInSight'],
      offerWhen: 'escapePoint',
    });
    q = good(updateSpell(q, 'mud', { tags: [], question: 'Is it raining?' }));
    expect(q.spellDefs[0]).toMatchObject({ tags: [], question: 'Is it raining?' });
    // clearing both is refused
    expect(updateSpell(q, 'mud', { question: null }).ok).toBe(false);
    expect(updateSpell(q, 'nope', { name: 'x' }).ok).toBe(false);
    q = good(updateSpell(q, 'mud', { offerWhen: 'always', warning: 'Careful.' }));
    expect(q.spellDefs[0]?.offerWhen).toBeUndefined();
    expect(q.spellDefs[0]?.warning).toBe('Careful.');
  });

  it('a monster takes core and quest spells, and an unknown one is refused', () => {
    let q = good(addSpell(base(), { name: 'Mud', tags: ['any'], id: 'mud' }));
    q = good(updateMonster(q, 'm1', { spells: ['fear', 'mud', 'mud'] }));
    expect(q.monsters.find((m) => m.id === 'm1')?.spells).toEqual(['fear', 'mud', 'mud']);
    expect(updateMonster(q, 'm1', { spells: ['nope'] }).ok).toBe(false);
  });

  it('removing a quest spell warns about the monsters and notes that still use it', () => {
    let q = good(addSpell(base(), { name: 'Mud', tags: ['any'], id: 'mud' }));
    q = good(updateMonster(q, 'm1', { spells: ['mud'] }));
    const r = removeSpell(q, 'mud');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.warnings.some((w) => w.message.includes('unknown spell "mud"'))).toBe(true);
    expect(removeSpell(q, 'fear').ok).toBe(false); // a core spell is not the quest's
  });
});
