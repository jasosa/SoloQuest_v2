import { describe, expect, it } from 'vitest';
import { CORE_ABILITIES } from '../data/abilities';
import { CORE_SPELLS } from '../data/spells';
import { addMonster, emptyQuest, updateMonster } from './ops';
import {
  abilityChanged,
  addLibraryAbilityToMonster,
  addLibrarySpellToMonster,
  setMonsterEnemyFromLibrary,
  spellChanged,
  takeLibraryAbility,
  takeLibraryEnemy,
  takeLibrarySpell,
} from './library';

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
  it('an untouched core item is never copied', () => {
    const a = CORE_ABILITIES[0]!;
    expect(takeLibraryAbility(q(), { ...a }).quest.abilityDefs).toEqual([]);
    const { core: _flag, ...fear } = CORE_SPELLS.find((s) => s.id === 'fear')!;
    void _flag;
    expect(takeLibrarySpell(q(), fear as never).quest.spellDefs).toEqual([]);
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

describe('library items on a monster', () => {
  const withOrc = () => {
    const r = addMonster(q(), 'orc', [4, 17]);
    if (!r.ok) throw new Error(r.error);
    return r.quest;
  };
  it('adds an ability and a spell from the library to a monster', () => {
    const base = withOrc();
    const a = addLibraryAbilityToMonster(base, 'm1', bog);
    if (!a.ok) throw new Error(a.error);
    expect(a.quest.monsters[0]?.abilities).toEqual(['bog']);
    expect(addLibraryAbilityToMonster(a.quest, 'm1', bog).ok).toBe(false); // already has it
    const s = addLibrarySpellToMonster(a.quest, 'm1', mud);
    if (!s.ok) throw new Error(s.error);
    expect(s.quest.monsters[0]?.spells).toEqual(['mud']);
  });
  it('makes a monster an enemy: type from the base, the enemy copied in', () => {
    const base = withOrc();
    const r = setMonsterEnemyFromLibrary(
      base,
      'm1',
      { id: 'bone', name: 'Bone Thing', base: 'skeleton', letter: 'B' },
      { abilities: [], spells: [] },
    );
    if (!r.ok) throw new Error(r.error);
    expect(r.quest.monsters[0]).toMatchObject({ type: 'skeleton', enemy: 'bone' });
    expect(r.quest.enemyDefs.map((e) => e.id)).toEqual(['bone']);
  });
  it('refuses an enemy the quest does not have', () => {
    const r = updateMonster(withOrc(), 'm1', { enemy: 'nope' });
    expect(r.ok).toBe(false);
  });
});

describe('changed core items', () => {
  it('a core ability that was changed is copied into the quest under a new id', () => {
    const same = takeLibraryAbility(q(), {
      id: 'stone',
      name: 'Made of stone',
      text: 'x',
      kind: 'ability',
    });
    expect(same.quest.abilityDefs.length).toBe(1); // text differs from the core one: a copy
    expect(same.id).toBe('stone-2');
  });
  it('an untouched core item stays a reference', () => {
    const r = takeLibraryAbility(q(), {
      id: 'stone',
      name: CORE_ABILITIES[0]!.name,
      text: CORE_ABILITIES[0]!.text,
      kind: CORE_ABILITIES[0]!.kind,
    });
    expect(r.id).toBe('stone');
    expect(r.quest.abilityDefs).toEqual([]);
  });
  it('a changed core spell is copied', () => {
    const r = takeLibrarySpell(q(), { id: 'fear', name: 'Terror', tags: ['heroAdjacent'] });
    expect(r.id).toBe('fear-2');
    expect(spellChanged({ id: 'fear', name: 'Terror', tags: ['heroAdjacent'] })).toBe(true);
    expect(abilityChanged({ id: 'unknown', name: 'x', text: 'y' })).toBe(false);
  });
});
