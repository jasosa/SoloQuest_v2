/**
 * Size and limit checks for the Frozen Horror tiles (decision 88). Every tile has fixed sizes and
 * the box holds a limited number of them: a quest that goes past that is a warning, not a crash
 * (the owner may know a house tile). Tiles are counted per map, as the book counts them per quest.
 */
import { inBoard, type Board } from '../board/board';
import {
  ICE_SLIDE_LENGTH,
  MAX_TUNNEL_PAIRS,
  footprintIndex,
  limitText,
  sizesText,
  tileSpec,
} from '../data/roomTiles';
import { roomTileCells } from './roomTileCells';
import type { Quest } from './schema';
import type { Issue, IssueRef } from './validate';

const key = (c: readonly number[]) => `${c[0]},${c[1]}`;

/** One tile as the checks see it: its group, its place in the quest list and its squares. */
export interface TileItem {
  readonly group: 'board' | 'room';
  readonly type: string;
  readonly index: number;
  readonly cells: readonly (readonly [number, number])[];
}

export function tileItems(quest: Quest, base: Board): TileItem[] {
  return [
    ...quest.boardTiles.map((t, index): TileItem => ({
      group: 'board',
      type: t.type,
      index,
      cells: t.cells,
    })),
    ...quest.roomTiles.map((t, index): TileItem => ({
      group: 'room',
      type: t.type,
      index,
      cells: roomTileCells(quest, t, base),
    })),
  ];
}

export const tileLabel = (t: Pick<TileItem, 'group' | 'type' | 'index'>) =>
  `${t.group === 'board' ? 'board tile' : 'room tile'} ${t.index + 1} (${t.type})`;

/** The box round some squares and whether the squares fill it. */
function boxOf(cells: readonly (readonly number[])[]) {
  const xs = cells.map((c) => c[0] as number);
  const ys = cells.map((c) => c[1] as number);
  const w = Math.max(...xs) - Math.min(...xs) + 1;
  const h = Math.max(...ys) - Math.min(...ys) + 1;
  return { w, h, full: new Set(cells.map(key)).size === w * h };
}

/**
 * Warnings about sizes, limits, overlaps of room tiles, tunnels and ice slides. Errors only for room
 * tile squares that are off the board or in rock (a room tile never lies over rock).
 */
export function tileLimitIssues(
  quest: Quest,
  base: Board,
  isRock: (c: readonly [number, number]) => boolean,
): Issue[] {
  const out: Issue[] = [];
  const warn = (message: string, ref?: IssueRef) =>
    out.push(ref ? { message, severity: 'warning', ref } : { message, severity: 'warning' });
  const ref = (t: TileItem): IssueRef => {
    const c = t.cells[0];
    const id = String(t.index);
    if (t.group === 'board')
      return c ? { kind: 'tile', id, cell: [c[0], c[1]] } : { kind: 'tile', id };
    return c ? { kind: 'area', cell: [c[0], c[1]] } : { kind: 'area' };
  };
  const count = new Map<string, number>();
  const items = tileItems(quest, base);
  for (const t of items) {
    const spec = tileSpec(t.group, t.type);
    if (!spec || t.cells.length === 0) continue;
    const label = tileLabel(t);
    if (t.group === 'room' && quest.roomTiles[t.index]?.cells)
      for (const c of t.cells) {
        if (!inBoard(base, c[0], c[1])) {
          out.push({
            message: `${label}: cell ${key(c)} is off the board`,
            severity: 'error',
            ref: ref(t),
          });
          break;
        }
        if (isRock(c)) {
          out.push({
            message: `${label}: cell ${key(c)} is in rock`,
            severity: 'error',
            ref: ref(t),
          });
          break;
        }
      }
    if (spec.laid) continue;
    const box = boxOf(t.cells);
    const at = box.full ? footprintIndex(spec.footprints, box.w, box.h) : -1;
    if (at < 0) {
      warn(
        `${label}: ${spec.name} comes as ${sizesText(spec)}, these squares are ${box.full ? `${box.w} x ${box.h}` : 'not a plain rectangle'}`,
        ref(t),
      );
      continue;
    }
    if (spec.maxPerSize === undefined) continue;
    const k = `${t.group}|${t.type}|${at}`;
    const n = (count.get(k) ?? 0) + 1;
    count.set(k, n);
    if (n > spec.maxPerSize) {
      const [w, h] = spec.footprints[at]!;
      warn(
        `${label}: too many ${spec.name} tiles of ${w} x ${h}: this map has ${n}, the limit is ${limitText(spec)}`,
        ref(t),
      );
    }
  }
  // Chasm squares were replaced by the 4 x 4 Bottomless Chasm Room (decision 94).
  for (const t of items)
    if (t.group === 'board' && t.type === 'chasm')
      warn(
        `${tileLabel(t)}: chasm squares are replaced by the Bottomless Chasm Room tile (4 x 4)`,
        ref(t),
      );
  // Room tiles are physical pieces: two of them never share a square.
  const owner = new Map<string, TileItem>();
  for (const t of items) {
    if (t.group !== 'room') continue;
    for (const c of t.cells) {
      const other = owner.get(key(c));
      if (other && other.index !== t.index) {
        warn(`${tileLabel(t)} overlaps ${tileLabel(other)} at ${key(c)}`, ref(t));
        break;
      }
      if (!other) owner.set(key(c), t);
    }
  }
  if (quest.tunnels.length > MAX_TUNNEL_PAIRS)
    warn(
      `ice tunnels: this map has ${quest.tunnels.length} pairs, the limit is ${MAX_TUNNEL_PAIRS} pairs (1 x 1 each end)`,
      { kind: 'tunnel', id: quest.tunnels[MAX_TUNNEL_PAIRS]!.id },
    );
  const slides = quest.traps.filter((t) => t.kind === 'iceSlide');
  slides.forEach((t, i) => {
    const r: IssueRef = { kind: 'trap', id: t.id };
    if (i >= 1)
      warn(
        `ice slide ${t.id}: this map has ${slides.length} ice slides, the limit is 1 of 1 x ${ICE_SLIDE_LENGTH}`,
        r,
      );
    const p = t.path ?? [];
    const line =
      p.length > 0 && (p.every((c) => c[0] === p[0]![0]) || p.every((c) => c[1] === p[0]![1]));
    if (p.length !== ICE_SLIDE_LENGTH || !line)
      warn(
        `ice slide ${t.id}: the Ice Slide comes as 1 x ${ICE_SLIDE_LENGTH}, this path has ${p.length} squares${line ? '' : ' and is not a straight line'}`,
        r,
      );
  });
  return out;
}
