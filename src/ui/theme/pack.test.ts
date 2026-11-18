import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { readPack, themeFromPack, writePack, PACK_MAX_BYTES } from './pack';

// The first bytes of real files are enough: the reader checks the signature, not the whole picture.
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);

const manifest = {
  format: 'sqtextures',
  version: 1,
  id: 'stone-dungeon',
  name: 'Stone dungeon',
  floor: ['f1.png', 'f2.webp'],
  wall: 'w.png',
  monster: { orc: 'orc.png' },
  furniture: { table: { file: 'table.png', cells: [2, 1] } },
};

function zip(m: unknown, extra: Record<string, Uint8Array> = {}, skip: string[] = []): Uint8Array {
  const files: Record<string, Uint8Array> = {
    'theme.json': strToU8(JSON.stringify(m)),
    'f1.png': PNG,
    'f2.webp': WEBP,
    'w.png': PNG,
    'orc.png': PNG,
    'table.png': PNG,
    ...extra,
  };
  for (const s of skip) delete files[s];
  return zipSync(files);
}

describe('readPack', () => {
  it('reads a good pack', () => {
    const r = readPack(zip(manifest));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.pack.manifest.name).toBe('Stone dungeon');
    expect(r.pack.manifest.origin).toBe('fan');
    expect(r.pack.files['f2.webp']?.mime).toBe('image/webp');
  });

  it('says so when the file is not a zip', () => {
    const r = readPack(strToU8('hello'));
    expect(r).toEqual({ ok: false, message: expect.stringContaining('not a zip') });
  });

  it('needs a theme.json', () => {
    const r = readPack(zipSync({ 'a.png': PNG }));
    expect(r.ok).toBe(false);
  });

  it('refuses a theme.json that is not valid JSON or not the format', () => {
    expect(readPack(zipSync({ 'theme.json': strToU8('{ nope') })).ok).toBe(false);
    expect(readPack(zip({ ...manifest, version: 2 })).ok).toBe(false);
    expect(readPack(zip({ ...manifest, id: 'Bad Id' })).ok).toBe(false);
    expect(readPack(zip({ ...manifest, surprise: 1 })).ok).toBe(false);
  });

  it('refuses unsafe file names and files that are not pictures', () => {
    expect(readPack(zip({ ...manifest, wall: '../w.png' })).ok).toBe(false);
    expect(readPack(zip({ ...manifest, wall: '/w.png' })).ok).toBe(false);
    expect(readPack(zip({ ...manifest, wall: 'w.exe' })).ok).toBe(false);
  });

  it('refuses a picture that is missing or is not what its name says', () => {
    const missing = readPack(zip(manifest, {}, ['orc.png']));
    expect(missing).toEqual({ ok: false, message: expect.stringContaining('orc.png') });
    const fake = readPack(zip(manifest, { 'orc.png': strToU8('<script>alert(1)</script>') }));
    expect(fake).toEqual({ ok: false, message: expect.stringContaining('not a real') });
  });

  it('refuses an unknown monster or furniture type', () => {
    expect(readPack(zip({ ...manifest, monster: { dragon: 'orc.png' } })).ok).toBe(false);
    expect(readPack(zip({ ...manifest, furniture: { sofa: { file: 'table.png' } } })).ok).toBe(
      false,
    );
  });

  it('refuses a pack that is too big when unzipped', () => {
    const big = new Uint8Array(PACK_MAX_BYTES + 1); // zeros: tiny in the zip, huge unzipped
    const r = readPack(zip(manifest, { 'big.bin': big }));
    expect(r).toEqual({ ok: false, message: expect.stringContaining('bigger than 10 MB') });
  });
});

describe('writePack and themeFromPack', () => {
  it('a written pack reads back the same', () => {
    const r = readPack(zip(manifest));
    if (!r.ok) throw new Error('setup');
    const again = readPack(writePack(r.pack));
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.pack.manifest).toEqual(r.pack.manifest);
    expect(Object.keys(again.pack.files).sort()).toEqual(Object.keys(r.pack.files).sort());
    expect([...again.pack.files['w.png']!.bytes]).toEqual([...PNG]);
  });

  it('turns a pack into a theme with the file names resolved', () => {
    const r = readPack(zip(manifest));
    if (!r.ok) throw new Error('setup');
    const theme = themeFromPack(r.pack, (f) => `blob:${f}`);
    expect(theme.id).toBe('stone-dungeon');
    expect(theme.floor).toEqual(['blob:f1.png', 'blob:f2.webp']);
    expect(theme.wall).toBe('blob:w.png');
    expect(theme.monster?.orc).toBe('blob:orc.png');
    expect(theme.furniture?.table).toEqual({ href: 'blob:table.png', cells: [2, 1] });
    expect(theme.rock).toBeUndefined();
    expect(theme.door).toBeUndefined();
  });
});
