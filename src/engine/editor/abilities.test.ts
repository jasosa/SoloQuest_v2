import { describe, expect, it } from 'vitest';
import { parseQuest } from '../quest/loader';
import type { Quest } from '../quest/schema';
import { testQuestData } from '../quest/testQuest';
import { addAbility, removeAbility, updateAbility } from './meta';
import { updateMonster } from './ops';
import type { EditResult } from './result';

const base = (): Quest => parseQuest(testQuestData);
const good = (r: EditResult): Quest => {
  if (!r.ok) throw new Error(r.error);
  return r.quest;
};

describe('abilities in the editor (decision 69)', () => {
  it('adds a quest ability with an id that is free, and edits it', () => {
    let q = good(addAbility(base(), { name: ' Bog skin ', text: ' Mud spells fail. ' }));
    expect(q.abilityDefs).toEqual([{ id: 'ab1', name: 'Bog skin', text: 'Mud spells fail.' }]);
    q = good(updateAbility(q, 'ab1', { name: 'Marsh skin', kind: 'immunity' }));
    expect(q.abilityDefs[0]).toMatchObject({ name: 'Marsh skin', kind: 'immunity' });
    q = good(addAbility(q, { name: 'Slow', text: 'Moves 1 square.', kind: 'weakness' }));
    expect(q.abilityDefs.map((a) => a.id)).toEqual(['ab1', 'ab2']);
  });

  it('refuses empty text, a core id and an id that is taken', () => {
    expect(addAbility(base(), { name: '', text: 'x' }).ok).toBe(false);
    expect(addAbility(base(), { name: 'x', text: ' ' }).ok).toBe(false);
    expect(addAbility(base(), { name: 'x', text: 'y', id: 'stone' }).ok).toBe(false);
    const q = good(addAbility(base(), { name: 'x', text: 'y', id: 'mine' }));
    expect(addAbility(q, { name: 'z', text: 'w', id: 'mine' }).ok).toBe(false);
    expect(updateAbility(q, 'nope', { name: 'a' }).ok).toBe(false);
    expect(updateAbility(q, 'mine', { text: ' ' }).ok).toBe(false);
  });

  it('a monster takes core and quest abilities, and the special flag', () => {
    let q = good(addAbility(base(), { name: 'Bog skin', text: 'Mud spells fail.', id: 'bog' }));
    q = good(updateMonster(q, 'm1', { abilities: ['stone', 'bog', 'stone'], special: true }));
    const m = q.monsters.find((x) => x.id === 'm1')!;
    expect(m.abilities).toEqual(['stone', 'bog']); // no duplicates
    expect(m.special).toBe(true);
    q = good(updateMonster(q, 'm1', { abilities: [], special: false }));
    const cleared = q.monsters.find((x) => x.id === 'm1')!;
    expect(cleared.abilities).toBeUndefined();
    expect(cleared.special).toBeUndefined();
  });

  it('refuses an ability the quest does not know', () => {
    expect(updateMonster(base(), 'm1', { abilities: ['nope'] }).ok).toBe(false);
  });

  it('removing a quest ability warns about the monsters that still list it', () => {
    let q = good(addAbility(base(), { name: 'Bog skin', text: 'Mud spells fail.', id: 'bog' }));
    q = good(updateMonster(q, 'm1', { abilities: ['bog'] }));
    const r = removeAbility(q, 'bog');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.warnings.some((w) => w.message.includes('unknown ability bog'))).toBe(true);
    expect(removeAbility(q, 'stone').ok).toBe(false); // a core ability is not the quest's
  });
});

describe('export keeps the new fields', () => {
  it('special, abilities and abilityDefs survive an export and a load', async () => {
    const { exportQuest } = await import('./io');
    const { parseQuest: load } = await import('../quest/loader');
    let q = good(addAbility(base(), { name: 'Bog skin', text: 'Mud spells fail.', id: 'bog' }));
    q = good(updateMonster(q, 'm1', { abilities: ['stone', 'bog'], special: true }));
    const text = exportQuest(q);
    expect(text).toContain('"abilityDefs"');
    expect(text).toContain('"special": true');
    const back = load(JSON.parse(text));
    expect(back.abilityDefs).toEqual(q.abilityDefs);
    const m = back.monsters.find((x) => x.id === 'm1')!;
    expect(m.special).toBe(true);
    expect(m.abilities).toEqual(['stone', 'bog']);
  });
});
