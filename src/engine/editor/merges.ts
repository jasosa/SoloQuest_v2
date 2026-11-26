/**
 * Merged rooms (`areaOverrides`, Frozen Horror quest 10: a tile laid over two rooms makes one).
 * The second room becomes part of the first. Same style as `ops.ts`.
 */
import { tr } from '../../i18n/translate';
import { board } from '../board/board';
import { mergedWallRooms } from '../board/level';
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
    return fail(
      problem.message.replace(
        /^areaOverrides \S+ \+ \S+: /,
        tr('editor.merges.cannotMerge', 'Cannot merge: '),
      ),
    );
  // [proposal] a door on the wall between the two rooms would be inside one room
  const door = [...q.doors, ...q.secretDoors, ...q.falseDoors].find(
    (d) =>
      mergedWallRooms(board, quest.areaOverrides, d.a, d.b) !== undefined &&
      mergedWallRooms(board, q.areaOverrides, d.a, d.b) === undefined,
  );
  if (door)
    return fail(
      tr(
        'editor.merges.doorOnTheWall',
        'Cannot merge: door {id} is on the wall between them. Remove it first.',
        { id: door.id },
      ),
    );
  return ok(quest, newIssues(q, quest));
}

/** Undo a merge: room `b` is a room of its own again. */
export function removeAreaMerge(q: Quest, b: string): EditResult {
  if (!q.areaOverrides.some((m) => m.merge[1] === b))
    return fail(tr('editor.merges.roomIsNotMerged', 'Room {b} is not merged.', { b }));
  const quest: Quest = { ...q, areaOverrides: q.areaOverrides.filter((m) => m.merge[1] !== b) };
  return ok(quest, newIssues(q, quest));
}
