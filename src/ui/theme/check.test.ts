import { describe, expect, it } from 'vitest';
import { checkPack } from './check';
import type { PackManifest } from './pack';

const base: PackManifest = { format: 'sqtextures', version: 1, id: 'p', name: 'P', origin: 'fan' };

describe('checkPack, expansion slots', () => {
  it('warns about a small enemy, edge door and tunnel picture, and not about big ones', () => {
    const m: PackManifest = {
      ...base,
      enemy: { yeti: 'y.png', iceGremlin: 'g.png' },
      edgeDoor: { ironEntry: 'i.png' },
      tunnel: { '1': 't.png' },
    };
    const small = checkPack(m, {
      'y.png': { w: 40, h: 40 },
      'g.png': { w: 200, h: 200 },
      'i.png': { w: 50, h: 50 },
      't.png': { w: 50, h: 50 },
    });
    const text = small.warnings.join(' ');
    expect(small.warnings).toHaveLength(3);
    expect(text).toMatch(/enemy yeti: 40 x 40 px, shown about 32 px wide/);
    expect(text).toMatch(/edge door ironEntry: 50 x 50 px/);
    expect(text).toMatch(/tunnel design 1: 50 x 50 px/);
    expect(text).not.toMatch(/iceGremlin/);
  });

  it('warns about a small tile picture by its own cells size', () => {
    const m: PackManifest = {
      ...base,
      tile: {
        iceVault: [
          { file: 'a.png', cells: [2, 3] },
          { file: 'b.png', cells: [3, 4] },
        ],
        scepterRoom: { file: 's.png', cells: [4, 4] },
      },
    };
    // 2x3 is shown 102 px wide: 204 px needed, 153 is just enough; 3x4 needs 272 (204 is just enough)
    const ok = checkPack(m, {
      'a.png': { w: 153, h: 100 },
      'b.png': { w: 204, h: 150 },
      's.png': { w: 272, h: 272 },
    });
    expect(ok.warnings).toEqual([]);
    const bad = checkPack(m, {
      'a.png': { w: 100, h: 100 },
      'b.png': { w: 600, h: 800 },
      's.png': { w: 100, h: 100 },
    });
    expect(bad.warnings).toHaveLength(2);
    expect(bad.warnings[0]).toMatch(/^tile iceVault 2x3: 100 x 100 px, shown about 102 px wide/);
    expect(bad.warnings[1]).toMatch(/^tile scepterRoom 4x4: 100 x 100 px/);
  });
});

describe('checkPack', () => {
  it('lists every slot an empty pack leaves out', () => {
    const r = checkPack(base, {});
    expect(r.warnings).toEqual([]);
    expect(r.missing).toContain('board picture');
    expect(r.missing).toContain('monster orc');
    expect(r.missing).toContain('furniture table');
    expect(r.missing).toContain('door secret');
    expect(r.missing).toContain('block double');
    expect(r.missing).toContain('trap pit');
  });

  it('does not list a slot the pack fills', () => {
    const r = checkPack({ ...base, board: 'b.png', monster: { orc: 'o.png' } }, {});
    expect(r.missing).not.toContain('board picture');
    expect(r.missing).not.toContain('monster orc');
    expect(r.missing).toContain('monster goblin');
  });

  it('warns about a board that is not the shape of the board, or is small', () => {
    const wrong = checkPack({ ...base, board: 'b.png' }, { 'b.png': { w: 2000, h: 2000 } });
    expect(wrong.warnings.join(' ')).toMatch(/not the shape of the board/);
    const small = checkPack({ ...base, board: 'b.png' }, { 'b.png': { w: 520, h: 380 } });
    expect(small.warnings.join(' ')).toMatch(/needs about 1768 px/);
    const good = checkPack({ ...base, board: 'b.png' }, { 'b.png': { w: 2600, h: 1900 } });
    expect(good.warnings).toEqual([]);
  });

  it('warns about a picture much smaller than it is shown, counting the scale', () => {
    const m: PackManifest = {
      ...base,
      monster: { orc: 'o.png', goblin: { file: 'g.png', scale: 2 } },
    };
    // an orc is shown 32 px wide: 64 px are needed, 48 is just enough
    expect(
      checkPack(m, { 'o.png': { w: 48, h: 48 }, 'g.png': { w: 200, h: 200 } }).warnings,
    ).toEqual([]);
    const r = checkPack(m, { 'o.png': { w: 40, h: 40 }, 'g.png': { w: 90, h: 90 } });
    expect(r.warnings).toHaveLength(2);
    expect(r.warnings[1]).toMatch(/monster orc: 40 x 40 px, shown about 32 px wide/);
    // the goblin is scaled to 64 px wide: it needs 128 (a little under, 96 or more, is accepted)
    expect(r.warnings[0]).toMatch(/monster goblin: .*shown about 64 px wide.*about 128 px/);
  });

  it('checks furniture against its footprint', () => {
    const m: PackManifest = {
      ...base,
      furniture: { table: { file: 't.png', cells: [3, 2] } },
    };
    // a 3-wide table is shown 102 px wide: it needs about 204 px
    expect(checkPack(m, { 't.png': { w: 160, h: 106 } }).warnings).toEqual([]);
    expect(checkPack(m, { 't.png': { w: 100, h: 66 } }).warnings.join(' ')).toMatch(
      /furniture table/,
    );
  });
});
