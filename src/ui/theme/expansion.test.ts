import { describe, expect, it } from 'vitest';
import frozenManifest from '../../content/art/fz-ah-2021.theme.json';
import { expansionLayout, expansionMissing, EXPANSION_COLS } from './expansion';
import { PackManifestSchema, themeFromPack } from './pack';
import { adjustableSlots, tuneOfSlot, withTune } from './tune';

const manifest = PackManifestSchema.parse(frozenManifest);
const theme = themeFromPack({ manifest, files: {} }, (f) => `u/${f}`);

describe('expansion pack preview', () => {
  it('lists only slots of the expansion that the pack leaves empty, never core slots', () => {
    const missing = expansionMissing(manifest);
    expect(missing).toEqual([
      'tunnel design 4',
      'tunnel design 5',
      'tunnel design 6',
      'tunnel design 7',
      'tunnel design 8',
      'tunnel design 9',
    ]);
    expect(missing.some((m) => /monster|furniture|door closed|trap|board/.test(m))).toBe(false);
  });

  it('lists a missing enemy, edge door and tile', () => {
    const m = PackManifestSchema.parse({
      format: 'sqtextures',
      version: 1,
      id: 'x-fh',
      name: 'X',
      box: 'frozen-horror',
      extends: 'core-x',
      family: 'f-x',
      enemy: { yeti: 'y.png' },
    });
    const missing = expansionMissing(m);
    expect(missing).toContain('enemy iceGremlin');
    expect(missing).not.toContain('enemy yeti');
    expect(missing).toContain('edge door ironEntry');
    expect(missing).toContain('tile iceVault');
  });

  it('places every enemy, both doors, the three tunnels and every tile picture without overlap', () => {
    const l = expansionLayout(theme);
    const count = (k: string) => l.items.filter((i) => i.kind === k).length;
    expect(count('enemy')).toBe(8);
    expect(count('edgeDoor')).toBe(2);
    expect(count('tunnel')).toBe(3);
    expect(count('tile')).toBe(18);
    const tiles = l.items.filter((i) => i.kind === 'tile');
    for (const a of tiles)
      for (const b of tiles) {
        if (a === b || a.kind !== 'tile' || b.kind !== 'tile') continue;
        const apart = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
        expect(apart).toBe(true);
      }
    for (const a of tiles)
      if (a.kind === 'tile') expect(a.x + a.w).toBeLessThanOrEqual(EXPANSION_COLS);
    expect(Object.keys(l.boxes)).toContain('enemy.yeti');
    expect(Object.keys(l.boxes)).toContain('edgeDoor.ironEntry');
    expect(Object.keys(l.boxes)).toContain('tunnel.2');
  });
});

describe('adjusting the expansion slots', () => {
  it('offers enemies, edge doors and tunnels, and keeps a change in the manifest', () => {
    const ids = adjustableSlots(manifest).map((s) => s.id);
    expect(ids).toContain('enemy.iceGremlin');
    expect(ids).toContain('edgeDoor.woodenExit');
    expect(ids).toContain('tunnel.3');
    const next = withTune(manifest, 'enemy.yeti', { scale: 1.2, offset: [0, 0.1] });
    expect(tuneOfSlot(next, 'enemy.yeti')).toEqual({ scale: 1.2, offset: [0, 0.1] });
    const t = themeFromPack({ manifest: next, files: {} }, (f) => `u/${f}`);
    expect(t.tune?.enemy?.['yeti']).toEqual({ scale: 1.2, offset: [0, 0.1] });
    expect(tuneOfSlot(manifest, 'enemy.frozenHorror').scale).toBe(1.5);
  });
});
