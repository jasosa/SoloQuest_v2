import frozenHorror from '../../content/library/frozen-horror.json';
import type { PackManifest } from './pack';
import { EDGE_DOOR_SLOTS, TILE_KEYS, TUNNEL_DESIGNS, type Theme, type TileKey } from './theme';
import { tileSlotId } from './tune';

/**
 * The preview of an expansion pack (decision 99): it shows the slots of the pack itself (enemies, entry
 * and exit doors, tunnels, tiles), not the core sample, and lists as missing only what the pack is
 * meant to cover. The core slots (monsters, furniture, doors, traps) come from the core pack.
 * Pure code: the layout is worked out here, the drawing is in `PackPreview.tsx`.
 */

/** The enemy ids each box brings, for the "Not in this pack" line. A box that is not listed brings none. */
const BOX_ENEMIES: Readonly<Record<string, readonly string[]>> = {
  'frozen-horror': (frozenHorror.items as { kind: string; data: { id: string } }[])
    .filter((i) => i.kind === 'enemy')
    .map((i) => i.data.id),
};

/** The slots an expansion pack leaves empty (the built-in drawing is used there). */
export function expansionMissing(m: PackManifest): string[] {
  const out: string[] = [];
  for (const id of BOX_ENEMIES[m.box ?? ''] ?? []) if (!m.enemy?.[id]) out.push(`enemy ${id}`);
  for (const k of EDGE_DOOR_SLOTS) if (!m.edgeDoor?.[k]) out.push(`edge door ${k}`);
  for (const k of TUNNEL_DESIGNS) if (!m.tunnel?.[k]) out.push(`tunnel design ${k}`);
  for (const k of TILE_KEYS) if (!m.tile?.[k]) out.push(`tile ${k}`);
  return out;
}

/** Squares across the expansion sample. */
export const EXPANSION_COLS = 17;

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Placed =
  | { kind: 'enemy'; id: string; x: number; y: number }
  | { kind: 'block'; id: string; x: number; y: number }
  | { kind: 'edgeDoor'; id: string; x: number; y: number }
  | { kind: 'tunnel'; id: string; x: number; y: number }
  | {
      kind: 'tile';
      id: string;
      slot: string;
      key: TileKey;
      x: number;
      y: number;
      w: number;
      h: number;
    };

export interface ExpansionLayout {
  readonly cols: number;
  readonly rows: number;
  readonly items: readonly Placed[];
  /** The box in squares of every slot that can be adjusted or picked, by slot id (`enemy.yeti`). */
  readonly boxes: Readonly<Record<string, Box>>;
}

/**
 * Where each picture of an expansion theme sits in the sample, in squares. Row 0: enemy tokens and the
 * block. Row 2: the entry and exit doors (each on its own wall line) and the tunnel designs the pack has.
 * Below: every tile picture, side by side as they fit, a square apart.
 */
export function expansionLayout(theme: Theme): ExpansionLayout {
  const items: Placed[] = [];
  const boxes: Record<string, Box> = {};
  const one = (id: string, x: number, y: number, w = 1, h = 1) => {
    boxes[id] = { x, y, w, h };
  };

  let x = 0;
  for (const id of Object.keys(theme.enemy ?? {})) {
    items.push({ kind: 'enemy', id, x, y: 0 });
    one(`enemy.${id}`, x, 0);
    x += 1;
  }
  if (theme.block?.single) {
    items.push({ kind: 'block', id: 'block.single', x: x + 1, y: 0 });
    one('block.single', x + 1, 0);
  }

  // each door has a square of room on its left for the arrow, which lies outside the board
  x = 1;
  for (const k of EDGE_DOOR_SLOTS) {
    if (!theme.edgeDoor?.[k]) continue;
    items.push({ kind: 'edgeDoor', id: k, x, y: 2 });
    boxes[`edgeDoor.${k}`] = { x: x - 1, y: 2, w: 2, h: 1 };
    x += 3;
  }
  x = Math.max(x, 1) + 1;
  for (const d of TUNNEL_DESIGNS) {
    if (!theme.tunnel?.[d]) continue;
    items.push({ kind: 'tunnel', id: d, x, y: 2 });
    one(`tunnel.${d}`, x, 2);
    x += 1;
  }

  // tiles: shelves, left to right, a new shelf when the next picture does not fit
  let cx = 0;
  let cy = 4;
  let shelf = 0;
  for (const key of TILE_KEYS) {
    const pictures = theme.tile?.[key] ?? [];
    for (const p of pictures) {
      const [w, h] = p.cells;
      if (cx > 0 && cx + w > EXPANSION_COLS) {
        cx = 0;
        cy += shelf + 1;
        shelf = 0;
      }
      const slot = tileSlotId(key, pictures.length, p.cells);
      items.push({ kind: 'tile', id: `${key}-${w}x${h}`, slot, key, x: cx, y: cy, w, h });
      boxes[slot] = { x: cx, y: cy, w, h };
      cx += w + 1;
      shelf = Math.max(shelf, h);
    }
  }
  const rows = items.some((i) => i.kind === 'tile') ? cy + shelf : 4;
  return { cols: EXPANSION_COLS, rows, items, boxes };
}
