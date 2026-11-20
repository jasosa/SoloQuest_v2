/** Plain-English texts for search and trap results. Our own words; the game effect is exact. */
import { nameFromId } from '../../engine/data/team';
import { MONSTER_NAMES, MONSTER_STATS } from '../../engine/data/monsters';
import { TRAP_KIND_NAMES, trapKind } from '../../engine/data/trapKinds';
import type { Prompt, TrapKindName } from '../../engine/game/prompts';
import type { MonsterType } from '../../engine/quest/schema';
import { t } from '../../i18n/t';

export const TRAP_NAMES: Readonly<Record<TrapKindName, string>> = Object.fromEntries(
  TRAP_KIND_NAMES.map((k) => [k, trapKind(k).name]),
) as Record<TrapKindName, string>;

type Sprung = Extract<Prompt, { kind: 'trapSprung' }>;

export function sprungTitle(kind: TrapKindName): string {
  return trapKind(kind).title;
}

/** What happens when the trap springs. The text per kind is in `engine/data/trapKinds.ts`. */
export function sprungLines(p: Sprung): string[] {
  const kind = trapKind(p.trapKind);
  const lines: string[] = [];
  if (p.via === 'jump')
    lines.push(t('play.texts.jumpFailed', 'The jump failed. The hero stays on the trap square.'));
  if (p.via === 'search')
    lines.push(
      t('play.texts.chestTrapped', 'The chest was trapped. This comes before the search result.'),
    );
  lines.push(...kind.lines);
  if ((kind.scripted || kind.onFurniture) && p.effect === undefined)
    lines.push(t('play.texts.readTheTrapEffect', 'Read the trap effect in the quest notes.'));
  if (p.spawned?.length) {
    const counts = new Map<string, number>();
    for (const m of p.spawned) {
      const nm = m.name ?? MONSTER_NAMES[m.monsterType];
      counts.set(nm, (counts.get(nm) ?? 0) + 1);
    }
    const what = [...counts].map(([nm, n]) => `${n} ${nm}`).join(', ');
    lines.push(
      t(
        'play.texts.putOnTheBoard',
        'Put on the board: {monsters}. They are on the roster now and attack at once.',
        { monsters: what },
      ),
    );
  } else if (kind.bringsWanderers && p.effect === undefined)
    lines.push(
      t('play.texts.noWanderingMonster', 'The quest names no wandering monster for this trap.'),
    );
  if (p.effect !== undefined) lines.push(p.effect);
  return lines;
}

/** The wandering monster card (decision 33): always next to the hero, attacks at once. */
export function wanderingLines(
  p: Extract<Prompt, { kind: 'wanderingMonster' }>,
  nameOf: (id: string) => string = nameFromId,
): string[] {
  const hero = nameOf(p.hero);
  const name = p.name ?? MONSTER_NAMES[p.monsterType as MonsterType];
  const dice = p.attackDice ?? MONSTER_STATS[p.monsterType].att;
  if (p.of && p.of > 1)
    return [
      p.number === 1
        ? t(
            'play.texts.severalFirst',
            '{name} {number} of {of}: put it on a free square next to the {hero}. It attacks the {hero} at once with {dice} attack dice. This round it attacks nobody else.',
            { name, number: p.number ?? 1, of: p.of, hero, dice },
          )
        : t(
            'play.texts.severalNext',
            '{name} {number} of {of}: put it as close as you can to the {hero}. It attacks the {hero} at once with {dice} attack dice. This round it attacks nobody else.',
            { name, number: p.number ?? 1, of: p.of, hero, dice },
          ),
    ];
  return [
    t(
      'play.texts.putTheMonster',
      'Put the {name} on a free square next to the {hero}. It attacks the {hero} at once with {dice} attack dice. This round it attacks nobody else.',
      { name, hero, dice },
    ),
  ];
}
