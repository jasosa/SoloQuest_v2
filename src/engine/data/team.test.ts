import { describe, expect, it } from 'vitest';
import {
  heroMember,
  isHeroId,
  isMemberId,
  labelOf,
  nameFromId,
  newMemberId,
  normalizeTeam,
  teamWarnings,
  toStored,
  withValidOwners,
  type TeamMember,
} from './team';

const scout: TeamMember = { id: 'merc:scout', name: 'Scout', kind: 'mercenary', owner: 'dwarf' };
const wolf: TeamMember = { id: 'ally:snowdasher', name: 'Snowdasher', kind: 'ally', owner: 'elf' };
const altBarb: TeamMember = {
  id: 'hero:alternate-barbarian',
  name: 'Barbarian (alternate)',
  kind: 'hero',
  as: 'barbarian',
};

describe('team ids', () => {
  it('knows core heroes and the three prefixes, and nothing else', () => {
    for (const ok of ['dwarf', 'hero:alternate-barbarian', 'merc:scout', 'ally:wolf-2'])
      expect(isMemberId(ok), ok).toBe(true);
    for (const bad of ['knight', 'merc:', 'merc:Scout', 'npc:ragnar', '', 'ally:a b'])
      expect(isMemberId(bad), bad).toBe(false);
  });
  it('only heroes are hero ids', () => {
    expect(isHeroId('elf')).toBe(true);
    expect(isHeroId('hero:alternate-barbarian')).toBe(true);
    expect(isHeroId('merc:scout')).toBe(false);
    expect(isHeroId('ally:snowdasher')).toBe(false);
  });
  it('makes a free id from a name, and a new one for a second of the same name', () => {
    expect(newMemberId([], 'mercenary', 'Scout')).toBe('merc:scout');
    expect(newMemberId([scout], 'mercenary', ' Scout! ')).toBe('merc:scout-2');
    expect(newMemberId([], 'ally', '???')).toBe('ally:entry');
  });
});

describe('names', () => {
  const team = [heroMember('dwarf'), heroMember('elf'), scout, wolf];
  it('writes a mercenary and an ally with their owner', () => {
    expect(labelOf(team, 'dwarf')).toBe('Dwarf');
    expect(labelOf(team, 'merc:scout')).toBe('Scout (Dwarf)');
    expect(labelOf(team, 'ally:snowdasher')).toBe('Snowdasher (Elf)');
  });
  it('turns an id into words when there is no team', () => {
    expect(nameFromId('wizard')).toBe('Wizard');
    expect(nameFromId('merc:scout-2')).toBe('Scout');
    expect(nameFromId('ally:snow-dasher')).toBe('Snow dasher');
  });
});

describe('the list in a save', () => {
  it('keeps a plain core hero as a plain id and the rest as objects', () => {
    expect(toStored(heroMember('wizard'))).toBe('wizard');
    expect(toStored(scout)).toEqual(scout);
    expect(toStored(altBarb)).toEqual(altBarb);
  });
  it('reads plain ids as heroes', () => {
    expect(normalizeTeam(['dwarf', scout])).toEqual([heroMember('dwarf'), scout]);
  });
});

describe('owners', () => {
  it('moves an entry whose hero left to the first hero', () => {
    const fixed = withValidOwners([heroMember('barbarian'), heroMember('elf'), scout]);
    expect(fixed.find((m) => m.id === 'merc:scout')?.owner).toBe('barbarian');
    const kept = withValidOwners([heroMember('dwarf'), scout]);
    expect(kept.find((m) => m.id === 'merc:scout')?.owner).toBe('dwarf');
  });
});

describe('team warnings (decision 38): words, never a block', () => {
  const heroes = (...h: Parameters<typeof heroMember>[0][]) => h.map(heroMember);
  it('has none for an ordinary team', () => {
    expect(teamWarnings([...heroes('dwarf', 'elf', 'wizard'), scout])).toEqual([]);
  });
  it('one Barbarian, one animal per hero, allies only with fewer than 4 heroes', () => {
    expect(teamWarnings([...heroes('barbarian'), altBarb])).toEqual([
      'Only one Barbarian can play in a team.',
    ]);
    expect(teamWarnings([...heroes('elf'), wolf, { ...wolf, id: 'ally:wolf-2' }])).toEqual([
      'A hero can have only one animal ally.',
    ]);
    expect(
      teamWarnings([...heroes('barbarian', 'dwarf', 'elf', 'wizard'), { ...wolf, owner: 'elf' }]),
    ).toEqual(['Animal allies play only with fewer than 4 heroes.']);
  });
  it('the quest rule: solo, solo with no mercenaries, only some heroes', () => {
    expect(teamWarnings(heroes('dwarf', 'elf'), { solo: true })).toEqual([
      'This quest is for one hero.',
    ]);
    expect(teamWarnings([...heroes('dwarf'), scout], { solo: true })).toEqual([
      'Mercenaries do not play in a solo quest.',
    ]);
    expect(teamWarnings(heroes('dwarf'), { solo: true, only: ['barbarian'] })).toEqual([
      'This quest is for the Barbarian only.',
    ]);
    // the alternate Barbarian plays as a Barbarian
    expect(teamWarnings([altBarb], { solo: true, only: ['barbarian'] })).toEqual([]);
  });
});
