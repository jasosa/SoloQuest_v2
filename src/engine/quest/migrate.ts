import { SCHEMA_VERSION } from './schema';

export class QuestVersionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuestVersionError';
  }
}

/**
 * Bring raw quest data to the current schema version.
 * Stub: only version 1 exists. When version 2 arrives, add a step per version here.
 */
export function migrateQuest(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw))
    throw new QuestVersionError('Quest file must be a JSON object.');
  const v = (raw as { schemaVersion?: unknown }).schemaVersion;
  if (v === undefined) throw new QuestVersionError('Quest file has no schemaVersion.');
  if (v !== SCHEMA_VERSION)
    throw new QuestVersionError(
      `Unsupported quest schemaVersion ${JSON.stringify(v)}. This app reads version ${SCHEMA_VERSION}.`,
    );
  return dropLegacy(raw);
}

/** Same-version cleanups (decision 66): `zargonInfo` is gone, marker `zargon` became `editor`. */
export function dropLegacy(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return raw;
  const rest = { ...(raw as Record<string, unknown>) };
  delete rest.zargonInfo;
  if (Array.isArray(rest.markers))
    rest.markers = rest.markers.map((m: unknown) =>
      typeof m === 'object' && m !== null && (m as { visible?: unknown }).visible === 'zargon'
        ? { ...m, visible: 'editor' }
        : m,
    );
  const out = moveChasmToRoomTile(rest);
  if (Array.isArray(out.maps)) out.maps = out.maps.map((m: unknown) => moveChasmToRoomTile(m));
  return out;
}

/**
 * Decision 94: chasm squares laid one by one are gone from the editor. A chasm that fills a plain
 * 4 x 4 square becomes the Bottomless Chasm Room tile (when the map has none yet). Anything else
 * stays as it is: the validator warns about it and the owner decides.
 */
function moveChasmToRoomTile(map: unknown): Record<string, unknown> {
  if (typeof map !== 'object' || map === null) return map as Record<string, unknown>;
  const m = { ...map } as Record<string, unknown>;
  if (!Array.isArray(m.boardTiles)) return m;
  const tiles = m.boardTiles as { type?: unknown; cells?: unknown }[];
  const rooms: { type?: unknown; cells?: unknown }[] = Array.isArray(m.roomTiles)
    ? [...(m.roomTiles as { type?: unknown }[])]
    : [];
  const keep: unknown[] = [];
  for (const t of tiles) {
    // a chasm with a flag or `blocks` stays as it is: the room tile has no such fields
    const plain = Object.keys(t).every((k) => k === 'type' || k === 'cells');
    const cells =
      t.type === 'chasm' && plain && Array.isArray(t.cells) ? (t.cells as number[][]) : null;
    if (cells && cells.length === 16 && !rooms.some((r) => r.type === 'chasmRoom')) {
      const xs = cells.map((c) => c[0]!);
      const ys = cells.map((c) => c[1]!);
      const [x0, y0] = [Math.min(...xs), Math.min(...ys)];
      const full =
        Math.max(...xs) - x0 === 3 &&
        Math.max(...ys) - y0 === 3 &&
        new Set(cells.map((c) => `${c[0]},${c[1]}`)).size === 16;
      if (full) {
        rooms.push({ type: 'chasmRoom', cells: cells.map((c) => [c[0], c[1]]) });
        continue;
      }
    }
    keep.push(t);
  }
  if (keep.length !== tiles.length) {
    m.boardTiles = keep;
    m.roomTiles = rooms;
  }
  return m;
}
