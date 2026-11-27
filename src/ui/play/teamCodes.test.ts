import { describe, expect, it } from 'vitest';
import { teamCodes, type CodeEntry } from './teamCodes';

const hero = (id: string, name: string): CodeEntry => ({ id, name, kind: 'hero' });
const merc = (name: string, id = `merc:${name.toLowerCase().replace(/ /g, '-')}`): CodeEntry => ({
  id,
  name,
  kind: 'mercenary',
});
const codesOf = (entries: CodeEntry[]) => entries.map((e) => teamCodes(entries).get(e.id));

describe('teamCodes', () => {
  it('core heroes are one letter', () => {
    expect(
      codesOf([
        hero('barbarian', 'Barbarian'),
        hero('dwarf', 'Dwarf'),
        hero('elf', 'Elf'),
        hero('wizard', 'Wizard'),
      ]),
    ).toEqual(['B', 'D', 'E', 'W']);
  });

  it('the alternate Barbarian is Ba, next to the core Barbarian B', () => {
    expect(
      codesOf([
        hero('barbarian', 'Barbarian'),
        hero('hero:alternate-barbarian', 'Barbarian (alternate)'),
      ]),
    ).toEqual(['B', 'Ba']);
  });

  it('a one-word mercenary or ally takes its first two letters', () => {
    const team: CodeEntry[] = [
      merc('Swordsman'),
      merc('Scout'),
      { id: 'ally:snowdasher', name: 'Snowdasher', kind: 'ally' },
      merc('Crossbowman'),
      merc('Halberdier'),
    ];
    // Scout clashes with nobody: Sw, Sc, Sn, Cr, Ha
    expect(codesOf(team)).toEqual(['Sw', 'Sc', 'Sn', 'Cr', 'Ha']);
  });

  it('two or more words give initials', () => {
    expect(codesOf([merc('Old Gareth'), merc('Sir Ragnar')])).toEqual(['OG', 'SR']);
    expect(codesOf([merc('Old Gareth the Brave')])).toEqual(['OG']);
  });

  it('a repeated type adds its number', () => {
    expect(
      codesOf([
        merc('Swordsman', 'merc:swordsman'),
        merc('Swordsman 2', 'merc:swordsman-2'),
        merc('Swordsman 3', 'merc:swordsman-3'),
      ]),
    ).toEqual(['Sw', 'Sw2', 'Sw3']);
  });

  it('the same name twice, without a number, still gets different codes', () => {
    expect(codesOf([merc('Scout', 'merc:scout'), merc('Scout', 'merc:scout-2')])).toEqual([
      'Sc',
      'Sc2',
    ]);
  });

  it('two different names with the same two letters: the later takes one more letter', () => {
    expect(codesOf([merc('Scout'), merc('Scorpion'), merc('Scout 2', 'merc:scout-2')])).toEqual([
      'Sc',
      'Sco',
      'Sc2',
    ]);
    expect(codesOf([merc('Old Gareth'), merc('Orc Guard')])).toEqual(['OG', 'OGu']);
  });

  it('never more than three characters', () => {
    const team = [merc('Scout'), merc('Scorpion'), merc('Scorpion 12', 'merc:scorpion-12')];
    for (const code of codesOf(team)) expect(code!.length).toBeLessThanOrEqual(3);
  });

  it('a companion shares the same rules and never clashes with the team', () => {
    const team: CodeEntry[] = [
      hero('elf', 'Elf'),
      merc('Sir Reginald'),
      { id: 'npc:ragnar', name: 'Sir Ragnar', kind: 'companion' },
    ];
    const codes = codesOf(team);
    expect(codes).toEqual(['E', 'SR', 'SRa']);
  });

  it('is the same for the same team', () => {
    const team = [hero('dwarf', 'Dwarf'), merc('Swordsman')];
    expect(teamCodes(team)).toEqual(teamCodes(team));
  });
});
