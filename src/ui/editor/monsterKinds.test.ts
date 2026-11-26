import { describe, expect, it } from 'vitest';
import type { EnemyDef } from '../../engine/quest/schema';
import { enemyStats, kindOfPick, monsterKinds } from './monsterKinds';

const enemy = (id: string, name: string, extra: Record<string, unknown> = {}): EnemyDef =>
  ({ id, name, base: 'goblin', ...extra }) as unknown as EnemyDef;
const box = (e: EnemyDef) => (e as { expansion?: string }).expansion;

describe('stats line', () => {
  it('own numbers over the numbers of the core type', () => {
    expect(enemyStats({ base: 'goblin' })).toBe('10 · 2 · 1 · 1 · 1');
    expect(enemyStats({ base: 'goblin', overrides: { att: 5, body: 4 } })).toBe(
      '10 · 5 · 1 · 4 · 1',
    );
    // an enemy that is completely its own has all five numbers
    expect(enemyStats({ overrides: { move: 8, att: 5, def: 4, body: 6, mind: 4 } })).toBe(
      '8 · 5 · 4 · 6 · 4',
    );
  });
});

describe('the kinds of the Monsters tool', () => {
  it('Core game first with the 9 types; My library is always listed, even with 0', () => {
    const kinds = monsterKinds({ questEnemies: [], libraryEnemies: [], expansionOf: box });
    expect(kinds.map((k) => k.key)).toEqual(['core', 'mine']);
    expect(kinds[0]?.items).toHaveLength(9);
    expect(kinds[0]?.items[0]).toMatchObject({ name: 'Goblin', stats: '10 · 2 · 1 · 1 · 1' });
    expect(kinds[1]?.items).toHaveLength(0);
    expect(kinds[1]?.label).toBe('My library');
  });

  it('an expansion enemy of the library is under its box, not under a custom group', () => {
    const yeti = enemy('yeti', 'Yeti', { expansion: 'Frozen Horror' });
    const kinds = monsterKinds({ questEnemies: [], libraryEnemies: [yeti], expansionOf: box });
    expect(kinds.map((k) => k.label)).toEqual(['Core game', 'Frozen Horror', 'My library']);
    const fh = kinds[1]!;
    expect(fh.expansion).toBe('Frozen Horror');
    expect(fh.items).toHaveLength(1);
    // it is copied into the quest the first time it is placed
    expect(fh.items[0]?.pick).toMatchObject({ fromLibrary: true });
  });

  it('a library enemy with no box is under My library; the quest copy is used when there is one', () => {
    const ghoul = enemy('ghoul', 'Bog Ghoul');
    const copy = enemy('ghoul', 'Bog Ghoul (edited)');
    const lib = monsterKinds({ questEnemies: [], libraryEnemies: [ghoul], expansionOf: box });
    expect(lib.find((k) => k.key === 'mine')?.items.map((i) => i.name)).toEqual(['Bog Ghoul']);
    expect(lib.find((k) => k.key === 'quest')).toBeUndefined();
    const both = monsterKinds({ questEnemies: [copy], libraryEnemies: [ghoul], expansionOf: box });
    const mine = both.find((k) => k.key === 'mine')!;
    expect(mine.items[0]?.name).toBe('Bog Ghoul (edited)');
    expect(mine.items[0]?.pick).toMatchObject({ fromLibrary: false });
    // and it is also under This quest
    expect(both.find((k) => k.key === 'quest')?.items.map((i) => i.id)).toEqual(['ghoul']);
  });

  it('This quest is listed only when the quest has an enemy of its own, and comes before My library', () => {
    const own = enemy('marsh', 'Marsh Skeleton');
    const kinds = monsterKinds({ questEnemies: [own], libraryEnemies: [], expansionOf: box });
    expect(kinds.map((k) => k.key)).toEqual(['core', 'quest', 'mine']);
  });

  it('a quest enemy of an expansion stays under that box even when the library does not offer it', () => {
    const gremlin = enemy('iceGremlin', 'Ice Gremlin', { expansion: 'Frozen Horror' });
    const kinds = monsterKinds({ questEnemies: [gremlin], libraryEnemies: [], expansionOf: box });
    expect(kinds.find((k) => k.key === 'exp:Frozen Horror')?.items).toHaveLength(1);
  });

  it('many expansions: one kind each, by name, nothing lost (the list scrolls in the card)', () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      enemy(`e${i}`, `Enemy ${i}`, { expansion: `Box ${String(29 - i).padStart(2, '0')}` }),
    );
    const kinds = monsterKinds({ questEnemies: [], libraryEnemies: many, expansionOf: box });
    expect(kinds).toHaveLength(32); // core, 30 boxes, my library
    const names = kinds.slice(1, 31).map((k) => k.label);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(kinds.slice(1, 31).every((k) => k.items.length === 1)).toBe(true);
    expect(kinds.at(-1)?.key).toBe('mine');
  });
});

describe('the kind of a pick', () => {
  it('finds a core type and an enemy, so a Placing row can name and colour them', () => {
    const yeti = enemy('yeti', 'Yeti', { expansion: 'Frozen Horror' });
    const kinds = monsterKinds({ questEnemies: [], libraryEnemies: [yeti], expansionOf: box });
    expect(kindOfPick(kinds, { type: 'orc' })?.kind.key).toBe('core');
    expect(kindOfPick(kinds, { type: 'orc' })?.item.name).toBe('Orc');
    expect(kindOfPick(kinds, { enemy: yeti, fromLibrary: true })?.kind.label).toBe('Frozen Horror');
    expect(kindOfPick(kinds, null)).toBeUndefined();
    expect(kindOfPick(kinds, { enemy: enemy('nope', 'Nope'), fromLibrary: true })).toBeUndefined();
  });
});
