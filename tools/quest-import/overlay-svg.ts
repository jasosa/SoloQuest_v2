/**
 * Pure part of the overlay tool: map cell coordinates to scan pixels and build an SVG
 * that draws a quest (and optionally the scan under it). No file or browser access here.
 */
import { areaAt, type Board } from '../../src/engine/board/board';
import type { Quest } from '../../src/engine/quest/schema';
import { roomTileCells } from '../../src/engine/quest/roomTileCells';

/** Where the board grid sits in the cropped scan (measured from the grid lines of quest 1). */
export interface Calibration {
  x0: number;
  y0: number;
  cw: number;
  ch: number;
  width: number;
  height: number;
}

export const DEFAULT_CALIBRATION: Calibration = {
  x0: 21.5,
  y0: 17.5,
  cw: 82.92,
  ch: 83.2,
  width: 2220,
  height: 1600,
};

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function cellRect(cal: Calibration, x: number, y: number): Rect {
  return { x: cal.x0 + x * cal.cw, y: cal.y0 + y * cal.ch, w: cal.cw, h: cal.ch };
}

export function cellCenter(cal: Calibration, x: number, y: number): [number, number] {
  const r = cellRect(cal, x, y);
  return [r.x + r.w / 2, r.y + r.h / 2];
}

/** Line segment (pixels) of the edge between two orthogonal neighbor cells. */
export function edgeLine(
  cal: Calibration,
  a: readonly [number, number],
  b: readonly [number, number],
): [number, number, number, number] {
  const x = Math.max(a[0], b[0]);
  const y = Math.max(a[1], b[1]);
  if (a[0] !== b[0]) {
    const r = cellRect(cal, x, a[1]);
    return [r.x, r.y, r.x, r.y + r.h];
  }
  const r = cellRect(cal, a[0], y);
  return [r.x, r.y, r.x + r.w, r.y];
}

const MONSTER_LETTER: Record<string, string> = {
  goblin: 'Go',
  orc: 'Or',
  abomination: 'Ab',
  skeleton: 'Sk',
  zombie: 'Zo',
  mummy: 'Mu',
  dreadWarrior: 'DW',
  gargoyle: 'Ga',
  dreadSorcerer: 'DS',
};

export const monsterLetter = (type: string): string => MONSTER_LETTER[type] ?? '??';

export interface OverlayOptions {
  /** Embedded scan as a data URI. Omit to draw on a white page. */
  scanHref?: string;
  /** Draw coordinates in every cell (used to read the scan). */
  grid?: boolean;
  /** Scan opacity, 0..1. */
  scanOpacity?: number;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function rectEl(r: Rect, attrs: string): string {
  return `<rect x="${r.x.toFixed(1)}" y="${r.y.toFixed(1)}" width="${r.w.toFixed(1)}" height="${r.h.toFixed(1)}" ${attrs}/>`;
}

function text(x: number, y: number, s: string, size: number, fill: string, extra = ''): string {
  return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${size}" font-family="Arial, sans-serif" font-weight="bold" fill="${fill}" text-anchor="middle" ${extra}>${esc(s)}</text>`;
}

/** SVG of the overlay. `quest` may be omitted to draw only the scan and grid. */
export function buildOverlaySvg(
  board: Board,
  quest: Quest | undefined,
  cal: Calibration = DEFAULT_CALIBRATION,
  opts: OverlayOptions = {},
): string {
  const out: string[] = [];
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${cal.width}" height="${cal.height}" viewBox="0 0 ${cal.width} ${cal.height}">`,
  );
  out.push(`<rect width="${cal.width}" height="${cal.height}" fill="#fff"/>`);
  if (opts.scanHref)
    out.push(
      `<image href="${opts.scanHref}" x="0" y="0" width="${cal.width}" height="${cal.height}" opacity="${opts.scanOpacity ?? 1}"/>`,
    );

  // Grid lines and coordinates.
  if (opts.grid) {
    for (let y = 0; y < board.height; y++)
      for (let x = 0; x < board.width; x++) {
        const r = cellRect(cal, x, y);
        out.push(rectEl(r, 'fill="none" stroke="#0a7" stroke-width="1" stroke-opacity="0.6"'));
        out.push(text(r.x + 14, r.y + 13, `${x},${y}`, 11, '#036', 'fill-opacity="0.9"'));
      }
  }

  // Board walls (different area ids, not both corridor).
  for (let y = 0; y < board.height; y++)
    for (let x = 0; x < board.width; x++) {
      const here = areaAt(board, x, y);
      for (const [dx, dy] of [
        [1, 0],
        [0, 1],
      ] as const) {
        const nx = x + dx;
        const ny = y + dy;
        const there = areaAt(board, nx, ny);
        if (there === undefined || here === undefined) continue;
        if (here === there) continue;
        const [x1, y1, x2, y2] = edgeLine(cal, [x, y], [nx, ny]);
        out.push(
          `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#00bcd4" stroke-width="3" stroke-opacity="0.8"/>`,
        );
      }
    }

  if (quest) {
    // Rock.
    const rockRooms = new Set(quest.rock.rooms);
    const rockCells = new Set(quest.rock.cells.map((c) => `${c[0]},${c[1]}`));
    for (let y = 0; y < board.height; y++)
      for (let x = 0; x < board.width; x++) {
        const a = areaAt(board, x, y);
        if ((a && rockRooms.has(a)) || rockCells.has(`${x},${y}`))
          out.push(rectEl(cellRect(cal, x, y), 'fill="#2962ff" fill-opacity="0.28"'));
      }

    // Start room outline.
    for (let y = 0; y < board.height; y++)
      for (let x = 0; x < board.width; x++)
        if (areaAt(board, x, y) === quest.start.area)
          out.push(rectEl(cellRect(cal, x, y), 'fill="#00c853" fill-opacity="0.18"'));

    // Blocks.
    for (const b of quest.blocks)
      for (const c of b.cells) {
        const r = cellRect(cal, c[0], c[1]);
        out.push(rectEl(r, 'fill="#000" fill-opacity="0.35" stroke="#000" stroke-width="2"'));
        out.push(text(r.x + r.w / 2, r.y + r.h / 2 + 8, 'B', 24, '#fff'));
      }

    // Room tiles (Frozen Horror): the room's tile type, written in its first square.
    for (const rt of quest.roomTiles) {
      const cs = roomTileCells(quest, rt, board);
      for (const [x, y] of cs)
        out.push(rectEl(cellRect(cal, x, y), 'fill="#00acc1" fill-opacity="0.12"'));
      const first = cs[0];
      if (first) {
        const r = cellRect(cal, first[0], first[1]);
        out.push(text(r.x + r.w / 2, r.y + r.h / 2 + 5, `[${rt.type}]`, 13, '#006064'));
      }
    }

    // Board tiles (ice cave entrance, cage, river, ledge...).
    for (const bt of quest.boardTiles) {
      for (const c of bt.cells)
        out.push(
          rectEl(
            cellRect(cal, c[0], c[1]),
            'fill="#00e5ff" fill-opacity="0.15" stroke="#00838f" stroke-width="3" stroke-dasharray="8 5"',
          ),
        );
      const first = bt.cells[0];
      if (first) {
        const r = cellRect(cal, first[0], first[1]);
        out.push(text(r.x + r.w / 2, r.y + 18, `<${bt.type}>`, 13, '#006064'));
      }
    }

    // Furniture.
    for (const f of quest.furniture) {
      for (const c of f.cells)
        out.push(
          rectEl(
            cellRect(cal, c[0], c[1]),
            'fill="#ffa000" fill-opacity="0.3" stroke="#e65100" stroke-width="2"',
          ),
        );
      const first = f.cells[0];
      if (first) {
        const r = cellRect(cal, first[0], first[1]);
        out.push(
          text(
            r.x + r.w / 2,
            r.y + r.h - 8,
            `${f.id}${f.letter ? ' ' + f.letter : ''}`,
            15,
            '#bf360c',
          ),
        );
      }
    }

    // Traps.
    for (const t of quest.traps) {
      const cell =
        t.cell ??
        (t.furniture ? quest.furniture.find((f) => f.id === t.furniture)?.cells[0] : undefined);
      if (!cell) continue;
      const [cx, cy] = cellCenter(cal, cell[0], cell[1]);
      out.push(
        `<polygon points="${cx},${cy - 24} ${cx + 24},${cy + 20} ${cx - 24},${cy + 20}" fill="#ffd600" fill-opacity="0.6" stroke="#000" stroke-width="2"/>`,
      );
      out.push(text(cx, cy + 14, `${t.kind[0]?.toUpperCase() ?? '?'} ${t.id}`, 13, '#000'));
    }

    // Monsters.
    for (const m of quest.monsters) {
      if (!m.cell) continue;
      const [cx, cy] = cellCenter(cal, m.cell[0], m.cell[1]);
      out.push(
        `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="34" fill="#d50000" fill-opacity="0.22" stroke="#d50000" stroke-width="3"/>`,
      );
      out.push(text(cx, cy - 4, monsterLetter(m.type), 22, '#b71c1c'));
      out.push(text(cx, cy + 20, m.id, 14, '#b71c1c'));
    }

    // Ice tunnels: both ends, labelled with the design number.
    for (const t of quest.tunnels)
      for (const c of [t.a, t.b]) {
        const [cx, cy] = cellCenter(cal, c[0], c[1]);
        out.push(
          `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="30" fill="#2979ff" fill-opacity="0.2" stroke="#1a237e" stroke-width="4"/>`,
        );
        out.push(text(cx, cy + 9, `T${t.design}`, 24, '#1a237e'));
      }

    // Markers.
    for (const m of quest.markers) {
      const [cx, cy] = cellCenter(cal, m.cell[0], m.cell[1]);
      out.push(text(cx, cy + 8, m.label, 26, '#6a1b9a'));
    }

    // Note letters.
    for (const n of quest.notes) {
      if (!n.at || !n.letter) continue;
      const [cx, cy] = cellCenter(cal, n.at[0], n.at[1]);
      out.push(
        `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="26" fill="none" stroke="#6a1b9a" stroke-width="4" stroke-dasharray="6 4"/>`,
      );
      out.push(text(cx, cy + 9, n.letter, 26, '#6a1b9a'));
    }

    // Doors (drawn last, thick).
    const doorLine = (
      d: { id: string; a: readonly [number, number]; b: readonly [number, number] },
      color: string,
    ) => {
      const [x1, y1, x2, y2] = edgeLine(cal, d.a, d.b);
      out.push(
        `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${color}" stroke-width="9" stroke-opacity="0.8"/>`,
      );
      out.push(text((x1 + x2) / 2, (y1 + y2) / 2 - 8, d.id, 14, color));
    };
    for (const d of quest.doors) doorLine(d, '#ff6d00');
    for (const d of quest.secretDoors) doorLine(d, '#aa00ff');
    for (const d of quest.falseDoors) doorLine(d, '#e91e63');

    // Doors in the outer wall of the board (Frozen Horror): the start door is green.
    for (const d of quest.edgeDoors) {
      const [x, y] = d.cell;
      const outside: [number, number] =
        d.side === 'n'
          ? [x, y - 1]
          : d.side === 's'
            ? [x, y + 1]
            : d.side === 'w'
              ? [x - 1, y]
              : [x + 1, y];
      const [x1, y1, x2, y2] = edgeLine(cal, d.cell, outside);
      const color = quest.start.door === d.id ? '#00c853' : '#ff1744';
      out.push(
        `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${color}" stroke-width="11" stroke-opacity="0.85"/>`,
      );
      out.push(
        text(
          (x1 + x2) / 2,
          (y1 + y2) / 2 + 26,
          `${d.id} ${d.kind === 'ironEntry' ? 'iron' : 'wood'}`,
          14,
          color,
        ),
      );
    }
  }

  out.push('</svg>');
  return out.join('\n');
}
