import type { PackManifest } from '../pack/schema';
import { describe, expect, it } from 'vitest';
import {
  addPreset,
  grantedAlly,
  heroMember,
  isHeroId,
  isMemberId,
  labelOf,
  nameFromId,
  newMemberId,
  normalizeTeam,
  offeredPresets,
  presetCount,
  removeLastPreset,
  teamWarnings,
  toStored,
  type TeamMember,
} from './team';

const scout: TeamMember = { id: 'merc:scout', name: 'Scout', kind: 'mercenary' };
const wolf: TeamMember = { id: 'ally:snowdasher', name: 'Snowdasher', kind: 'ally' };
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
  it('writes a mercenary and an ally with the plain name', () => {
    expect(labelOf(team, 'dwarf')).toBe('Dwarf');
    expect(labelOf(team, 'merc:scout')).toBe('Scout');
    expect(labelOf(team, 'ally:snowdasher')).toBe('Snowdasher');
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

describe('no owner (decision 114)', () => {
  it('shows the plain name, also for an old entry that has an owner', () => {
    const old: TeamMember = { ...scout, owner: 'dwarf' };
    expect(labelOf([heroMember('dwarf'), old], 'merc:scout')).toBe('Scout');
    expect(labelOf([heroMember('elf'), wolf], 'ally:snowdasher')).toBe('Snowdasher');
  });
  it('drops the old owner when a save is read or written', () => {
    const old: TeamMember = { ...scout, owner: 'dwarf' };
    expect('owner' in normalizeTeam(['dwarf', old])[1]!).toBe(false);
    expect('owner' in (toStored(old) as TeamMember)).toBe(false);
  });
});

describe('what the packs offer', () => {
  const manifest = (id: string, name: string, team: Partial<PackManifest['team']>) =>
    ({ id, name, team: { heroes: [], mercenaries: [], allies: [], ...team } }) as PackManifest;
  const core = manifest('core', 'HeroQuest', {});
  const fh = manifest('frozen-horror', 'Frozen Horror', {
    heroes: [{ id: 'alternate-barbarian', name: 'Barbarian (alternate)', as: 'barbarian' }],
    mercenaries: [{ id: 'scout', name: 'Scout' }],
    allies: [{ id: 'snowdasher', name: 'Snowdasher' }],
  });
  it('lists heroes, mercenaries and allies of every pack given, with their box', () => {
    expect(offeredPresets([core, fh]).map((o) => [o.kind, o.id, o.name, o.box])).toEqual([
      ['hero', 'alternate-barbarian', 'Barbarian (alternate)', 'Frozen Horror'],
      ['mercenary', 'scout', 'Scout', 'Frozen Horror'],
      ['ally', 'snowdasher', 'Snowdasher', 'Frozen Horror'],
    ]);
    expect(offeredPresets([core, fh])[0]?.as).toBe('barbarian');
    expect(offeredPresets([core])).toEqual([]);
  });
  it('finds the ally a quest grants in any pack', () => {
    expect(grantedAlly([core, fh], 'snowdasher')?.box).toBe('Frozen Horror');
    expect(grantedAlly([core, fh], 'wolf')).toBeUndefined();
    expect(grantedAlly([core, fh], undefined)).toBeUndefined();
  });
});

describe('team warnings (decision 38): words, never a block', () => {
  const heroes = (...h: Parameters<typeof heroMember>[0][]) => h.map(heroMember);
  it('has none for an ordinary team', () => {
    expect(teamWarnings([...heroes('dwarf', 'elf', 'wizard'), scout])).toEqual([]);
  });
  it('one Barbarian, no more animals than heroes, allies only with fewer than 4 heroes', () => {
    expect(teamWarnings([...heroes('barbarian'), altBarb])).toEqual([
      'Only one Barbarian can play in a team.',
    ]);
    expect(teamWarnings([...heroes('elf'), wolf, { ...wolf, id: 'ally:wolf-2' }])).toEqual([
      'A hero can have only one animal ally.',
    ]);
    expect(teamWarnings([...heroes('elf', 'dwarf'), wolf, { ...wolf, id: 'ally:wolf-2' }])).toEqual(
      [],
    );
    expect(teamWarnings([...heroes('barbarian', 'dwarf', 'elf', 'wizard'), wolf])).toEqual([
      'Animal allies play only with fewer than 4 heroes.',
    ]);
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

describe('a type and a number', () => {
  const dwarf = heroMember('dwarf');
  const elf = heroMember('elf');
  it('adds several of a type with different names and ids, and counts them', () => {
    let team: TeamMember[] = [dwarf, elf];
    team = addPreset(team, 'mercenary', 'Swordsman');
    team = addPreset(team, 'mercenary', 'Swordsman');
    team = addPreset(team, 'mercenary', 'Swordsman');
    expect(team.slice(2).map((m) => [m.id, m.name, 'owner' in m])).toEqual([
      ['merc:swordsman', 'Swordsman', false],
      ['merc:swordsman-2', 'Swordsman 2', false],
      ['merc:swordsman-3', 'Swordsman 3', false],
    ]);
    expect(presetCount(team, 'mercenary', 'Swordsman')).toBe(3);
    expect(presetCount(team, 'mercenary', 'Scout')).toBe(0);
    expect(presetCount(team, 'ally', 'Swordsman')).toBe(0);
    expect(labelOf(team, 'merc:swordsman-2')).toBe('Swordsman 2');
  });
  it('does not count a type whose name only starts the same', () => {
    const team: TeamMember[] = [
      dwarf,
      { id: 'merc:scout-leader', name: 'Scout Leader', kind: 'mercenary' },
    ];
    expect(presetCount(team, 'mercenary', 'Scout')).toBe(0);
  });
  it('takes out the last one added and leaves the rest', () => {
    let team = addPreset(addPreset([dwarf], 'mercenary', 'Scout'), 'mercenary', 'Scout');
    team = removeLastPreset(team, 'mercenary', 'Scout');
    expect(team.map((m) => m.id)).toEqual(['dwarf', 'merc:scout']);
    team = removeLastPreset(team, 'mercenary', 'Scout');
    expect(team.map((m) => m.id)).toEqual(['dwarf']);
    expect(removeLastPreset(team, 'mercenary', 'Scout').map((m) => m.id)).toEqual(['dwarf']);
  });
  it('reuses a freed number and keeps entries of other types', () => {
    let team = addPreset([dwarf], 'mercenary', 'Scout');
    team = addPreset(team, 'ally', 'Snowdasher');
    team = addPreset(team, 'mercenary', 'Scout');
    team = removeLastPreset(team, 'mercenary', 'Scout');
    team = addPreset(team, 'mercenary', 'Scout');
    expect(team.map((m) => m.name)).toEqual(['Dwarf', 'Scout', 'Snowdasher', 'Scout 2']);
  });
  it('still warns about a second animal for one hero and mercenaries in a solo quest', () => {
    let team = addPreset([dwarf], 'ally', 'Snowdasher');
    team = addPreset(team, 'ally', 'Snowdasher');
    team = addPreset(team, 'mercenary', 'Scout');
    expect(teamWarnings(team, { solo: true })).toEqual([
      'A hero can have only one animal ally.',
      'Mercenaries do not play in a solo quest.',
    ]);
  });
});
