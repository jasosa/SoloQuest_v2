/**
 * Pure maths of the reference image: four corner points on the image are mapped to the four
 * corners of the 26 x 19 board with a homography (a perspective transform), so a photo or scan
 * lines up even when it is slightly turned or tilted.
 */
export type Pt = readonly [number, number];
/** The 8 numbers h0..h7 of a 3 x 3 matrix whose last entry is 1 (row by row). */
export type Homography = readonly [number, number, number, number, number, number, number, number];

/** The order the corners are asked for: the corners of the board frame on the image. */

/** The four board corners in the same order, for a board of w x h squares of size `unit`, shifted by `pad`. */
export function boardCorners(w: number, h: number, unit: number, pad = 0): Pt[] {
  return [
    [pad, pad],
    [pad + w * unit, pad],
    [pad + w * unit, pad + h * unit],
    [pad, pad + h * unit],
  ];
}

/** Solve a square linear system by Gaussian elimination with partial pivoting. Undefined when singular. */
function solve(a: number[][], b: number[]): number[] | undefined {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]!]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(m[r]![c]!) > Math.abs(m[p]![c]!)) p = r;
    if (Math.abs(m[p]![c]!) < 1e-9) return undefined;
    [m[c], m[p]] = [m[p]!, m[c]!];
    for (let r = c + 1; r < n; r++) {
      const f = m[r]![c]! / m[c]![c]!;
      for (let k = c; k <= n; k++) m[r]![k]! -= f * m[c]![k]!;
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = m[r]![n]!;
    for (let k = r + 1; k < n; k++) s -= m[r]![k]! * x[k]!;
    x[r] = s / m[r]![r]!;
  }
  return x;
}

/** The homography that takes each `src` point to the `dst` point at the same index. */
export function solveHomography(src: readonly Pt[], dst: readonly Pt[]): Homography | undefined {
  if (src.length !== 4 || dst.length !== 4) return undefined;
  const a: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i]!;
    const [u, v] = dst[i]!;
    a.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    a.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  const h = solve(a, b);
  if (!h || h.some((n) => !Number.isFinite(n))) return undefined;
  return h as unknown as Homography;
}

export function applyHomography(h: Homography, p: Pt): Pt {
  const w = h[6] * p[0] + h[7] * p[1] + 1;
  return [(h[0] * p[0] + h[1] * p[1] + h[2]) / w, (h[3] * p[0] + h[4] * p[1] + h[5]) / w];
}

/** The 16 numbers of a CSS `matrix3d(...)` that does the same (2D points, column-major). */
export function toMatrix3d(h: Homography): number[] {
  return [h[0], h[3], 0, h[6], h[1], h[4], 0, h[7], 0, 0, 1, 0, h[2], h[5], 0, 1];
}

/**
 * True when four points, in order, make a convex four sided shape that is not flat. A photo of a
 * flat map can only give such a shape.
 */
export function isConvexQuad(p: readonly Pt[]): boolean {
  if (p.length !== 4) return false;
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = p[i]!;
    const b = p[(i + 1) % 4]!;
    const c = p[(i + 2) % 4]!;
    const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (Math.abs(cross) < 1e-6) return false;
    const s = Math.sign(cross);
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

/** The matrix that lays an image on the board, from four corner points on the image. */
export function referenceMatrix(
  corners: readonly Pt[],
  target: readonly Pt[],
): Homography | undefined {
  if (!isConvexQuad(corners)) return undefined;
  return solveHomography(corners, target);
}
