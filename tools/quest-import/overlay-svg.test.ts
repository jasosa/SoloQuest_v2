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

  it('draws edge doors, the start door in green', () => {
    const q = {
      ...testQuest(),
      start: { door: 'in' },
      edgeDoors: [
        {
          id: 'in',
          cell: [0, 5] as [number, number],
          side: 'w' as const,
          kind: 'ironEntry' as const,
        },
        {
          id: 'out',
          cell: [10, 0] as [number, number],
          side: 'n' as const,
          kind: 'woodenExit' as const,
        },
      ],
    };
    const svg = buildOverlaySvg(board, q, cal);
    expect(svg).toContain('>in iron<');
    expect(svg).toContain('>out wood<');
    // West edge of square (0,5): x = x0, from y0 + 5 ch down one square.
    expect(svg).toContain('x1="10.0" y1="420.0" x2="10.0" y2="500.0" stroke="#00c853"');
    // North edge of square (10,0).
    expect(svg).toContain('x1="810.0" y1="20.0" x2="890.0" y2="20.0" stroke="#ff1744"');
  });

  it('draws tunnel ends, board tiles and room tiles', () => {
    const q = {
      ...testQuest(),
      tunnels: [
        { id: 't1', design: 2, a: [1, 1] as [number, number], b: [5, 5] as [number, number] },
      ],
      boardTiles: [{ type: 'iceCaveEntrance' as const, cells: [[0, 0] as [number, number]] }],
      roomTiles: [{ type: 'iceVault' as const, area: 'R20' }],
    };
    const svg = buildOverlaySvg(board, q, cal);
    expect(svg.match(/>T2</g)).toHaveLength(2);
    expect(svg).toContain('&lt;iceCaveEntrance>');
    expect(svg).toContain('[iceVault]');
  });
});
