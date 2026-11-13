import { describe, expect, it } from 'vitest';
import { U, adjacent, edgeOfCell, footprintCells, nearestEdge, toCell } from './geometry';

describe('editor geometry', () => {
  it('maps a point to a square, and nothing outside the board', () => {
    expect(toCell(U * 3 + 5, U * 4 + 20)).toEqual([3, 4]);
    expect(toCell(-1, 10)).toBeUndefined();
    expect(toCell(U * 26 + 1, 10)).toBeUndefined();
  });

  it('finds the edge near a square border, not in the middle', () => {
    expect(nearestEdge(U * 3 + U / 2, U * 4 + 2)).toEqual({ a: [3, 4], b: [3, 3] });
    expect(nearestEdge(U * 3 + U - 2, U * 4 + U / 2)).toEqual({ a: [3, 4], b: [4, 4] });
    expect(nearestEdge(U * 3 + U / 2, U * 4 + U / 2)).toBeUndefined();
    expect(nearestEdge(2, U * 4 + U / 2)).toBeUndefined(); // the board border has no other side
    expect(edgeOfCell([0, 0], 'w')).toBeUndefined();
    expect(edgeOfCell([5, 5], 'e')).toEqual({ a: [5, 5], b: [6, 5] });
  });

  it('gives the footprint of a piece, turned or not', () => {
    expect(footprintCells('table', [2, 3], false)).toHaveLength(6);
    expect(footprintCells('bookcase', [2, 3], false).map((c) => c[0])).toEqual([2, 3, 4]);
    expect(footprintCells('bookcase', [2, 3], true).map((c) => c[1])).toEqual([3, 4, 5]);
    expect(footprintCells('chest', [0, 0], true)).toEqual([[0, 0]]);
  });

  it('knows touching squares', () => {
    expect(adjacent([1, 1], [1, 2])).toBe(true);
    expect(adjacent([1, 1], [2, 2])).toBe(false);
  });
});
