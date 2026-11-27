/**
 * The team (decision 38): a free list of named entries. A hero, a mercenary or an animal ally. A
 * mercenary or an ally belongs to no hero (decision 114). The app keeps no stats: the list feeds tie lists, target names and the
 * "dead or alive" fact (decision 32). Pure data and helpers, no checks that block a game: a quest's team
 * rule only gives warnings.
 */
import { HEROES, HERO_NAMES, type Hero } from './heroes';
import type { PackManifest } from '../pack/schema';

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
  /** Old saves only: the hero a mercenary or an ally belonged to. Never written, never read (decision 114). */
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
  return team.map((t) => (typeof t === 'string' ? heroMember(t) : withoutOwner(t)));
}

/** Drop the old `owner` field of an entry. */
function withoutOwner(m: TeamMember): TeamMember {
  if (m.owner === undefined) return m;
  const rest: { -readonly [K in keyof TeamMember]: TeamMember[K] } = { ...m };
  delete rest.owner;
  return rest;
}

/** How a member is written in a save: a plain core hero stays a plain id, as in older saves. */
export function toStored(m: TeamMember): TeamInput {
  const core = (HEROES as readonly string[]).includes(m.id);
  if (core && m.kind === 'hero' && m.name === HERO_NAMES[m.id as Hero]) {
    return m.id as Hero;
  }
  return withoutOwner(m);
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

/** The plain name: "Swordsman 2", "Snowdasher", "Dwarf". An id that is not in the team gets words from the id. */
export function labelOf(team: readonly TeamMember[], id: string): string {
  const m = team.find((t) => t.id === id);
  return m ? m.name : nameFromId(id);
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
 * General rules (one Barbarian, no more animal allies than heroes, allies only with fewer than 4 heroes, no mercenaries
 * in a solo quest) and the quest's own rule.
 */
export function teamWarnings(team: readonly TeamMember[], rule?: TeamRule): string[] {
  const out: string[] = [];
  const heroes = team.filter((m) => m.kind === 'hero');
  const mercs = team.filter((m) => m.kind === 'mercenary');
  const allies = team.filter((m) => m.kind === 'ally');
  if (heroes.filter((h) => heroClass(h) === 'barbarian').length > 1)
    out.push('Only one Barbarian can play in a team.');
  if (allies.length > heroes.length) out.push('A hero can have only one animal ally.');
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

/** Does this entry belong to the preset (a mercenary or ally type)? "Swordsman" and "Swordsman 2" both do. */
function isPresetEntry(m: TeamMember, kind: Exclude<MemberKind, 'hero'>, preset: string): boolean {
  if (m.kind !== kind) return false;
  if (m.name === preset) return true;
  return m.name.startsWith(`${preset} `) && /^\d+$/.test(m.name.slice(preset.length + 1));
}

/** How many entries of a type the team has (kind and type name, for example mercenary and "Swordsman"). */
export function presetCount(
  team: readonly TeamMember[],
  kind: Exclude<MemberKind, 'hero'>,
  preset: string,
): number {
  return team.filter((m) => isPresetEntry(m, kind, preset)).length;
}

/**
 * Add one more of a type. The first is named "Swordsman", the next "Swordsman 2", "Swordsman 3", so
 * names stay different in tie lists. It belongs to no hero.
 */
export function addPreset(
  team: readonly TeamMember[],
  kind: Exclude<MemberKind, 'hero'>,
  preset: string,
): TeamMember[] {
  const names = new Set(team.filter((m) => m.kind === kind).map((m) => m.name));
  let name = preset;
  for (let n = 2; names.has(name); n++) name = `${preset} ${n}`;
  const entry: TeamMember = { id: newMemberId(team, kind, name), name, kind };
  return [...team, entry];
}

/** Take out the last entry added of a type. Nothing changes when there is none. */
export function removeLastPreset(
  team: readonly TeamMember[],
  kind: Exclude<MemberKind, 'hero'>,
  preset: string,
): TeamMember[] {
  let at = -1;
  team.forEach((m, i) => {
    if (isPresetEntry(m, kind, preset)) at = i;
  });
  return at < 0 ? [...team] : team.filter((_, i) => i !== at);
}

/** One hero, mercenary or ally a pack offers, with the box (pack name) it comes from. */
export interface OfferedPreset {
  readonly kind: MemberKind;
  /** The id in the pack manifest (`alternate-barbarian`, `swordsman`, `snowdasher`). */
  readonly id: string;
  readonly name: string;
  /** The name of the pack: "Heroquest", "Frozen Horror". */
  readonly box: string;
  /** Heroes only: the core hero it plays as. */
  readonly as?: Hero;
}

/**
 * Everything the packs offer, whatever the quest's box (decision 114): heroes first, then mercenaries,
 * then allies, each in pack order. The UI passes every installed pack, not just the quest's.
 */
export function offeredPresets(packs: readonly PackManifest[]): OfferedPreset[] {
  const out: OfferedPreset[] = [];
  for (const p of packs)
    for (const h of p.team.heroes)
      out.push({ kind: 'hero', id: h.id, name: h.name, box: p.name, as: h.as });
  for (const p of packs)
    for (const m of p.team.mercenaries)
      out.push({ kind: 'mercenary', id: m.id, name: m.name, box: p.name });
  for (const p of packs)
    for (const a of p.team.allies) out.push({ kind: 'ally', id: a.id, name: a.name, box: p.name });
  return out;
}

/** The ally a quest's `grantsAlly` names, looked up in every pack given. */
export function grantedAlly(
  packs: readonly PackManifest[],
  grantsAlly: string | undefined,
): OfferedPreset | undefined {
  if (!grantsAlly) return undefined;
  return offeredPresets(packs).find((o) => o.kind === 'ally' && o.id === grantsAlly);
}
