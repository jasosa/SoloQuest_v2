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

/** One merge tried: the new quest, or the reason it is refused (`reason` is the part after "Cannot merge"). */
type Try =
  | { quest: Quest }
  | { reason: string; doorId?: string; whole?: undefined }
  | { reason?: undefined; whole: string };

function tryMerge(q: Quest, a: string, b: string): Try {
  // [proposal] a room with rooms merged into it cannot join another room (a two level chain)
  if (a !== b && q.areaOverrides.some((m) => m.merge[0] === b))
    return {
      whole: tr('editor.mergePick.hasRooms', '{room} has rooms merged into it. Split them first.', {
        room: b,
      }),
    };
  const quest: Quest = { ...q, areaOverrides: [...q.areaOverrides, { merge: [a, b] }] };
  // the quest validator knows the rules: unknown room, same room, merged twice, rooms apart
  const problem = validateQuestIssues(quest, board).find(
    (i) => i.severity === 'error' && i.message.includes(`areaOverrides ${a} + ${b}`),
  );
  if (problem) return { reason: problem.message.replace(/^areaOverrides \S+ \+ \S+: /, '') };
  // [proposal] a door on the wall between the two rooms would be inside one room
  const door = [...q.doors, ...q.secretDoors, ...q.falseDoors].find(
    (d) =>
      mergedWallRooms(board, quest.areaOverrides, d.a, d.b) !== undefined &&
      mergedWallRooms(board, q.areaOverrides, d.a, d.b) === undefined,
  );
  if (door)
    return {
      doorId: door.id,
      reason: tr(
        'editor.merges.doorOnTheWallShort',
        'door {id} is on the wall between them. Remove it first.',
        { id: door.id },
      ),
    };
  return { quest };
}

/** Merge room `b` into room `a`. Refused when a room is unknown, used already, or they do not touch. */
export function addAreaMerge(q: Quest, a: string, b: string): EditResult {
  const r = tryMerge(q, a, b);
  if ('quest' in r) return ok(r.quest, newIssues(q, r.quest));
  if (r.whole !== undefined) return fail(r.whole);
  if (r.doorId !== undefined)
    return fail(
      tr(
        'editor.merges.doorOnTheWall',
        'Cannot merge: door {id} is on the wall between them. Remove it first.',
        {
          id: r.doorId,
        },
      ),
    );
  return fail(tr('editor.merges.cannotMerge', 'Cannot merge: ') + r.reason);
}

/**
 * Merge several rooms into `main` in one action. All or nothing. A room may touch `main` or a room
 * of the list that is placed before it; the order of `joins` does not matter. When a room cannot be
 * placed, nothing is merged and the refusal names the first such room in `joins`.
 */
export function addAreaMerges(q: Quest, main: string, joins: readonly string[]): EditResult {
  let cur = q;
  let pending = [...joins];
  const why = new Map<string, Try>();
  while (pending.length > 0) {
    const left: string[] = [];
    for (const j of pending) {
      const r = tryMerge(cur, main, j);
      if ('quest' in r) cur = r.quest;
      else {
        why.set(j, r);
        left.push(j);
      }
    }
    if (left.length === pending.length) {
      const room = left[0] as string;
      const r = why.get(room) as Exclude<Try, { quest: Quest }>;
      if (r.whole !== undefined) return fail(r.whole);
      return fail(
        tr('editor.merges.cannotMergeRoom', 'Cannot merge {room}: ', { room }) + r.reason,
      );
    }
    pending = left;
  }
  return ok(cur, newIssues(q, cur));
}

/** Undo a merge: room `b` is a room of its own again. */
export function removeAreaMerge(q: Quest, b: string): EditResult {
  if (!q.areaOverrides.some((m) => m.merge[1] === b))
    return fail(tr('editor.merges.roomIsNotMerged', 'Room {b} is not merged.', { b }));
  const quest: Quest = { ...q, areaOverrides: q.areaOverrides.filter((m) => m.merge[1] !== b) };
  return ok(quest, newIssues(q, quest));
}
