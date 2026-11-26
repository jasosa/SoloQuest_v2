/**
 * The Merge rooms tool by taps (decision 106): which room a square is in, what a tap on a room does
 * to the two slots, whether the pair can be merged, and the outline of a room. Pure, no React.
 */
import { areaAt, board as baseBoard } from '../../engine/board/board';
import { addAreaMerges, type Cell } from '../../engine/editor';
import { isRockCell } from '../../engine/editor/result';
import type { Quest } from '../../engine/quest/schema';
import { t } from '../../i18n/t';

/** The room that stays and the rooms that join it (base room ids), in the order they were tapped. */
export interface MergePick {
  readonly a: string | null;
  readonly joins: readonly string[];
}

export const NO_PICK: MergePick = { a: null, joins: [] };

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
 * What a tap on a room does (decisions 106 and 108). A tap on nothing (corridor, rock) or on a room
 * that is merged away changes nothing and says nothing. A picked room is taken out. The first room
 * tapped stays; every other room joins it. A room that has rooms merged into it cannot join another
 * room: the tap is refused with a sentence.
 */
export function tapRoom(
  q: Quest,
  pick: MergePick,
  room: string | null,
): { pick: MergePick; error: string | null } {
  if (room === null || mainOf(q, room) !== undefined) return { pick, error: null };
  if (pick.a === room) return { pick: { a: null, joins: pick.joins }, error: null };
  if (pick.joins.includes(room))
    return { pick: { a: pick.a, joins: pick.joins.filter((j) => j !== room) }, error: null };
  const hasRooms = q.areaOverrides.some((m) => m.merge[0] === room);
  if (hasRooms && pick.a !== null)
    return {
      pick,
      error: t('editor.mergePick.hasRooms', '{room} has rooms merged into it. Split them first.', {
        room,
      }),
    };
  if (pick.a === null) return { pick: { a: room, joins: pick.joins }, error: null };
  return { pick: { a: pick.a, joins: [...pick.joins, room] }, error: null };
}

export type MergeState = 'empty' | 'partial' | 'ready' | 'blocked';

/** Can the picked rooms be merged? The engine says no with a sentence naming the room that blocks it. */
export function mergeTrial(q: Quest, pick: MergePick): { state: MergeState; error: string | null } {
  if (pick.a === null && pick.joins.length === 0) return { state: 'empty', error: null };
  if (pick.a === null || pick.joins.length === 0) return { state: 'partial', error: null };
  const r = addAreaMerges(q, pick.a, pick.joins);
  return r.ok ? { state: 'ready', error: null } : { state: 'blocked', error: r.error };
}

/** The door that stops the merge, read from the engine sentence (to ring it on the board). */
export function doorOnMergeWall(
  q: Quest,
  pick: MergePick,
): { id: string; a: Cell; b: Cell } | undefined {
  const t = mergeTrial(q, pick);
  const id = t.error?.match(/door (\S+) is on the wall/)?.[1];
  if (!id) return undefined;
  const d = [...q.doors, ...q.secretDoors, ...q.falseDoors].find((x) => x.id === id);
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
