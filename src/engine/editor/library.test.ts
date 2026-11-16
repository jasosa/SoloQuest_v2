import { describe, expect, it } from 'vitest';
import { emptyQuest } from './ops';
import { takeLibraryAbility, takeLibraryEnemy, takeLibrarySpell } from './library';

const q = () => emptyQuest({ id: 'user-t', number: 1, title: 'T' });
const bog = { id: 'bog', name: 'Bog skin', text: 'Mud spells fail.' };
const mud = { id: 'mud', name: 'Mud', tags: ['heroAdjacent' as const] };

describe('taking library items into a quest', () => {
  it('copies an ability once and reuses the same one', () => {
    const a = takeLibraryAbility(q(), bog);
    expect(a.id).toBe('bog');
    expect(a.quest.abilityDefs).toHaveLength(1);
    const b = takeLibraryAbility(a.quest, bog);
    expect(b.quest.abilityDefs).toHaveLength(1);
  });
  it('gives a free id when the id is taken by something else', () => {
    const a = takeLibraryAbility(q(), { ...bog, text: 'Other.' });
    const b = takeLibraryAbility(a.quest, bog);
    expect(b.id).toBe('bog-2');
    expect(b.quest.abilityDefs.map((x) => x.id)).toEqual(['bog', 'bog-2']);
  });
  it('core ids are never copied', () => {
    expect(
      takeLibraryAbility(q(), { id: 'stone', name: 'Stone', text: 'x' }).quest.abilityDefs,
    ).toEqual([]);
    expect(
      takeLibrarySpell(q(), { id: 'fear', name: 'Fear', tags: ['heroAdjacent'] }).quest.spellDefs,
    ).toEqual([]);
  });
  it('an enemy brings the abilities and spells it lists', () => {
    const r = takeLibraryEnemy(
      q(),
      {
        id: 'marsh',
        name: 'Marsh',
        base: 'orc',
        abilities: ['bog', 'stone'],
        spells: ['mud', 'fear', 'gone'],
      },
      { abilities: [bog], spells: [mud] },
    );
    expect(r.id).toBe('marsh');
    expect(r.quest.abilityDefs.map((x) => x.id)).toEqual(['bog']);
    expect(r.quest.spellDefs.map((x) => x.id)).toEqual(['mud']);
    expect(r.quest.enemyDefs[0]).toMatchObject({
      abilities: ['bog', 'stone'],
      spells: ['mud', 'fear'],
    });
    expect(
      takeLibraryEnemy(r.quest, r.quest.enemyDefs[0]!, { abilities: [bog], spells: [mud] }).quest
        .enemyDefs,
    ).toHaveLength(1);
  });
});
