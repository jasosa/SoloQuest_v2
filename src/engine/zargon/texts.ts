/** Texts of docs/ZARGON_AI.md: target rules and plans. */
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
  thief: 'Steal an item from a hero, or attack. See the card.',
  grappler: 'Hug a hero it wounds, otherwise move in and attack.',
  shooter: 'Shoot a hero in sight from where it stands.',
  passive: 'No orders. It does nothing until the quest, or the players, say otherwise.',
};

/**
 * The thief (Ice Gremlin, decision 49): a seeded 50% steal, 50% attack like a skirmisher. The app
 * does not know what was stolen, so the card says what to do in both cases.
 */
export function thiefPlan(steals: boolean): string {
  const stolen =
    "If it has already stolen: it runs away at full speed. If no hero can see it at the start of Zargon's turn, it escapes with the item: tap Escaped. If it is killed first, the hero gets the item back.";
  return steals
    ? `Steal: move next to the target and steal instead of attacking. Suggested item: a potion if the hero has one, otherwise the most valuable item they carry, never the armor, shield or weapon in use. Then it runs away. ${stolen}`
    : `Attack: ${PLAN_TEXT.skirmisher} ${stolen}`;
}

/** The grappler (Yeti, decision 49): the hug is in the card text, the app keeps no state for it. */
export function grapplerPlan(hugs: boolean): string {
  return hugs
    ? 'Hugging a hero: that hero loses 2 Body Points, cannot defend and cannot act, and the monster does nothing else. If its attack makes a hero lose at least 1 Body Point, it starts hugging that hero. Otherwise: move in and attack.'
    : 'Move in and attack. (In a solo quest it does not hug.)';
}

/**
 * The shooter (enemy Crossbowman, decision 49): a seeded 70% to step back out of contact when it
 * starts next to a hero, then shoot; otherwise it fights where it stands.
 */
export function shooterPlan(stepsBack: boolean): string {
  const open =
    'A hero in sight, not next to it: shoot, do not move. No hero in sight: move until one is, then shoot.';
  return stepsBack
    ? `${open} Starts next to a hero: step back out of contact and shoot; if it cannot, melee and stay.`
    : `${open} Starts next to a hero: melee and stay.`;
}

/** A monster with several attacks moves once and draws a target rule for each attack (decision 49). */
export function multiAttackLines(rules: readonly string[]): string {
  const lines = rules.map((r, i) => `Attack ${i + 1}: ${r}.`).join(' ');
  return `${lines} If the last target is out of reach, hit the first target again. It moves only once.`;
}

/**
 * What to do when the target rule has no valid target (decision 35): use the tie list. Only for the
 * rules where the case is not obvious; the other rules need no line (ties and out-of-reach are
 * what the tie list is for). `grudgeName` fills in the hero of a grudge.
 */
/** The fighter plan of one turn: on 1 turn in 3 (seeded) it moves back after attacking. */
export function fighterPlan(movesBack: boolean): string {
  return movesBack
    ? 'Move in and attack. Already next to a hero: attack, then move back out of reach.'
    : 'Move in and attack. Already next to a hero: attack and stay.';
}

export function noTargetText(rule: RuleKey, grudgeName?: string): string | undefined {
  switch (rule) {
    case 'isolated':
      return 'If no hero is cut off like that, use the tie list.';
    case 'lastAttacker':
      return 'If nobody has attacked it yet, use the tie list.';
    case 'caster':
      return 'If no Wizard or Elf is in reach, use the tie list.';
    case 'grudge':
      return `If the ${grudgeName ?? 'grudge hero'} is out of reach, use the tie list.`;
    default:
      return undefined;
  }
}
