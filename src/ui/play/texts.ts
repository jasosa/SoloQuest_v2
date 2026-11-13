/** Plain-English texts for search and trap results. Our own words; the game effect is exact. */
import { HERO_NAMES, type Hero } from '../../engine/data/heroes';
import { MONSTER_NAMES, MONSTER_STATS } from '../../engine/data/monsters';
import type { Prompt, TrapKindName } from '../../engine/game/prompts';
import type { MonsterType } from '../../engine/quest/schema';

export const TRAP_NAMES: Readonly<Record<TrapKindName, string>> = {
  pit: 'pit trap',
  fallingBlock: 'falling block trap',
  spear: 'spear trap',
  chest: 'chest trap',
  scripted: 'trap',
};

type Sprung = Extract<Prompt, { kind: 'trapSprung' }>;

export function sprungTitle(kind: TrapKindName): string {
  return {
    pit: 'Pit trap!',
    fallingBlock: 'Falling block!',
    spear: 'Spear trap!',
    chest: 'Chest trap!',
    scripted: 'Trap!',
  }[kind];
}

/** What happens when the trap springs. Paraphrased from the rules digest. */
export function sprungLines(p: Sprung): string[] {
  const lines: string[] = [];
  if (p.via === 'jump') lines.push('The jump failed. The hero stays on the trap square.');
  if (p.via === 'search') lines.push('The chest was trapped. This comes before the search result.');
  switch (p.trapKind) {
    case 'pit':
      lines.push(
        'The hero falls in and loses 1 Body Point. Put a pit tile on this square. The turn ends.',
        'In the pit, roll 1 fewer combat die to attack and defend (at least 1). Climbing out takes the next turn.',
      );
      break;
    case 'fallingBlock':
      lines.push(
        'Roll 3 combat dice. The hero loses 1 Body Point for each skull and cannot defend.',
        'The block stays here as a wall for the rest of the quest. Move the hero to a free square ahead or back. The turn ends.',
      );
      break;
    case 'spear':
      lines.push(
        'Roll 1 combat die. A skull costs 1 Body Point and the turn ends. A shield means the spear missed and the hero moves on.',
        'The trap is gone either way.',
      );
      break;
    case 'chest':
    case 'scripted':
      if (p.effect === undefined) lines.push('Read the trap effect in the quest notes.');
      break;
  }
  if (p.effect !== undefined) lines.push(p.effect);
  return lines;
}

export function wanderingLines(p: Extract<Prompt, { kind: 'wanderingMonster' }>): string[] {
  const hero = HERO_NAMES[p.hero];
  const name = MONSTER_NAMES[p.monsterType as MonsterType];
  return [
    `Put the ${name} on a free square next to the ${hero}. It attacks the ${hero} at once with ${MONSTER_STATS[p.monsterType].att} attack dice. This round it attacks nobody else.`,
    `No free square next to the ${hero}? Put it in the room as close to the ${hero} as you can. Then it does not attack now: it acts on Zargon's next turn.`,
  ];
}

export const heroName = (h: Hero) => HERO_NAMES[h];
