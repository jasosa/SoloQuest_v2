import { describe, expect, it } from 'vitest';
import { areaAt, board, cellsOf, isWallBetween, parseBoard, roomIds } from './board';

describe('board', () => {
  it('is 26 x 19', () => {
    expect(board.width).toBe(26);
    expect(board.height).toBe(19);
    expect(board.cells).toHaveLength(19);
    for (const row of board.cells) expect(row).toHaveLength(26);
  });

  it('has 22 rooms R01..R22', () => {
    const ids = roomIds(board);
    expect(ids).toHaveLength(22);
    expect(ids[0]).toBe('R01');
    expect(ids[21]).toBe('R22');
  });

  it.each([
    ['R01', 12],
    ['R02', 12],
    ['R03', 15],
    ['R04', 15],
    ['R05', 16],
    ['R06', 16],
    ['R07', 20],
    ['R08', 20],
    ['R09', 16],
    ['R10', 16],
    ['R11', 30],
    ['R12', 16],
    ['R13', 6],
    ['R14', 6],
    ['R15', 15],
    ['R16', 16],
    ['R17', 20],
    ['R18', 15],
    ['R19', 20],
    ['R20', 16],
    ['R21', 12],
    ['R22', 16],
  ])('%s has %i squares', (id, size) => {
    expect(cellsOf(board, id)).toHaveLength(size);
  });

  it('R11 is the 6 x 5 center room', () => {
    const cells = cellsOf(board, 'R11');
    const xs = cells.map((c) => c[0]);
    const ys = cells.map((c) => c[1]);
    expect(Math.max(...xs) - Math.min(...xs) + 1).toBe(6);
    expect(Math.max(...ys) - Math.min(...ys) + 1).toBe(5);
  });

  it('R15 is L-shaped: its bounding box is bigger than its area', () => {
    const cells = cellsOf(board, 'R15');
    const xs = cells.map((c) => c[0]);
    const ys = cells.map((c) => c[1]);
    const box = (Math.max(...xs) - Math.min(...xs) + 1) * (Math.max(...ys) - Math.min(...ys) + 1);
    expect(cells).toHaveLength(15);
    expect(box).toBeGreaterThan(cells.length);
  });

  it('every other room is a rectangle', () => {
    for (const id of roomIds(board).filter((r) => r !== 'R15')) {
      const cells = cellsOf(board, id);
      const xs = cells.map((c) => c[0]);
      const ys = cells.map((c) => c[1]);
      const box = (Math.max(...xs) - Math.min(...xs) + 1) * (Math.max(...ys) - Math.min(...ys) + 1);
      expect(box, id).toBe(cells.length);
    }
  });

  it('the outer ring is all corridor', () => {
    for (let x = 0; x < board.width; x++) {
      expect(areaAt(board, x, 0)).toBe('C');
      expect(areaAt(board, x, board.height - 1)).toBe('C');
    }
    for (let y = 0; y < board.height; y++) {
      expect(areaAt(board, 0, y)).toBe('C');
      expect(areaAt(board, board.width - 1, y)).toBe('C');
    }
  });

  it('corridor squares are all connected', () => {
    const corridor = cellsOf(board, 'C');
    const seen = new Set<string>(['0,0']);
    const queue: [number, number][] = [[0, 0]];
    while (queue.length) {
      const [x, y] = queue.pop()!;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nx = x + dx;
        const ny = y + dy;
        const k = `${nx},${ny}`;
        if (areaAt(board, nx, ny) === 'C' && !seen.has(k)) {
          seen.add(k);
          queue.push([nx, ny]);
        }
      }
    }
    expect(seen.size).toBe(corridor.length);
  });

  it('derives walls from area ids', () => {
    // R01 is x1..4, y1..3; corridor ring at x0.
    expect(isWallBetween(board, [1, 1], [2, 1])).toBe(false); // same room
    expect(isWallBetween(board, [0, 1], [1, 1])).toBe(true); // corridor | room
    expect(isWallBetween(board, [0, 0], [1, 0])).toBe(false); // corridor | corridor
    expect(isWallBetween(board, [0, 0], [-1, 0])).toBe(true); // board edge
  });

  it('rejects a malformed board', () => {
    expect(() => parseBoard({ width: 2, height: 1, cells: [['C']] })).toThrow();
    expect(() => parseBoard({ width: 1, height: 1, cells: [['X9']] })).toThrow();
  });
});
