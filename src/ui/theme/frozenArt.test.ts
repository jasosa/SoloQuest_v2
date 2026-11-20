import { existsSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { ROOM_TILES, BOARD_TILES } from '../../engine/data/roomTiles';
import {
  ART_FOLDER,
  ART_MANIFESTS,
  boxArtTheme,
  boxOfQuest,
  FROZEN_HORROR,
  layeredTheme,
  resetBoxArt,
  setBoxArtOn,
} from './boxArt';
import { manifestFiles, PackManifestSchema, themeFromPack } from './pack';
import {
  CLASSIC_THEME,
  mergeThemes,
  monsterPicture,
  isThemeToken,
  tilePictureFor,
  type Theme,
} from './theme';

const base = { format: 'sqtextures', version: 1, id: 'fh-x', name: 'FH x' };

describe('pack slots for Frozen Horror pictures', () => {
  it('reads enemy, edgeDoor, tunnel and tile slots, with one picture or a list per tile', () => {
    const m = PackManifestSchema.parse({
      ...base,
      box: 'frozen-horror',
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

describe('the Frozen Horror art layer', () => {
  beforeEach(() => resetBoxArt());
  const manifest = ART_MANIFESTS[FROZEN_HORROR]!;

  it('names only pictures that are in public/assets/frozen-horror', () => {
    for (const f of manifestFiles(manifest))
      expect(existsSync(`public/${ART_FOLDER[FROZEN_HORROR]}${f}`), f).toBe(true);
  });

  it('has a picture for every Frozen Horror tile size', () => {
    const t = boxArtTheme(FROZEN_HORROR)!;
    for (const def of Object.values(ROOM_TILES))
      for (const [w, h] of def.footprints)
        expect(tilePictureFor(t, def.id, w, h), `${def.id} ${w}x${h}`).toBeDefined();
    for (const id of ['iceCaveEntrance', 'icyRiver', 'iceLedge', 'slipperyIce'] as const)
      for (const [w, h] of BOARD_TILES[id].footprints)
        expect(tilePictureFor(t, id, w, h), `${id} ${w}x${h}`).toBeDefined();
    expect(tilePictureFor(t, 'iceSlide', 1, 8)).toBeDefined();
  });

  it('is added for a Frozen Horror quest only, and can be switched off', () => {
    expect(layeredTheme(CLASSIC_THEME, undefined)).toBe(CLASSIC_THEME);
    expect(layeredTheme(CLASSIC_THEME, 'core')).toBe(CLASSIC_THEME);
    const on = layeredTheme(CLASSIC_THEME, FROZEN_HORROR);
    expect(on.enemy?.yeti).toContain('monsters/yeti.png');
    expect(layeredTheme(CLASSIC_THEME, FROZEN_HORROR)).toBe(on); // stable between renders
    setBoxArtOn(FROZEN_HORROR, false);
    expect(layeredTheme(CLASSIC_THEME, FROZEN_HORROR)).toBe(CLASSIC_THEME);
  });

  it('a pack for the box wins over the layer; a core pack is under it', () => {
    const own: Theme = { id: 'mine', name: 'Mine', box: FROZEN_HORROR, enemy: { yeti: 'my-yeti' } };
    const a = layeredTheme(own, FROZEN_HORROR);
    expect(a.enemy?.yeti).toBe('my-yeti');
    expect(a.enemy?.iceGremlin).toContain('ice_gremlin.png');
    expect(a.id).toBe('mine');
    const core: Theme = { id: 'core', name: 'Core', enemy: { yeti: 'core-yeti' } };
    expect(layeredTheme(core, FROZEN_HORROR).enemy?.yeti).toContain('yeti.png');
  });

  it('a quest is Frozen Horror by its pack, or by using its pieces', () => {
    const none = { roomTiles: [], boardTiles: [], tunnels: [], edgeDoors: [] };
    expect(boxOfQuest({ ...none, pack: 'frozen-horror' })).toBe('frozen-horror');
    expect(boxOfQuest(none)).toBeUndefined();
    expect(boxOfQuest({ ...none, tunnels: [{} as never] })).toBe('frozen-horror');
  });
});
