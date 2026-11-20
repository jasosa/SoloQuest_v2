import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DexieThemeStore, MemoryThemeStore } from '../../persist/themes';
import {
  normalizeSelection,
  needsMessage,
  removePack,
  restorePack,
  selectionLine,
  stopPack,
  applyPack,
} from './activate';
import { getActiveTheme, getExpansionThemes } from './activeTheme';
import { PackManifestSchema, readPack, writePack, type StoredPack } from './pack';
import { themeForBox } from './questBox';
import { CLASSIC_THEME } from './theme';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const make = (m: Record<string, unknown>, files: string[] = []): StoredPack => ({
  manifest: PackManifestSchema.parse({ format: 'sqtextures', version: 1, ...m }),
  files: Object.fromEntries(files.map((f) => [f, { mime: 'image/png', bytes: PNG }])),
});

// family A: core pack A, an expansion pack for frozen-horror and one for another box; family B
const coreA = () =>
  make({ id: 'core-a', name: 'Core A', family: 'fam-a', floor: ['f.png'] }, ['f.png']);
const coreB = () => make({ id: 'core-b', name: 'Core B', family: 'fam-b' });
const fhA = () =>
  make(
    {
      id: 'fh-a',
      name: 'FH for A',
      box: 'frozen-horror',
      extends: 'core-a',
      family: 'fam-a',
      enemy: { yeti: 'y.png' },
    },
    ['y.png'],
  );
const fhA2 = () =>
  make({
    id: 'fh-a2',
    name: 'FH for A, second',
    box: 'frozen-horror',
    extends: 'core-a',
    family: 'fam-a',
  });
const otherA = () =>
  make(
    {
      id: 'other-a',
      name: 'Other for A',
      box: 'other-box',
      extends: 'core-a',
      family: 'fam-a',
      block: { single: 'b.png' },
    },
    ['b.png'],
  );
const fhB = () =>
  make({ id: 'fh-b', name: 'FH for B', box: 'frozen-horror', extends: 'core-b', family: 'fam-b' });

async function seeded() {
  const store = new MemoryThemeStore();
  for (const p of [coreA(), coreB(), fhA(), fhA2(), otherA(), fhB()]) await store.save(p);
  return store;
}

describe('the family rule of the pack file (decision 99)', () => {
  const read = (m: Record<string, unknown>) =>
    readPack(
      writePack({
        manifest: { format: 'sqtextures', version: 1, origin: 'fan', name: 'x', ...m } as never,
        files: {},
      }),
    );
  it('refuses an expansion pack without the core pack it is made for', () => {
    const r = read({ id: 'ex-1', box: 'frozen-horror', family: 'fam-a' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain('An expansion pack needs the core pack it is made for');
  });
  it('refuses an expansion pack that does not name the family of its core pack', () => {
    const r = read({ id: 'ex-1', box: 'frozen-horror', extends: 'core-a' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain('An expansion pack needs the family of its core pack');
  });
  it('refuses a core pack that extends another pack', () => {
    const r = read({ id: 'co-1', extends: 'core-a', family: 'fam-a' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain('A core pack cannot extend another pack');
  });
  it('takes a core pack, and an expansion pack with its core pack', () => {
    expect(read({ id: 'co-1' }).ok).toBe(true);
    expect(read({ id: 'co-2', family: 'fam-a' }).ok).toBe(true);
    expect(read({ id: 'ex-1', box: 'frozen-horror', extends: 'core-a', family: 'fam-a' }).ok).toBe(
      true,
    );
  });
});

describe('what a selection becomes', () => {
  it('drops what is not valid: a missing core, an expansion pack as core, a pack of another family, a second pack of one box', async () => {
    const list = await (await seeded()).list();
    const n = (core: string | null, expansions: string[]) =>
      normalizeSelection({ core, expansions }, list);
    expect(n(null, ['fh-a'])).toEqual({ core: null, expansions: [] });
    expect(n('fh-a', [])).toEqual({ core: null, expansions: [] }); // an old single expansion choice
    expect(n('nope', [])).toEqual({ core: null, expansions: [] });
    expect(n('core-a', ['fh-a', 'fh-b'])).toEqual({ core: 'core-a', expansions: ['fh-a'] });
    expect(n('core-a', ['fh-a', 'fh-a2'])).toEqual({ core: 'core-a', expansions: ['fh-a2'] });
    expect(n('core-a', ['fh-a', 'other-a'])).toEqual({
      core: 'core-a',
      expansions: ['fh-a', 'other-a'],
    });
  });
  it('the line says what is applied', async () => {
    const list = await (await seeded()).list();
    expect(selectionLine({ core: null, expansions: [] }, list)).toBeNull();
    expect(selectionLine({ core: 'core-a', expansions: [] }, list)).toBe('Core: Core A');
    expect(selectionLine({ core: 'core-a', expansions: ['fh-a', 'other-a'] }, list)).toBe(
      'Core: Core A · Expansions: FH for A, Other for A',
    );
  });
});

describe('using and stopping packs', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'URL',
      Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} }),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it('nothing is in use by default', async () => {
    const store = await seeded();
    await restorePack(store);
    expect(getActiveTheme()).toBe(CLASSIC_THEME);
    expect(getExpansionThemes()).toEqual({});
  });

  it('an expansion pack is refused without its core pack in use, and nothing changes', async () => {
    const store = await seeded();
    const r = await applyPack(store, 'fh-a');
    expect(r).toEqual({ ok: false, message: 'Needs the pack Core A. Apply it first.' });
    expect(await store.getSelection()).toEqual({ core: null, expansions: [] });
    expect(getActiveTheme()).toBe(CLASSIC_THEME);
    // with another core pack in use it is refused too
    await applyPack(store, 'core-b');
    const r2 = await applyPack(store, 'fh-a');
    expect(r2.ok).toBe(false);
    expect(await store.getSelection()).toEqual({ core: 'core-b', expansions: [] });
  });

  it('an expansion pack of another family is refused even with the right core pack in use', async () => {
    const store = await seeded();
    await store.save(
      make({
        id: 'fh-wrong',
        name: 'FH wrong family',
        box: 'wrong-box',
        extends: 'core-a',
        family: 'fam-b',
      }),
    );
    await applyPack(store, 'core-a');
    const r = await applyPack(store, 'fh-wrong');
    expect(r).toEqual({
      ok: false,
      message: 'Made for the family fam-b, but Core A is of another family.',
    });
    expect(await store.getSelection()).toEqual({ core: 'core-a', expansions: [] });
    const list = await store.list();
    expect(
      normalizeSelection({ core: 'core-a', expansions: ['fh-wrong'] }, list).expansions,
    ).toEqual([]);
  });

  it('says to import a core pack that is not installed', async () => {
    const list = await new MemoryThemeStore().list();
    expect(needsMessage('core-ah-2021', list)).toBe(
      'Needs the pack core-ah-2021. Import it first.',
    );
  });

  it('a core pack and its expansion packs are used together, one pack per box', async () => {
    const store = await seeded();
    expect((await applyPack(store, 'core-a')).ok).toBe(true);
    expect((await applyPack(store, 'fh-a')).ok).toBe(true);
    expect((await applyPack(store, 'other-a')).ok).toBe(true);
    expect(await store.getSelection()).toEqual({ core: 'core-a', expansions: ['fh-a', 'other-a'] });
    // a second pack of the same box replaces the first
    expect((await applyPack(store, 'fh-a2')).ok).toBe(true);
    expect((await store.getSelection()).expansions).toEqual(['other-a', 'fh-a2']);
    await applyPack(store, 'fh-a');
    expect((await store.getSelection()).expansions).toEqual(['other-a', 'fh-a']);
  });

  it('the expansion theme is the core theme with the expansion pictures over it, for its box only', async () => {
    const store = await seeded();
    await applyPack(store, 'core-a');
    await applyPack(store, 'fh-a');
    await applyPack(store, 'other-a');
    const core = getActiveTheme();
    const boxes = getExpansionThemes();
    expect(core.floor).toBeDefined();
    expect(core.enemy).toBeUndefined();
    expect(boxes['frozen-horror']?.floor).toEqual(core.floor); // the core pictures are under it
    expect(boxes['frozen-horror']?.enemy?.yeti).toBeDefined();
    expect(boxes['frozen-horror']?.block).toBeUndefined(); // the other box's pictures are not here
    expect(boxes['other-box']?.block?.single).toBeDefined();
    // which theme a quest draws with
    expect(themeForBox(core, boxes, undefined)).toBe(core); // a core quest
    expect(themeForBox(core, boxes, 'frozen-horror')).toBe(boxes['frozen-horror']);
    expect(themeForBox(core, boxes, 'other-box')).toBe(boxes['other-box']);
    expect(themeForBox(core, boxes, 'a-third-box')).toBe(core);
  });

  it('using another core pack stops the expansion packs of the first family and says so', async () => {
    const store = await seeded();
    await applyPack(store, 'core-a');
    await applyPack(store, 'fh-a');
    await applyPack(store, 'other-a');
    const r = await applyPack(store, 'core-b');
    expect(r.ok).toBe(true);
    expect(r.message).toContain('FH for A');
    expect(r.message).toContain('Other for A');
    expect(await store.getSelection()).toEqual({ core: 'core-b', expansions: [] });
    expect(getExpansionThemes()).toEqual({});
  });

  it('using the same core pack again keeps its expansion packs', async () => {
    const store = await seeded();
    await applyPack(store, 'core-a');
    await applyPack(store, 'fh-a');
    const r = await applyPack(store, 'core-a');
    expect(r).toEqual({ ok: true });
    expect((await store.getSelection()).expansions).toEqual(['fh-a']);
  });

  it('stopping an expansion pack leaves the core pack; stopping the core pack stops them all', async () => {
    const store = await seeded();
    await applyPack(store, 'core-a');
    await applyPack(store, 'fh-a');
    await stopPack(store, 'fh-a');
    expect(await store.getSelection()).toEqual({ core: 'core-a', expansions: [] });
    await applyPack(store, 'fh-a');
    const r = await stopPack(store, 'core-a');
    expect(r.message).toContain('FH for A');
    expect(await store.getSelection()).toEqual({ core: null, expansions: [] });
    expect(getActiveTheme()).toBe(CLASSIC_THEME);
    expect(getExpansionThemes()).toEqual({});
  });

  it('deleting the core pack in use stops its expansion packs first', async () => {
    const store = await seeded();
    await applyPack(store, 'core-a');
    await applyPack(store, 'fh-a');
    await removePack(store, 'core-a');
    expect(await store.getSelection()).toEqual({ core: null, expansions: [] });
    expect((await store.list()).some((p) => p.id === 'core-a')).toBe(false);
  });

  it('a pack that cannot be loaded at start leaves the choice on the device', async () => {
    const store = await seeded();
    await applyPack(store, 'core-a');
    await applyPack(store, 'fh-a');
    const chosen = await store.getSelection();
    const broken = Object.create(store) as MemoryThemeStore;
    broken.load = async () => undefined; // offline: no picture can be read
    await restorePack(broken);
    expect(getActiveTheme()).toBe(CLASSIC_THEME); // the built-in look for this session
    expect(await store.getSelection()).toEqual(chosen); // the choice stays
    await restorePack(store);
    expect(getExpansionThemes()['frozen-horror']).toBeDefined();
  });

  it('an expansion pack that names no core pack says so, and cannot be used', async () => {
    const store = new MemoryThemeStore();
    await store.save({
      manifest: {
        format: 'sqtextures',
        version: 1,
        id: 'old-fh',
        name: 'Old FH',
        origin: 'fan',
        box: 'frozen-horror',
      },
      files: {},
    } as never);
    const r = await applyPack(store, 'old-fh');
    expect(r).toEqual({
      ok: false,
      message: 'This expansion pack names no core pack. Import it again.',
    });
  });

  it('at start an old single choice is read as the core pack; an old single expansion pack is cleared', async () => {
    const store = await seeded();
    await store.setSelection({ core: 'core-a', expansions: [] }); // what the old single id becomes
    await restorePack(store);
    expect(getActiveTheme().id).toBe('core-a');
    await store.setSelection({ core: 'fh-a', expansions: [] }); // an expansion pack with no core pack
    await restorePack(store);
    expect(getActiveTheme()).toBe(CLASSIC_THEME);
    expect(await store.getSelection()).toEqual({ core: null, expansions: [] });
  });
});

describe('the selection kept on the device', () => {
  const mem = new Map<string, string>();
  beforeEach(() => {
    mem.clear();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
      removeItem: (k: string) => void mem.delete(k),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('reads the old single pack id as the core pack, and writes the new key', async () => {
    mem.set('soloquest-active-texture-pack', 'core-a');
    const store = new DexieThemeStore('test-selection');
    expect(await store.getSelection()).toEqual({ core: 'core-a', expansions: [] });
    await store.setSelection({ core: 'core-a', expansions: ['fh-a'] });
    expect(mem.has('soloquest-active-texture-pack')).toBe(false);
    expect(await store.getSelection()).toEqual({ core: 'core-a', expansions: ['fh-a'] });
    await store.setSelection({ core: null, expansions: [] });
    expect(await store.getSelection()).toEqual({ core: null, expansions: [] });
  });
});
