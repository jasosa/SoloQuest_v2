import { describe, expect, it } from 'vitest';
import { board } from '../../src/engine/board/board';
import { testQuest } from '../../src/engine/quest/testQuest';
import {
  buildOverlaySvg,
  cellCenter,
  cellRect,
  DEFAULT_CALIBRATION,
  edgeLine,
} from './overlay-svg';

const cal = { x0: 10, y0: 20, cw: 80, ch: 80, width: 2100, height: 1600 };

describe('overlay-svg', () => {
  it('maps cells to pixels', () => {
    expect(cellRect(cal, 0, 0)).toEqual({ x: 10, y: 20, w: 80, h: 80 });
    expect(cellCenter(cal, 2, 1)).toEqual([210, 140]);
  });

  it('finds the edge line between neighbors, in either order', () => {
    expect(edgeLine(cal, [3, 17], [3, 18])).toEqual([250, 1460, 330, 1460]);
    expect(edgeLine(cal, [3, 18], [3, 17])).toEqual([250, 1460, 330, 1460]);
    expect(edgeLine(cal, [4, 15], [5, 15])).toEqual([410, 1220, 410, 1300]);
  });

  it('draws doors, monsters and the scan', () => {
    const svg = buildOverlaySvg(board, testQuest(), DEFAULT_CALIBRATION, { scanHref: 'data:x' });
    expect(svg).toContain('<image href="data:x"');
    expect(svg).toContain('>d1<');
    expect(svg).toContain('>m1<');
    expect(svg).toContain('>s1<');
  });

  it('draws only the grid without a quest', () => {
    const svg = buildOverlaySvg(board, undefined, DEFAULT_CALIBRATION, { grid: true });
    expect(svg).toContain('>25,18<');
  });
});
