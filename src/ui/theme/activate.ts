import type { ThemeStore } from '../../persist/themes';
import { setActiveTheme } from './activeTheme';
import { themeFromPack } from './pack';
import { CLASSIC_THEME } from './theme';

/** Object URLs of the pack in use. They are freed when another pack (or none) is chosen. */
let urls: string[] = [];

function freeUrls(): void {
  for (const u of urls) URL.revokeObjectURL(u);
  urls = [];
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
  const theme = themeFromPack(pack, (file) => {
    const f = pack.files[file];
    if (!f) return '';
    const url = URL.createObjectURL(new Blob([f.bytes as BlobPart], { type: f.mime }));
    next.push(url);
    return url;
  });
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
