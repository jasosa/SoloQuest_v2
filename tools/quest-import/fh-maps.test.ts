import { describe, expect, it } from 'vitest';
import { fhPdftoppmArgs, pngSize } from './fh-render';
import {
  FH_MAPS,
  FH_QUESTS,
  fhCalibration,
  fhCrop,
  uprightSize,
  uprightTransform,
} from './fh-maps';
import { parseFhArgs } from './render-maps';

/** Apply a canvas matrix (a, b, c, d, e, f) to a point. */
const apply = (m: number[], x: number, y: number): [number, number] => [
  m[0]! * x + m[2]! * y + m[4]!,
  m[1]! * x + m[3]! * y + m[5]!,
];

describe('fh-maps table', () => {
  it('has quests 0 to 8, quest 0 from the prelude and the rest from the pack pages 8 to 15', () => {
    expect([...FH_QUESTS]).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(FH_MAPS[0]).toMatchObject({ source: 'prelude', page: 1, rotation: 0 });
    for (let q = 1; q <= 8; q++)
      expect(FH_MAPS[q]).toMatchObject({ source: 'book', page: q + 7, rotation: 90 });
  });

  it('keeps every board inside its upright page', () => {
    for (const q of FH_QUESTS) {
      const m = FH_MAPS[q]!;
      const [w, h] = m.source === 'book' ? [3000, 3900] : [2550, 3300];
      const c = fhCrop(q);
      expect(Math.min(c.x, c.y)).toBeGreaterThan(0);
      expect(c.x + c.w).toBeLessThanOrEqual(w);
      expect(c.y + c.h).toBeLessThanOrEqual(h);
    }
  });

  it('calibration is the grid seen from the crop, and the board fits in it', () => {
    for (const q of FH_QUESTS) {
      const cal = fhCalibration(q);
      const g = FH_MAPS[q]!.grid;
      const c = fhCrop(q);
      expect(cal.x0 + c.x).toBeCloseTo(g.x0, 6);
      expect(cal.y0 + c.y).toBeCloseTo(g.y0, 6);
      expect(cal.x0 + 26 * cal.cw).toBeLessThan(cal.width);
      expect(cal.y0 + 19 * cal.ch).toBeLessThan(cal.height);
      expect(cal.cw).toBeGreaterThan(70);
      expect(cal.cw).toBeLessThan(85);
    }
  });

  it('a clockwise quarter turn sends the raw top-left corner to the upright top-right', () => {
    // Raw page 3900 x 3000 becomes 3000 x 3900.
    expect(uprightSize(90, 3900, 3000)).toEqual([3000, 3900]);
    const m = uprightTransform(90, 3900, 3000, { x: 0, y: 0 });
    expect(apply(m, 0, 0)).toEqual([3000, 0]);
    expect(apply(m, 3900, 0)).toEqual([3000, 3900]);
    expect(apply(m, 0, 3000)).toEqual([0, 0]);
  });

  it('the crop shifts the result and the other turns keep the page corners', () => {
    expect(apply(uprightTransform(0, 100, 50, { x: 10, y: 5 }), 10, 5)).toEqual([0, 0]);
    expect(apply(uprightTransform(180, 100, 50, { x: 0, y: 0 }), 0, 0)).toEqual([100, 50]);
    expect(apply(uprightTransform(270, 100, 50, { x: 0, y: 0 }), 0, 0)).toEqual([0, 100]);
  });
});

describe('fh render helpers', () => {
  it('builds pdftoppm args for the whole page', () => {
    expect(fhPdftoppmArgs('a.pdf', 9, 'out/x')).toEqual([
      '-r',
      '300',
      '-f',
      '9',
      '-l',
      '9',
      '-png',
      '-singlefile',
      'a.pdf',
      'out/x',
    ]);
  });

  it('reads the size from a PNG header', () => {
    const b = Buffer.alloc(24);
    b.writeUInt32BE(3900, 16);
    b.writeUInt32BE(3000, 20);
    expect(pngSize(b)).toEqual([3900, 3000]);
  });

  it('parses the fh argument of render:maps', () => {
    expect(parseFhArgs(['3', '5'])).toBeUndefined();
    expect(parseFhArgs(['fh', '2', '0'])).toEqual([2, 0]);
    expect(parseFhArgs(['fh'])).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });
});
