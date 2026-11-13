import { describe, expect, it } from 'vitest';
import { FRAME, pageOf, pdftoppmArgs } from './render-maps';

describe('render-maps', () => {
  it('quest N is on PDF page N + 2', () => {
    expect(pageOf(1)).toBe(3);
    expect(pageOf(14)).toBe(16);
  });

  it('crops the frame at 300 dpi (twice the 150 dpi numbers)', () => {
    expect(FRAME).toEqual({ x: 400, y: 240, w: 2220, h: 1600 });
  });

  it('builds pdftoppm args for one page', () => {
    const full = pdftoppmArgs('q.pdf', 3, 'out/q03', false);
    expect(full).toEqual([
      '-r',
      '300',
      '-f',
      '5',
      '-l',
      '5',
      '-png',
      '-singlefile',
      'q.pdf',
      'out/q03',
    ]);
    const crop = pdftoppmArgs('q.pdf', 3, 'out/q03-map', true);
    expect(crop).toContain('-W');
    expect(crop.slice(-2)).toEqual(['q.pdf', 'out/q03-map']);
  });
});
