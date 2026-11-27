/**
 * The short code on a team coin ("D", "Ba", "Sw2", "SR"), as the monster coin has "O1".
 * A pure function of the team: the same team always gives the same codes, in team order.
 *
 * - A core hero: its first letter (B, D, E, W).
 * - One word (a mercenary, an ally, a hero of a pack): the first two letters (Sw, Sc, Sn, Ba).
 * - Two words or more: the initials of the first two (SR, OG).
 * - A repeated type adds its number: Sw, Sw2, Sw3. The number is the one in the name ("Swordsman 2").
 * - Two different names with the same code: the later one takes one more letter (Sc, Sco).
 * - Three characters at most.
 */
import { HEROES, HERO_NAMES, type Hero } from '../../engine/data/heroes';
import type { MemberKind } from '../../engine/data/team';

export interface CodeEntry {
  readonly id: string;
  readonly name: string;
  readonly kind: MemberKind | 'companion';
}

const MAX = 3;

const isCoreHero = (e: CodeEntry): boolean =>
  e.kind === 'hero' && (HEROES as readonly string[]).includes(e.id);

/** "Swordsman 2" is the type "swordsman" and number 2. "Barbarian (alternate)" is the type "barbarian". */
function split(name: string): { base: string; n: number | undefined } {
  const plain = name
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const m = /^(.*\S)\s+(\d+)$/.exec(plain);
  return m ? { base: m[1]!, n: Number(m[2]) } : { base: plain, n: undefined };
}

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

/** The codes to try for a name, shortest first. */
function candidates(base: string): string[] {
  const words = base.split(' ').filter(Boolean);
  const first = words[0] ?? '';
  if (words.length <= 1) {
    const out: string[] = [];
    for (let k = 2; k <= Math.min(MAX, first.length); k++) out.push(cap(first.slice(0, k)));
    return out.length > 0 ? out : [first.toUpperCase()];
  }
  const second = words[1]!;
  const a = first.charAt(0).toUpperCase();
  const out = [a + second.charAt(0).toUpperCase()];
  // a clash: one more letter of the second word
  if (second.length > 1) out.push(a + cap(second.slice(0, 2)));
  return out;
}

export function teamCodes(entries: readonly CodeEntry[]): ReadonlyMap<string, string> {
  const out = new Map<string, string>();
  // the base code of each type (a type is a name without its number), so a repeat shares it
  const typeCode = new Map<string, string>();
  const taken = new Set<string>();
  const seenOfType = new Map<string, number>();

  // core heroes first: their one letter is never taken by anyone else
  for (const e of entries) if (isCoreHero(e)) taken.add(HERO_NAMES[e.id as Hero].charAt(0));

  for (const e of entries) {
    if (isCoreHero(e)) {
      out.set(e.id, HERO_NAMES[e.id as Hero].charAt(0));
      continue;
    }
    const { base, n } = split(e.name);
    const type = base.toLowerCase();
    let code = typeCode.get(type);
    if (code === undefined) {
      const list = candidates(base);
      code = list.find((c) => !taken.has(c)) ?? list[list.length - 1] ?? '?';
      typeCode.set(type, code);
      taken.add(code);
    }
    const nth = (seenOfType.get(type) ?? 0) + 1;
    seenOfType.set(type, nth);
    const number = n ?? nth;
    if (number > 1) {
      const digits = String(number);
      code = code.slice(0, Math.max(1, MAX - digits.length)) + digits;
    }
    out.set(e.id, code);
  }
  return out;
}
