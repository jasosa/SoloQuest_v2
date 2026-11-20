import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ROOM_TILES, BOARD_TILES } from '../../engine/data/roomTiles';
import { MemoryThemeStore } from '../../persist/themes';
import { INCLUDED_PACKS, withIncluded } from './included';
import { boxOfQuest, FROZEN_HORROR } from './questBox';
import { manifestFiles, PackManifestSchema, readPack, themeFromPack, writePack } from './pack';
import { mergeThemes, monsterPicture, isThemeToken, tilePictureFor, type Theme } from './theme';

const base = { format: 'sqtextures', version: 1, id: 'fh-x', name: 'FH x' };

describe('pack slots for Frozen Horror pictures', () => {
  it('reads enemy, edgeDoor, tunnel and tile slots, with one picture or a list per tile', () => {
    const m = PackManifestSchema.parse({
      ...base,
      box: 'frozen-horror',
      extends: 'core-a',
      family: 'fam-a',
      enemy: { iceGremlin: { file: 'g.png', scale: 1.2 } },
      edgeDoor: { ironEntry: 'i.png' },
      tunnel: { '1': 't1.png' },
      tile: {
        iceVault: [
          { file: 'a.png', cells: [2, 3] },
          { file: 'b.png', cells: [3, 4] },
        ],
        scepterRoom: { file: 's.png', cells: [4, 4] },
      },
    });
    expect(manifestFiles(m).sort()).toEqual(
      ['a.png', 'b.png', 'g.png', 'i.png', 's.png', 't1.png'].sort(),
    );
    const t = themeFromPack({ manifest: m, files: {} }, (f) => `u/${f}`);
    expect(t.box).toBe('frozen-horror');
    expect(t.enemy).toEqual({ iceGremlin: 'u/g.png' });
    expect(t.tune?.enemy?.iceGremlin).toEqual({ scale: 1.2 });
    expect(t.edgeDoor?.ironEntry).toBe('u/i.png');
    expect(t.tunnel?.['1']).toBe('u/t1.png');
    expect(t.tile?.iceVault?.map((p) => p.href)).toEqual(['u/a.png', 'u/b.png']);
    expect(t.tile?.scepterRoom?.[0]?.cells).toEqual([4, 4]);
  });

  it('refuses bad tile keys, sizes and enemy ids', () => {
    const bad = (extra: object) => PackManifestSchema.safeParse({ ...base, ...extra }).success;
    expect(bad({ tile: { nope: { file: 'a.png', cells: [1, 1] } } })).toBe(false);
    expect(bad({ tile: { iceVault: { file: 'a.png', cells: [0, 3] } } })).toBe(false);
    expect(bad({ tile: { iceVault: { file: 'a.png' } } })).toBe(false);
    expect(bad({ enemy: { 'bad id': 'a.png' } })).toBe(false);
    expect(bad({ tunnel: { '12': 'a.png' } })).toBe(false);
    expect(bad({ edgeDoor: { ironEntry: '../a.png' } })).toBe(false);
  });
});

describe('theme helpers', () => {
  const theme: Theme = {
    id: 't',
    name: 't',
    monster: { goblin: 'core-goblin' },
    enemy: { iceGremlin: 'gremlin' },
    tile: {
      icyRiver: [
        { href: 'r8', cells: [1, 8] },
        { href: 'r3', cells: [1, 3] },
      ],
    },
  };
  it('picks the tile picture by footprint and says when it is turned', () => {
    expect(tilePictureFor(theme, 'icyRiver', 1, 8)).toMatchObject({ turned: false });
    expect(tilePictureFor(theme, 'icyRiver', 3, 1)?.picture.href).toBe('r3');
    expect(tilePictureFor(theme, 'icyRiver', 3, 1)?.turned).toBe(true);
    expect(tilePictureFor(theme, 'icyRiver', 4, 4)).toBeUndefined();
    expect(tilePictureFor(theme, 'iceVault', 3, 2)).toBeUndefined();
  });
  it('an enemy picture wins over the type picture, an own image wins over both', () => {
    expect(monsterPicture(theme, undefined, 'goblin', 'iceGremlin')).toBe('gremlin');
    expect(monsterPicture(theme, undefined, 'goblin', 'other')).toBe('core-goblin');
    expect(monsterPicture(theme, 'mine', 'goblin', 'iceGremlin')).toBe('mine');
    expect(monsterPicture(theme, undefined, undefined, 'iceGremlin')).toBe('gremlin');
    expect(monsterPicture(theme, undefined, undefined, 'nobody')).toBeUndefined();
    expect(isThemeToken(theme, undefined, undefined, 'iceGremlin')).toBe(true);
    expect(isThemeToken(theme, 'mine', undefined, 'iceGremlin')).toBe(false);
  });
  it('merging keeps tiles, enemies and tunnels of both, the child winning per key', () => {
    const merged = mergeThemes(
      { id: 'p', name: 'p', enemy: { a: '1', b: '2' }, tunnel: { '1': 'x' }, tile: theme.tile! },
      { id: 'c', name: 'c', enemy: { b: '3' }, tunnel: { '2': 'y' }, tile: { iceLedge: [] } },
    );
    expect(merged.enemy).toEqual({ a: '1', b: '3' });
    expect(merged.tunnel).toEqual({ '1': 'x', '2': 'y' });
    expect(Object.keys(merged.tile ?? {}).sort()).toEqual(['iceLedge', 'icyRiver']);
  });
});

describe('the Frozen Horror pack that ships with the app', () => {
  const inc = INCLUDED_PACKS.find((i) => i.manifest.box === FROZEN_HORROR)!;
  const t = themeFromPack({ manifest: inc.manifest, files: {} }, (f) => `u/${f}`);
  const disk = (f: string) => readFileSync(`public/${inc.folder}${f}`);

  it('is a real, explicit expansion pack: named, official, for its box, made for one core pack', () => {
    expect(inc.manifest.name).toBe('Frozen Horror');
    expect(inc.manifest.origin).toBe('official');
    expect(inc.manifest.box).toBe('frozen-horror');
    expect(inc.manifest.extends).toBe('core-ah-2021');
    expect(inc.manifest.family).toBe('ah-2021');
  });

  it('names only pictures that are in public/assets/frozen-horror, and knows their size', () => {
    const files = manifestFiles(inc.manifest);
    expect(files.length).toBe(32);
    expect(files.reduce((n, f) => n + disk(f).length, 0)).toBe(inc.bytes);
  });

  it('has a picture for every Frozen Horror tile size', () => {
    for (const def of Object.values(ROOM_TILES))
      for (const [w, h] of def.footprints)
        expect(tilePictureFor(t, def.id, w, h), `${def.id} ${w}x${h}`).toBeDefined();
    for (const id of ['iceCaveEntrance', 'icyRiver', 'iceLedge', 'slipperyIce'] as const)
      for (const [w, h] of BOARD_TILES[id].footprints)
        expect(tilePictureFor(t, id, w, h), `${id} ${w}x${h}`).toBeDefined();
    expect(tilePictureFor(t, 'iceSlide', 1, 8)).toBeDefined();
  });

  const fetcher = async (url: string) => {
    const f = url.replace(/^.*assets\/frozen-horror\//, '');
    const bytes = disk(f);
    return {
      ok: true,
      arrayBuffer: async () =>
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
    };
  };

  it('is listed with its name, box and size, and can be loaded and exported as a file', async () => {
    const store = withIncluded(new MemoryThemeStore(), fetcher, '/');
    const row = (await store.list()).find((p) => p.id === 'fz-ah-2021')!;
    expect(row).toMatchObject({
      name: 'Frozen Horror',
      box: 'frozen-horror',
      included: true,
      bytes: inc.bytes,
    });
    const pack = (await store.load('fz-ah-2021'))!;
    const back = readPack(writePack(pack));
    expect(back.ok).toBe(true);
  });

  it('a copy the player saved wins over the shipped one in the list', async () => {
    const mem = new MemoryThemeStore();
    const store = withIncluded(mem, fetcher, '/');
    await mem.save((await store.load('fz-ah-2021'))!);
    const rows = (await store.list()).filter((p) => p.id === 'fz-ah-2021');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.included).toBeUndefined();
  });

  it('a quest is Frozen Horror by its pack, or by using its pieces', () => {
    const none = { roomTiles: [], boardTiles: [], tunnels: [], edgeDoors: [] };
    expect(boxOfQuest({ ...none, pack: 'frozen-horror' })).toBe('frozen-horror');
    expect(boxOfQuest(none)).toBeUndefined();
    expect(boxOfQuest({ ...none, tunnels: [{} as never] })).toBe('frozen-horror');
  });
});
