import { FURNITURE_TYPES, MONSTER_TYPES, TRAP_KINDS } from '../../engine/quest/schema';
import type { PackManifest } from './pack';
import { TOKEN_SIZE } from './theme';

/**
 * Checks of a texture pack for its author (the pack preview): pictures that are much smaller than they
 * are shown (soft on a tablet, which draws at up to twice the size), a board picture of the wrong
 * shape, and slots the pack leaves empty. Pure code: the sizes of the pictures are given.
 */

export interface PictureSize {
  readonly w: number;
  readonly h: number;
}

export interface PackCheck {
  /** Things to fix or know. */
  readonly warnings: string[];
  /** Slots the pack leaves empty (the built-in drawing is used). */
  readonly missing: string[];
}

/** A square is drawn 34 px wide, and a tablet shows it at up to 2 times that. */
const SQUARE = 34;
const SHARP = 2;
/** A picture this much smaller than what it needs is reported (a little less is fine). */
const TOLERANCE = 0.75;
const BOARD_RATIO = 26 / 19;

const scaleOf = (slot: unknown): number =>
  typeof slot === 'object' && slot && 'scale' in slot && typeof slot.scale === 'number'
    ? slot.scale
    : 1;
const fileOf = (slot: unknown): string | undefined =>
  typeof slot === 'string'
    ? slot
    : typeof slot === 'object' && slot && 'file' in slot && typeof slot.file === 'string'
      ? slot.file
      : undefined;

export function checkPack(
  m: PackManifest,
  sizes: Readonly<Record<string, PictureSize>>,
): PackCheck {
  const warnings: string[] = [];
  const missing: string[] = [];

  // A picture and the width (in px, normal size) it is shown at.
  const soft = (label: string, slot: unknown, shownWidth: number) => {
    const file = fileOf(slot);
    const size = file ? sizes[file] : undefined;
    if (!file || !size) return;
    const shown = shownWidth * scaleOf(slot);
    const needed = Math.round(shown * SHARP);
    if (Math.max(size.w, size.h) < needed * TOLERANCE)
      warnings.push(
        `${label}: ${size.w} x ${size.h} px, shown about ${Math.round(shown)} px wide. It needs about ${needed} px to stay sharp on a tablet.`,
      );
  };

  // The board
  if (!m.board) missing.push('board picture');
  else {
    const size = sizes[m.board];
    if (size) {
      if (Math.abs(size.w / size.h / BOARD_RATIO - 1) > 0.04)
        warnings.push(
          `board: ${size.w} x ${size.h} px is not the shape of the board (26 x 19 squares), so it will look stretched.`,
        );
      const needed = 26 * SQUARE * SHARP;
      if (size.w < needed * TOLERANCE)
        warnings.push(
          `board: ${size.w} px wide. It needs about ${needed} px to stay sharp on a tablet.`,
        );
    }
  }

  // Monsters
  const monsters = m.monster ?? {};
  for (const t of MONSTER_TYPES) {
    if (!monsters[t]) missing.push(`monster ${t}`);
    else soft(`monster ${t}`, monsters[t], TOKEN_SIZE);
  }

  // Furniture
  const furniture = m.furniture ?? {};
  for (const t of FURNITURE_TYPES) {
    const f = furniture[t];
    if (!f) {
      missing.push(`furniture ${t}`);
      continue;
    }
    if (f.cells) soft(`furniture ${t}`, f, Math.max(f.cells[0], f.cells[1]) * SQUARE);
  }

  // Doors, blocks, traps
  for (const k of ['closed', 'open', 'secret'] as const) {
    const slot = m.door?.[k];
    if (!slot) missing.push(`door ${k}`);
    else soft(`door ${k}`, slot, SQUARE);
  }
  for (const [k, w] of [
    ['single', SQUARE],
    ['double', SQUARE * 2],
  ] as const) {
    const slot = m.block?.[k];
    if (!slot) missing.push(`block ${k}`);
    else soft(`block ${k}`, slot, w);
  }
  for (const k of ['armed', ...TRAP_KINDS] as const) {
    const slot = m.trap?.[k];
    if (!slot) missing.push(`trap ${k}`);
    else soft(`trap ${k}`, slot, SQUARE);
  }
  return { warnings, missing };
}
