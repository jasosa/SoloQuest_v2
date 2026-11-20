/** Texts of docs/ZARGON_AI.md: target rules and plans. */
import { tr } from '../../i18n/translate';
import type { Profile, RuleKey } from './weights';

export const RULE_TEXT: Readonly<Record<RuleKey, string>> = {
  closest: 'The closest hero it can reach',
  isolated:
    'A hero with no other hero next to them and another monster next to them (cut off from the others)',
  lastAttacker: 'The hero who attacked it last',
  lowestBody: 'The hero with the fewest Body Points left',
  highestBody: 'The hero with the most Body Points left',
  lowestDef: 'The hero with the fewest defend dice',
  highestDef: 'The hero with the most defend dice',
  highestAtt: 'The hero with the most attack dice',
  caster: 'A spellcaster (Wizard or Elf)',
  grudge: 'The grudge hero, whatever it costs',
};

export const PLAN_TEXT: Readonly<Record<Profile, string>> = {
  skirmisher: 'Next to a hero: attack, then run back out of reach. Otherwise: move in and attack.',
  // Sometimes it moves back after the attack, so the plan comes from `fighterPlan`.
  fighter: 'Move in and attack. Already next to a hero: attack and stay.',
  relentless: 'Move in and attack. Never falls back.',
  // The plan of a caster that has no spell to cast: as a duelist.
  caster: 'Move in and attack. No hero in reach: move toward the nearest hero.',
  // The thief, grappler and shooter plans change a little each turn (below); these are the base lines.
  thief: 'Steal an item from a hero, or attack.',
  grappler: 'Hug a hero it wounds, otherwise move in and attack.',
  shooter: 'Shoot a hero in sight from where it stands.',
  passive: 'No orders. It does nothing until the quest, or the players, say otherwise.',
};

/**
 * The thief (Ice Gremlin, decision 49): a seeded 50% steal, 50% attack like a skirmisher. The app
 * does not know what was stolen, so the card says what to do in both cases.
 */
export function thiefPlan(steals: boolean): string {
  // What stealing is (and the escape) is in the Thief ability; the plan only picks this turn's choice.
  return steals
    ? tr(
        'zargon.thiefSteals',
        'Steal: move next to the target and steal instead of attacking. Suggested item: a potion if the hero has one, otherwise the most valuable item they carry. Only a hero can be robbed: if the target is not a hero, attack it instead.',
      )
    : tr('zargon.thiefAttacks', 'Attack: {plan}', { plan: PLAN_TEXT.skirmisher });
}

/** The grappler (Yeti, decision 49): the hug is in the card text, the app keeps no state for it. */
export function grapplerPlan(hugs: boolean): string {
  // What the hug does is in the Bear hug ability.
  return hugs
    ? tr(
        'zargon.grapplerHugs',
        'Already hugging a hero: it does nothing else. Otherwise: move in and attack.',
      )
    : tr('zargon.grapplerSolo', 'Move in and attack. (In a solo quest it does not hug.)');
}

/**
 * The shooter (enemy Crossbowman, decision 49): a seeded 70% to step back out of contact when it
 * starts next to a hero, then shoot; otherwise it fights where it stands.
 */
export function shooterPlan(stepsBack: boolean): string {
  const open = tr(
    'zargon.shooterOpen',
    'A hero in sight, not next to it: shoot, do not move. No hero in sight: move until one is, then shoot.',
  );
  return stepsBack
    ? tr(
        'zargon.shooterStepsBack',
        '{open} Starts next to a hero: step back out of contact and shoot; if it cannot, melee and stay.',
        { open },
      )
    : tr('zargon.shooterStays', '{open} Starts next to a hero: melee and stay.', { open });
}

/** A monster with several attacks moves once and draws a target rule for each attack (decision 49). */
export function multiAttackLines(rules: readonly string[]): string {
  const lines = rules
    .map((r, i) => tr('zargon.attackRule', 'Attack {number}: {rule}.', { number: i + 1, rule: r }))
    .join(' ');
  return tr(
    'zargon.multiAttack',
    '{lines} If the last target is out of reach, hit the first target again. It moves only once.',
    { lines },
  );
}

/**
 * What to do when the target rule has no valid target (decision 35): use the tie list. Only for the
 * rules where the case is not obvious; the other rules need no line (ties and out-of-reach are
 * what the tie list is for). `grudgeName` fills in the hero of a grudge.
 */
/** The fighter plan of one turn: on 1 turn in 3 (seeded) it moves back after attacking. */
export function fighterPlan(movesBack: boolean): string {
  return movesBack
    ? tr(
        'zargon.fighterMovesBack',
        'Move in and attack. Already next to a hero: attack, then move back out of reach.',
      )
    : tr('zargon.fighterStays', 'Move in and attack. Already next to a hero: attack and stay.');
}

export function noTargetText(rule: RuleKey, grudgeName?: string): string | undefined {
  switch (rule) {
    case 'isolated':
      return tr('zargon.noIsolated', 'If no hero is cut off like that, use the tie list.');
    case 'lastAttacker':
      return tr('zargon.noAttacker', 'If nobody has attacked it yet, use the tie list.');
    case 'caster':
      return tr('zargon.noCaster', 'If no Wizard or Elf is in reach, use the tie list.');
    case 'grudge':
      return tr('zargon.noGrudge', 'If the {hero} is out of reach, use the tie list.', {
        hero: grudgeName ?? tr('zargon.grudgeHero', 'grudge hero'),
      });
    default:
      return undefined;
  }
}
