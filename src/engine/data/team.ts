/**
 * The team (decision 38): a free list of named entries. A hero, a mercenary or an animal ally (the last
 * two have an owner hero). The app keeps no stats: the list feeds tie lists, target names and the
 * "dead or alive" fact (decision 32). Pure data and helpers, no checks that block a game: a quest's team
 * rule only gives warnings.
 */
import { HEROES, HERO_NAMES, type Hero } from './heroes';

export type MemberKind = 'hero' | 'mercenary' | 'ally';

export interface TeamMember {
  /**
   * `dwarf` (a core hero), `hero:<slug>` (a hero of a pack, for example the alternate Barbarian),
   * `merc:<slug>` or `ally:<slug>`. This is what events carry (HERO_DIED, SEARCH_TREASURE).
   */
  readonly id: string;
  /** The name as the players say it: "Scout", "Snowdasher". */
  readonly name: string;
  readonly kind: MemberKind;
  /** The id of the hero a mercenary or an ally belongs to. */
  readonly owner?: string | undefined;
  /** The core hero a pack hero plays as (the alternate Barbarian is a `barbarian`): used for the caster rule. */
  readonly as?: Hero | undefined;
}

/** A plain core hero id is a short way to write a hero entry. Old saves and many tests use it. */
export type TeamInput = Hero | TeamMember;

const MEMBER_ID = /^(hero|merc|ally):[a-z0-9][a-z0-9-]{0,39}$/;

/** Is this a well-formed member id (a core hero or `hero:`, `merc:`, `ally:` with a slug)? */
export function isMemberId(id: string): boolean {
  return (HEROES as readonly string[]).includes(id) || MEMBER_ID.test(id);
}

/** Is this the id of a hero (not a mercenary or an ally)? Only heroes search, are chased or are named by a grudge. */
export function isHeroId(id: string): boolean {
  return (HEROES as readonly string[]).includes(id) || id.startsWith('hero:');
}

export const heroMember = (h: Hero): TeamMember => ({
  id: h,
  name: HERO_NAMES[h],
  kind: 'hero',
  as: h,
});

export function normalizeTeam(team: readonly TeamInput[]): TeamMember[] {
  return team.map((t) => (typeof t === 'string' ? heroMember(t) : t));
}

/** How a member is written in a save: a plain core hero stays a plain id, as in older saves. */
export function toStored(m: TeamMember): TeamInput {
  const core = (HEROES as readonly string[]).includes(m.id);
  if (core && m.kind === 'hero' && m.name === HERO_NAMES[m.id as Hero] && !m.owner) {
    return m.id as Hero;
  }
  return m;
}

/** The hero class of a hero entry (Barbarian, Dwarf, Elf, Wizard): a pack hero says it in `as`. */
export function heroClass(m: TeamMember): Hero | undefined {
  if (m.kind !== 'hero') return undefined;
  if (m.as) return m.as;
  return (HEROES as readonly string[]).includes(m.id) ? (m.id as Hero) : undefined;
}

/** A readable name from an id alone, for places that have no team (the log). */
export function nameFromId(id: string): string {
  if ((HEROES as readonly string[]).includes(id)) return HERO_NAMES[id as Hero];
  const slug = id.replace(/^[a-z]+:/, '').replace(/-\d+$/, '');
  const words = slug.replace(/-/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** "Scout (Dwarf)" for a mercenary, "Snowdasher (Elf)" for an ally, the plain name for a hero. */
export function labelOf(team: readonly TeamMember[], id: string): string {
  const m = team.find((t) => t.id === id);
  if (!m) return nameFromId(id);
  if (m.kind === 'hero') return m.name;
  const owner = m.owner ? team.find((t) => t.id === m.owner) : undefined;
  return owner ? `${m.name} (${owner.name})` : m.name;
}

/** A name lookup for ids. Falls back to the id's own words for something that is not in the team. */
export function namer(team: readonly TeamInput[]): (id: string) => string {
  const members = normalizeTeam(team);
  return (id) => labelOf(members, id);
}

/** The living heroes only, in team order. */
export function livingHeroMembers(
  team: readonly TeamMember[],
  dead: readonly string[],
): TeamMember[] {
  return team.filter((m) => m.kind === 'hero' && !dead.includes(m.id));
}

/** A quest's rule for the team (`quest.team`). Words for warnings: it never blocks a game. */
export interface TeamRule {
  readonly solo?: boolean | undefined;
  /** Only these hero classes may play it. */
  readonly only?: readonly Hero[] | undefined;
  /** The id of an ally that joins (an NPC id of the quest, matched to a pack ally id). */
  readonly grantsAlly?: string | undefined;
}

/**
 * Warnings for a team, as short lines. Never an error (decision 38): the players may know better.
 * General rules (one Barbarian, one animal per hero, allies only with fewer than 4 heroes, no mercenaries
 * in a solo quest) and the quest's own rule.
 */
export function teamWarnings(team: readonly TeamMember[], rule?: TeamRule): string[] {
  const out: string[] = [];
  const heroes = team.filter((m) => m.kind === 'hero');
  const mercs = team.filter((m) => m.kind === 'mercenary');
  const allies = team.filter((m) => m.kind === 'ally');
  if (heroes.filter((h) => heroClass(h) === 'barbarian').length > 1)
    out.push('Only one Barbarian can play in a team.');
  const perOwner = new Map<string, number>();
  for (const a of allies) if (a.owner) perOwner.set(a.owner, (perOwner.get(a.owner) ?? 0) + 1);
  if ([...perOwner.values()].some((n) => n > 1)) out.push('A hero can have only one animal ally.');
  if (allies.length > 0 && heroes.length >= 4)
    out.push('Animal allies play only with fewer than 4 heroes.');
  const lone = rule?.solo === true;
  if (lone && heroes.length > 1) out.push('This quest is for one hero.');
  if (lone && mercs.length > 0) out.push('Mercenaries do not play in a solo quest.');
  if (rule?.only) {
    const bad = heroes.filter((h) => {
      const c = heroClass(h);
      return !c || !rule.only!.includes(c);
    });
    if (bad.length > 0)
      out.push(`This quest is for the ${rule.only.map((c) => HERO_NAMES[c]).join(' or ')} only.`);
  }
  return out;
}

/** A free id for a new entry: `merc:scout`, then `merc:scout-2`, `merc:scout-3`... Names that give no letters become `entry`. */
export function newMemberId(
  team: readonly TeamMember[],
  kind: Exclude<MemberKind, 'hero'>,
  name: string,
): string {
  const prefix = kind === 'mercenary' ? 'merc' : 'ally';
  const slug =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 30)
      .replace(/-+$/g, '') || 'entry';
  let id = `${prefix}:${slug}`;
  for (let n = 2; team.some((m) => m.id === id); n++) id = `${prefix}:${slug}-${n}`;
  return id;
}

/**
 * A mercenary or an ally belongs to a hero of the team. An entry whose owner is not in the team (the
 * hero was unpicked) goes to the first hero. Entries with no hero in the team keep what they have.
 */
export function withValidOwners(team: readonly TeamMember[]): TeamMember[] {
  const heroes = team.filter((m) => m.kind === 'hero');
  const first = heroes[0];
  return team.map((m) => {
    if (m.kind === 'hero' || !first) return m;
    if (m.owner && heroes.some((h) => h.id === m.owner)) return m;
    return { ...m, owner: first.id };
  });
}
