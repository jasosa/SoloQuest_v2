/** Which quest people are on the team, and which are companions. Pure helpers for the team strip. */
import type { TeamMember } from '../../engine/data/team';

/** What the strip needs of a quest person. */
export interface Person {
  readonly id: string;
  readonly name: string;
  readonly move?: number | undefined;
  readonly attack?: number | undefined;
  readonly defend: number;
  readonly body: number;
  readonly text: string;
}

const same = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The quest person a mercenary or ally is (the wolf of a quest is also an ally of the team), if any. */
export function personOf(member: TeamMember, people: readonly Person[]): Person | undefined {
  if (member.kind === 'hero') return undefined;
  return people.find(
    (p) =>
      member.id === `ally:${p.id}` || member.id === `merc:${p.id}` || same(member.name, p.name),
  );
}

/** The quest people in play who are not on the team: the companions. */
export function companionsOf<P extends Person>(
  inPlay: readonly P[],
  team: readonly TeamMember[],
): P[] {
  return inPlay.filter((p) => !team.some((m) => personOf(m, [p])));
}
