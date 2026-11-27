import { describe, expect, it } from 'vitest';
import type { TeamMember } from '../../engine/data/team';
import { companionsOf, personOf, type Person } from './teamView';

const wolf: Person = { id: 'snowdasher', name: 'Snowdasher', defend: 2, body: 5, text: '' };
const knight: Person = { id: 'ragnar', name: 'Sir Ragnar', defend: 2, body: 4, text: '' };
const team: TeamMember[] = [
  { id: 'elf', name: 'Elf', kind: 'hero', as: 'elf' },
  { id: 'ally:snowdasher', name: 'Snowdasher', kind: 'ally' },
  { id: 'merc:swordsman', name: 'Swordsman', kind: 'mercenary' },
];

describe('team view', () => {
  it('an ally the quest gives numbers for is found by its id', () => {
    expect(personOf(team[1]!, [wolf, knight])).toBe(wolf);
    expect(personOf(team[2]!, [wolf, knight])).toBeUndefined();
  });

  it('a hero is never a quest person, even with the same name', () => {
    const hero: TeamMember = { id: 'elf', name: 'Snowdasher', kind: 'hero' };
    expect(personOf(hero, [wolf])).toBeUndefined();
  });

  it('the wolf is on the team, so only Sir Ragnar is a companion', () => {
    expect(companionsOf([wolf, knight], team)).toEqual([knight]);
  });

  it('without the ally on the team both are companions', () => {
    expect(companionsOf([wolf, knight], [team[0]!])).toEqual([wolf, knight]);
  });
});
