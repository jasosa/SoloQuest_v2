import { describe, expect, it } from 'vitest';
import {
  addAbility,
  addMonster,
  addSpell,
  updateMonster,
  type EditResult,
} from '../../engine/editor';
import { parseQuest } from '../../engine/quest/loader';
import type { Quest } from '../../engine/quest/schema';
import { testQuestData } from '../../engine/quest/testQuest';
import {
  commitMonsterDraft,
  isMonsterDirty,
  monsterDraftOf,
  newMonsterDraft,
  onlyAddedDefs,
  removeAddedDefs,
  runOnMonsterDraft,
  withMonsterDraft,
  type MonsterDraft,
} from './monsterDraft';

const good = (r: EditResult): Quest => {
  if (!r.ok) throw new Error(r.error);
  return r.quest;
};
const base = (): Quest => parseQuest({ ...testQuestData });
const withMonster = (): Quest => good(addMonster(base(), 'goblin', null, { hidden: true }));
const last = (q: Quest) => q.monsters[q.monsters.length - 1]!;
const run = (q: Quest, d: MonsterDraft, op: (q: Quest) => EditResult) => {
  const r = runOnMonsterDraft(q, d, op);
  if (!r.ok) throw new Error(r.error);
  return r;
};

describe('monster draft', () => {
  it('an edit changes the draft and leaves the quest as it was', () => {
    const q = withMonster();
    const saved = last(q);
    const d0 = monsterDraftOf(saved);
    expect(isMonsterDirty(q, d0)).toBe(false);
    const r = run(q, d0, (x) => updateMonster(x, saved.id, { name: 'Grak' }));
    expect(r.draft.monster.name).toBe('Grak');
    expect(r.quest).toBeNull();
    expect(isMonsterDirty(q, r.draft)).toBe(true);
    expect(last(q)).toBe(saved);
    expect(saved.name).toBeUndefined();
  });

  it('the form sees the draft in the quest, an old monster replaced and a new one added', () => {
    const q = withMonster();
    const d = run(q, monsterDraftOf(last(q)), (x) =>
      updateMonster(x, last(q).id, { name: 'Grak' }),
    ).draft;
    expect(last(withMonsterDraft(q, d)).name).toBe('Grak');
    const made = good(addMonster(q, 'orc', null, { hidden: true }));
    const fresh: MonsterDraft = newMonsterDraft(last(made));
    expect(withMonsterDraft(q, fresh).monsters.map((m) => m.id)).toEqual([
      ...q.monsters.map((m) => m.id),
      fresh.monster.id,
    ]);
    expect(isMonsterDirty(q, fresh)).toBe(true);
  });

  it('a refused change returns the engine sentence', () => {
    const q = withMonster();
    const r = runOnMonsterDraft(q, monsterDraftOf(last(q)), (x) =>
      updateMonster(x, last(x).id, { traits: [' '] }),
    );
    expect(r).toEqual({ ok: false, error: 'Traits and spells cannot be empty text.' });
  });

  it('a change that also makes a definition of the quest returns that part to write at once', () => {
    const q = withMonster();
    const r = run(q, monsterDraftOf(last(q)), (x) => {
      const withAbility = good(addAbility(x, { name: 'Stone skin', text: 'Hard to hurt.' }));
      const id = withAbility.abilityDefs.at(-1)!.id;
      return updateMonster(withAbility, last(x).id, { abilities: [id] });
    });
    expect(r.draft.monster.abilities).toHaveLength(1);
    expect(r.quest?.abilityDefs).toHaveLength(q.abilityDefs.length + 1);
    // the monster itself stays in the draft: the quest part keeps the saved monsters
    expect(r.quest?.monsters).toBe(q.monsters);
  });

  it('saving writes the draft in one change; a new monster joins the quest only then', () => {
    const q = withMonster();
    const d = run(q, monsterDraftOf(last(q)), (x) =>
      updateMonster(x, last(q).id, { name: 'Grak', special: true }),
    ).draft;
    const saved = good(commitMonsterDraft(q, d));
    expect(last(saved).name).toBe('Grak');
    expect(last(saved).special).toBe(true);
    expect(isMonsterDirty(saved, monsterDraftOf(last(saved)))).toBe(false);

    const made = good(addMonster(saved, 'orc', null, { hidden: true }));
    const fresh: MonsterDraft = newMonsterDraft(last(made));
    expect(saved.monsters.some((m) => m.id === fresh.monster.id)).toBe(false);
    const after = good(commitMonsterDraft(saved, fresh));
    expect(after.monsters).toHaveLength(saved.monsters.length + 1);
    expect(last(after)).toEqual(fresh.monster);
  });

  it('a definition the draft makes is remembered, and removed when the draft is dropped', () => {
    const q = withMonster();
    const makeAbility = (x: Quest) => {
      const withAbility = good(addAbility(x, { name: 'Stone skin', text: 'Hard to hurt.' }));
      const id = withAbility.abilityDefs.at(-1)!.id;
      return updateMonster(withAbility, last(x).id, { abilities: [id] });
    };
    const r = run(q, monsterDraftOf(last(q)), makeAbility);
    expect(r.onlyNew).toBe(true);
    const id = r.draft.monster.abilities![0]!;
    expect(r.draft.added.abilities).toEqual([id]);
    // the definition is in the quest at once (its popup edits it there)
    const written = r.quest!;
    expect(onlyAddedDefs(q, written, r.draft)).toBe(true);
    // a spell made next is remembered too, the earlier ids stay
    const r2 = run(written, r.draft, (x) => addSpell(x, { name: 'Mud', tags: ['any'] }));
    expect(r2.draft.added.abilities).toEqual([id]);
    expect(r2.draft.added.spells).toHaveLength(1);
    // dropping the draft takes both out and nothing else
    const cleaned = removeAddedDefs(r2.quest!, r2.draft)!;
    expect(cleaned.abilityDefs.map((a) => a.id)).toEqual(q.abilityDefs.map((a) => a.id));
    expect(cleaned.spellDefs.map((s) => s.id)).toEqual(q.spellDefs.map((s) => s.id));
    expect(cleaned.monsters).toBe(r2.quest!.monsters);
  });

  it('a definition that existed before, or that another monster uses, stays when the draft is dropped', () => {
    const q0 = withMonster();
    const own = good(addAbility(q0, { name: 'Old skin', text: 'Was here first.' }));
    const oldId = own.abilityDefs.at(-1)!.id;
    const r = run(own, monsterDraftOf(last(own)), (x) =>
      updateMonster(x, last(x).id, { abilities: [oldId] }),
    );
    // an existing definition is not "added": nothing to take out
    expect(r.draft.added.abilities).toEqual([]);
    expect(removeAddedDefs(own, r.draft)).toBeNull();

    // another monster picks up a definition the draft added: it stays
    const mk = (x: Quest) => {
      const withAbility = good(addAbility(x, { name: 'Shared', text: 'Used twice.' }));
      const id = withAbility.abilityDefs.at(-1)!.id;
      return updateMonster(withAbility, last(x).id, { abilities: [id] });
    };
    const second = good(addMonster(own, 'orc', null, { hidden: true }));
    const d = run(second, monsterDraftOf(last(second)), mk);
    const sharedId = d.draft.added.abilities[0]!;
    const written = good(
      updateMonster(d.quest!, second.monsters[0]!.id, { abilities: [sharedId] }),
    );
    expect(removeAddedDefs(written, d.draft)).toBeNull();
  });

  it('a change to a definition that was already there is not written without an undo step', () => {
    const q0 = good(addAbility(withMonster(), { name: 'Old', text: 'Here first.' }));
    const r = run(q0, monsterDraftOf(last(q0)), (x) => {
      const changed = { ...x, abilityDefs: x.abilityDefs.map((a) => ({ ...a, text: 'Edited.' })) };
      return { ok: true, quest: changed, warnings: [] };
    });
    expect(r.onlyNew).toBe(false);
    expect(r.draft.added.abilities).toEqual([]);
    expect(r.quest?.abilityDefs.every((a) => a.text === 'Edited.')).toBe(true);
  });
});
