import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { manifestFiles, readPack, writePack } from '../src/ui/theme/pack';
import { packOfBox } from './build-pack';

describe('build:pack frozen-horror', () => {
  const pack = packOfBox('frozen-horror', (p) => readFileSync(`public/${p}`));
  it('writes a pack the app can import, with the manifest and every picture it names', () => {
    const r = readPack(writePack(pack));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.pack.manifest.id).toBe('fz-ah-2021');
    expect(r.pack.manifest.box).toBe('frozen-horror');
    expect(r.pack.manifest.origin).toBe('official');
    expect(Object.keys(r.pack.files).sort()).toEqual(manifestFiles(r.pack.manifest).sort());
    expect(Object.keys(r.pack.files).length).toBeGreaterThan(30);
  });
  it('stays under the pack size limit', () => {
    const total = Object.values(pack.files).reduce((n, f) => n + f.bytes.length, 0);
    expect(total).toBeLessThan(10 * 1024 * 1024);
  });
  it('refuses a box without art', () => {
    expect(() => packOfBox('nope', () => new Uint8Array())).toThrow(/included/);
  });
});
