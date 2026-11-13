export const HEROES = ['barbarian', 'dwarf', 'elf', 'wizard'] as const;
export type Hero = (typeof HEROES)[number];

export const HERO_NAMES: Readonly<Record<Hero, string>> = {
  barbarian: 'Barbarian',
  dwarf: 'Dwarf',
  elf: 'Elf',
  wizard: 'Wizard',
};
