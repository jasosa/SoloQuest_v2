/**
 * The Merge rooms tool by taps (decision 106): which room a square is in, what a tap on a room does
 * to the two slots, whether the pair can be merged, and the outline of a room. Pure, no React.
 */
import { areaAt, board as baseBoard } from '../../engine/board/board';
import { mergedWallRooms } from '../../engine/board/level';
import { addAreaMerge, type Cell } from '../../engine/editor';
import { isRockCell } from '../../engine/editor/result';
import type { Quest } from '../../engine/quest/schema';
import { t } from '../../i18n/t';

/** The room that stays and the room that joins it (a base room id each), or nothing yet. */
export interface MergePick {
  readonly a: string | null;
  readonly b: string | null;
}

export const NO_PICK: MergePick = { a: null, b: null };

/** The base room of a square, or null for the corridor, rock or a square off the board. */
export function roomAtCell(q: Quest, cell: readonly number[]): string | null {
  const area = areaAt(baseBoard, cell[0] as number, cell[1] as number);
  if (area === undefined || area === 'C') return null;
  return isRockCell(q, cell) ? null : area;
}

/** The room a merged room was joined into, or undefined for a room that is not merged away. */
export const mainOf = (q: Quest, room: string): string | undefined =>
  q.areaOverrides.find((m) => m.merge[1] === room)?.merge[0];

/**
 * What a tap on a room does. A tap on nothing (corridor, rock) changes nothing. A room merged away is
 * refused with a sentence. A picked room is taken out of its slot. The first free slot takes the room;
 * with both full the joining room is replaced.
 */
export function tapRoom(
  q: Quest,
  pick: MergePick,
  room: string | null,
): { pick: MergePick; error: string | null } {
  if (room === null) return { pick, error: null };
  const main = mainOf(q, room);
  if (main !== undefined)
    return {
      pick,
      error: t('editor.mergePick.partOf', '{room} is part of {main}. Split it first.', {
        room,
        main,
      }),
    };
  if (pick.a === room) return { pick: { a: null, b: pick.b }, error: null };
  if (pick.b === room) return { pick: { a: pick.a, b: null }, error: null };
  // a room that others were merged into cannot join another room (its rooms would be left behind)
  const hasRooms = q.areaOverrides.some((m) => m.merge[0] === room);
  if (hasRooms && pick.a !== null)
    return {
      pick,
      error: t('editor.mergePick.hasRooms', '{room} has rooms merged into it. Split them first.', {
        room,
      }),
    };
  if (pick.a === null) return { pick: { a: room, b: pick.b }, error: null };
  return { pick: { a: pick.a, b: room }, error: null };
}

export type MergeState = 'empty' | 'partial' | 'ready' | 'blocked';

/** Can the picked pair be merged? The engine says no with a sentence (apart, a door on the wall...). */
export function mergeTrial(q: Quest, pick: MergePick): { state: MergeState; error: string | null } {
  if (pick.a === null && pick.b === null) return { state: 'empty', error: null };
  if (pick.a === null || pick.b === null) return { state: 'partial', error: null };
  const r = addAreaMerge(q, pick.a, pick.b);
  return r.ok ? { state: 'ready', error: null } : { state: 'blocked', error: r.error };
}

/** The door on the wall between the picked rooms, when it is why the merge is refused. */
export function doorOnMergeWall(
  q: Quest,
  pick: MergePick,
): { id: string; a: Cell; b: Cell } | undefined {
  if (pick.a === null || pick.b === null) return undefined;
  const next = [...q.areaOverrides, { merge: [pick.a, pick.b] as [string, string] }];
  const d = [...q.doors, ...q.secretDoors, ...q.falseDoors].find(
    (x) =>
      mergedWallRooms(baseBoard, next, x.a, x.b) !== undefined &&
      mergedWallRooms(baseBoard, q.areaOverrides, x.a, x.b) === undefined,
  );
  return d ? { id: d.id, a: d.a as Cell, b: d.b as Cell } : undefined;
}

/** Segments (in square corners) round the squares where `inside` holds: the outline of a room. */
export function outlineSegments(
  width: number,
  height: number,
  inside: (x: number, y: number) => boolean,
): [number, number, number, number][] {
  const out: [number, number, number, number][] = [];
  const at = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height && inside(x, y);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      if (!inside(x, y)) continue;
      if (!at(x, y - 1)) out.push([x, y, x + 1, y]);
      if (!at(x + 1, y)) out.push([x + 1, y, x + 1, y + 1]);
      if (!at(x, y + 1)) out.push([x, y + 1, x + 1, y + 1]);
      if (!at(x - 1, y)) out.push([x, y, x, y + 1]);
    }
  return out;
}
