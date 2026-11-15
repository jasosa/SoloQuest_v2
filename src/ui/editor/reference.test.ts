import { describe, expect, it } from 'vitest';
import {
  applyHomography,
  boardCorners,
  isConvexQuad,
  referenceMatrix,
  solveHomography,
  toMatrix3d,
  type Pt,
} from './reference';

const close = (a: Pt, b: Pt) => {
  expect(a[0]).toBeCloseTo(b[0], 6);
  expect(a[1]).toBeCloseTo(b[1], 6);
};

describe('reference homography', () => {
  const target = boardCorners(26, 19, 34, 2);

  it('maps each corner to its board corner', () => {
    const src: Pt[] = [
      [120, 80],
      [1900, 140],
      [1850, 1400],
      [90, 1320],
    ];
    const h = solveHomography(src, target)!;
    src.forEach((p, i) => close(applyHomography(h, p), target[i]!));
  });

  it('an axis aligned frame is a scale and a shift', () => {
    const src: Pt[] = [
      [100, 50],
      [1400, 50],
      [1400, 1000],
      [100, 1000],
    ];
    const h = referenceMatrix(src, boardCorners(26, 19, 34))!;
    close(applyHomography(h, [750, 525]), [13 * 34, 9.5 * 34]); // the middle
    close(applyHomography(h, [150, 50]), [34, 0]);
    expect(h[6]).toBeCloseTo(0, 9);
    expect(h[7]).toBeCloseTo(0, 9);
  });

  it('keeps the middle of a tilted frame inside the board (perspective)', () => {
    const src: Pt[] = [
      [200, 100],
      [1000, 100],
      [1200, 900],
      [0, 900],
    ];
    const h = referenceMatrix(src, boardCorners(26, 19, 34))!;
    const mid = applyHomography(h, [600, 500]);
    expect(mid[0]).toBeGreaterThan(0);
    expect(mid[0]).toBeLessThan(26 * 34);
    expect(mid[1]).toBeGreaterThan(0);
    expect(mid[1]).toBeLessThan(19 * 34);
  });

  it('makes a css matrix3d with the shift in the last column', () => {
    const h = solveHomography(
      [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
      ],
      [
        [5, 7],
        [25, 7],
        [25, 27],
        [5, 27],
      ],
    )!;
    const m = toMatrix3d(h);
    expect(m).toHaveLength(16);
    expect(m[0]).toBeCloseTo(2);
    expect(m[5]).toBeCloseTo(2);
    expect(m[12]).toBeCloseTo(5);
    expect(m[13]).toBeCloseTo(7);
    expect(m[15]).toBe(1);
  });

  it('refuses points that do not make a convex four sided shape', () => {
    expect(
      isConvexQuad([
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
      ]),
    ).toBe(true);
    // crossed order
    expect(
      isConvexQuad([
        [0, 0],
        [10, 10],
        [10, 0],
        [0, 10],
      ]),
    ).toBe(false);
    // three on a line
    expect(
      referenceMatrix(
        [
          [0, 0],
          [5, 0],
          [10, 0],
          [0, 10],
        ],
        target,
      ),
    ).toBeUndefined();
  });
});
