/**
 * The tooltip text of a monster (decision 69): who it is, whether the quest marks it special,
 * its stats and its abilities. Used as the hover text of the token and the roster row; the same
 * facts are in the margin note for touch. Pure, no React.
 */
import type { MonsterView } from '../../engine/game/view';

export function monsterTip(m: MonsterView, code: string): string {
  const lines = [`${code} ${m.name}`];
  if (m.special) lines.push('Special monster');
  const s = m.stats;
  lines.push(`Move ${s.move} · Att ${s.att} · Def ${s.def} · Body ${s.body} · Mind ${s.mind}`);
  for (const a of m.abilities) lines.push(`${a.name}: ${a.text}`);
  return lines.join('\n');
}

/** The ability names on one line, for the roster row. */
export function abilityLine(m: MonsterView): string {
  return m.abilities.map((a) => a.name).join(' · ');
}
