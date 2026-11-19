import { describe, expect, it } from 'vitest';
import {
  addNpc,
  addObjective,
  removeNpc,
  setEndText,
  setWandering,
  updateNpc,
  updateObjective,
} from './meta';
import { addMonster, emptyQuest, updateMonster, type EditResult } from './ops';
import { addNote, updateNote } from './notes';
import type { Quest } from '../quest/schema';

const base = () => emptyQuest({ id: 'user-t', number: 1, title: 'T' });
const ok = (r: EditResult): Quest => {
  if (!r.ok) throw new Error(r.error);
  return r.quest;
};

describe('wandering monster with a count and an enemy', () => {
  it('keeps how many come at once; 1 is the default and is not stored', () => {
    const q = ok(setWandering(base(), { monster: 'mummy', count: 2 }));
    expect(q.wandering).toEqual({ monster: 'mummy', count: 2 });
    expect(ok(setWandering(q, { monster: 'mummy', count: 1 })).wandering).toEqual({
      monster: 'mummy',
    });
  });
  it('refuses a count out of range and an unknown enemy', () => {
    expect(setWandering(base(), { monster: 'orc', count: 0 }).ok).toBe(false);
    expect(setWandering(base(), { monster: 'orc', count: 7 }).ok).toBe(false);
    expect(setWandering(base(), { monster: 'goblin', enemy: 'nope' }).ok).toBe(false);
  });
  it('names a quest enemy as the wandering monster', () => {
    const q = {
      ...base(),
      enemyDefs: [{ id: 'gremlin', name: 'Ice Gremlin', base: 'goblin' as const }],
    };
    expect(
      ok(setWandering(q, { monster: 'goblin', enemy: 'gremlin', count: 3 })).wandering,
    ).toEqual({ monster: 'goblin', enemy: 'gremlin', count: 3 });
  });
});

describe('objective confirm button', () => {
  it('adds and clears a confirm button and its conditions', () => {
    let q = ok(
      addObjective(base(), {
        text: 'Leave',
        confirm: ' The heroes left ',
        confirmWhen: [{ flag: 'done', is: true }],
      }),
    );
    expect(q.objectives[0]).toMatchObject({
      confirm: 'The heroes left',
      confirmWhen: [{ flag: 'done', is: true }],
    });
    q = ok(updateObjective(q, 'o1', { confirmWhen: null }));
    expect(q.objectives[0]?.confirmWhen).toBeUndefined();
    q = ok(updateObjective(q, 'o1', { confirm: null }));
    expect(q.objectives[0]?.confirm).toBeUndefined();
  });
  it('clearing the confirm text drops the conditions too; conditions need a confirm', () => {
    let q = ok(
      addObjective(base(), {
        text: 'Leave',
        confirm: 'Left',
        confirmWhen: [{ flag: 'f', is: true }],
      }),
    );
    q = ok(updateObjective(q, 'o1', { confirm: '' }));
    expect(q.objectives[0]).toEqual({ id: 'o1', text: 'Leave' });
    expect(updateObjective(q, 'o1', { confirmWhen: [{ flag: 'f', is: true }] }).ok).toBe(false);
  });
  it('sets a done rule of every kind', () => {
    let q = ok(addObjective(base(), { text: 'Kill' }));
    for (const done of [
      { allSeenKilled: true as const },
      { flag: 'f' },
      { when: [{ doorOpened: 'out' }] },
    ])
      q = ok(updateObjective(q, 'o1', { done }));
    expect(q.objectives[0]?.done).toEqual({ when: [{ doorOpened: 'out' }] });
  });
});

describe('characters (NPCs)', () => {
  const npc = { name: ' Gothar ', cell: [10, 9] as [number, number], defend: 2, body: 2, move: 6 };
  it('adds, edits and removes one', () => {
    let q = ok(addNpc(base(), npc));
    expect(q.npcs).toEqual([
      { id: 'npc1', name: 'Gothar', cell: [10, 9], defend: 2, body: 2, move: 6, text: '' },
    ]);
    q = ok(updateNpc(q, 'npc1', { attack: 1, move: null, text: ' Escort him. ' }));
    expect(q.npcs[0]).toMatchObject({ attack: 1, text: 'Escort him.' });
    expect(q.npcs[0]?.move).toBeUndefined();
    expect(ok(removeNpc(q, 'npc1')).npcs).toEqual([]);
  });
  it('refuses bad numbers, an empty name, an unknown id', () => {
    expect(addNpc(base(), { ...npc, body: -1 }).ok).toBe(false);
    expect(addNpc(base(), { ...npc, name: ' ' }).ok).toBe(false);
    expect(removeNpc(base(), 'x').ok).toBe(false);
    expect(updateNpc(base(), 'x', { body: 1 }).ok).toBe(false);
  });
  it('a removed character comes back as a problem in the action that brings it in', () => {
    let q = ok(addNpc(base(), npc));
    q = ok(addNote(q, { letter: 'next' }));
    q = ok(updateNote(q, 'n-A', { effects: [{ type: 'spawnNpc', npc: 'npc1' }] }));
    const r = removeNpc(q, 'npc1');
    expect(r.ok && r.warnings.length).toBeGreaterThan(0);
  });
});

describe('end text', () => {
  it('sets, trims and clears it', () => {
    const q = ok(setEndText(base(), ' Go home. '));
    expect(q.endText).toBe('Go home.');
    expect(ok(setEndText(q, '')).endText).toBeUndefined();
  });
});

describe('monster fields of Frozen Horror', () => {
  const withMonster = () => ok(addMonster(base(), 'goblin', [11, 17]));
  it('attackOnly and attacks per turn', () => {
    let q = withMonster();
    const id = q.monsters[0]!.id;
    q = ok(updateMonster(q, id, { attackOnly: true, attacks: 2, state: 'passive' }));
    expect(q.monsters[0]).toMatchObject({ attackOnly: true, attacks: 2, state: 'passive' });
    q = ok(updateMonster(q, id, { attackOnly: false, attacks: 1 }));
    expect(q.monsters[0]?.attackOnly).toBeUndefined();
    expect(q.monsters[0]?.attacks).toBeUndefined();
    expect(updateMonster(q, id, { attacks: 4 }).ok).toBe(false);
  });
});
