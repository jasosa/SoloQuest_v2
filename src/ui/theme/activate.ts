import type { ThemeStore } from '../../persist/themes';
import { setActiveTheme } from './activeTheme';
import { themeFromPack, type StoredPack } from './pack';
import { CLASSIC_THEME, mergeThemes, type Theme } from './theme';

/** Object URLs of the pack in use. They are freed when another pack (or none) is chosen. */
let urls: string[] = [];

function freeUrls(): void {
  for (const u of urls) URL.revokeObjectURL(u);
  urls = [];
}

/** The chain of packs a pack builds on is at most this long (a loop of `extends` stops here). */
const MAX_CHAIN = 4;

/**
 * The theme of a pack, on top of the theme of the pack it extends (and so on). Undefined when a pack of
 * the chain is not installed. Object URLs made on the way go into `urls`.
 */
export async function buildTheme(
  store: ThemeStore,
  pack: StoredPack,
  urls: string[],
  depth = 0,
): Promise<Theme | undefined> {
  const own = themeFromPack(pack, (file) => {
    const f = pack.files[file];
    if (!f) return '';
    const url = URL.createObjectURL(new Blob([f.bytes as BlobPart], { type: f.mime }));
    urls.push(url);
    return url;
  });
  const parentId = pack.manifest.extends;
  if (!parentId) return own;
  if (depth >= MAX_CHAIN) return undefined;
  const parent = await store.load(parentId);
  if (!parent) return undefined;
  const base = await buildTheme(store, parent, urls, depth + 1);
  return base ? mergeThemes(base, own) : undefined;
}

/**
 * Use the pack with this id (or the built-in look for null) and remember the choice.
 * Returns false when the pack cannot be found, and the built-in look is used.
 */
export async function applyPack(store: ThemeStore, id: string | null): Promise<boolean> {
  const pack = id ? await store.load(id) : undefined;
  if (!pack) {
    freeUrls();
    setActiveTheme(CLASSIC_THEME);
    await store.setActive(null);
    return id === null;
  }
  const next: string[] = [];
  const built = await buildTheme(store, pack, next);
  if (!built) {
    // a pack that builds on a pack that is gone cannot be used: the built-in look stays
    for (const u of next) URL.revokeObjectURL(u);
    return false;
  }
  const theme = built;
  const old = urls;
  urls = next;
  setActiveTheme(theme);
  for (const u of old) URL.revokeObjectURL(u);
  await store.setActive(id);
  return true;
}

/** At start: use the pack chosen last time, if it is still there. */
export async function restorePack(store: ThemeStore): Promise<void> {
  const id = await store.getActive();
  if (id) await applyPack(store, id);
}
