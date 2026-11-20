/**
 * Merged rooms (`areaOverrides`, Frozen Horror quest 10: a tile laid over two rooms makes one).
 * The second room becomes part of the first. Same style as `ops.ts`.
 */
import { board } from '../board/board';
import type { Quest } from '../quest/schema';
import { validateQuestIssues } from '../quest/validate';
import { fail, newIssues, ok, type EditResult } from './result';

/** Merge room `b` into room `a`. Refused when a room is unknown, used already, or they do not touch. */
export function addAreaMerge(q: Quest, a: string, b: string): EditResult {
  const quest: Quest = { ...q, areaOverrides: [...q.areaOverrides, { merge: [a, b] }] };
  // the quest validator knows the rules: unknown room, same room, merged twice, rooms apart
  const problem = validateQuestIssues(quest, board).find(
    (i) => i.severity === 'error' && i.message.includes(`areaOverrides ${a} + ${b}`),
  );
  if (problem)
    return fail(problem.message.replace(/^areaOverrides \S+ \+ \S+: /, 'Cannot merge: '));
  return ok(quest, newIssues(q, quest));
}

/** Undo a merge: room `b` is a room of its own again. */
export function removeAreaMerge(q: Quest, b: string): EditResult {
  if (!q.areaOverrides.some((m) => m.merge[1] === b)) return fail(`Room ${b} is not merged.`);
  const quest: Quest = { ...q, areaOverrides: q.areaOverrides.filter((m) => m.merge[1] !== b) };
  return ok(quest, newIssues(q, quest));
}
