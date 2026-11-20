import frozenHorrorManifest from '../../content/art/frozen-horror.theme.json';
import type { PackSummary, ThemeStore } from '../../persist/themes';
import {
  manifestFiles,
  PackManifestSchema,
  type PackFile,
  type PackManifest,
  type StoredPack,
} from './pack';

/**
 * Packs that ship with the app (decisions 78, 85 and 98). They are real texture packs: they appear in the
 * Textures dialog next to the packs of the player, with a name, the box they are for and a size, and
 * the player applies one explicitly like any other (nothing is applied by itself). Their pictures
 * stay in `public/` (once) and are read from there when the pack is used, previewed or exported.
 */

export interface IncludedPack {
  readonly manifest: PackManifest;
  /** Where the pictures are served from, under the app's base URL. */
  readonly folder: string;
  /** The size of the pictures in bytes (a test checks it against the files). */
  readonly bytes: number;
}

export const INCLUDED_PACKS: readonly IncludedPack[] = [
  {
    manifest: PackManifestSchema.parse(frozenHorrorManifest),
    folder: 'assets/frozen-horror/',
    bytes: 3063281,
  },
];

const mimeOf = (name: string) =>
  name.endsWith('.webp') ? 'image/webp' : /\.jpe?g$/.test(name) ? 'image/jpeg' : 'image/png';

export type Fetcher = (
  url: string,
) => Promise<{ ok: boolean; arrayBuffer(): Promise<ArrayBuffer> }>;

/** The pack with its pictures, fetched from the app. Undefined when a picture cannot be read. */
export async function fetchIncluded(
  inc: IncludedPack,
  fetcher: Fetcher,
  base: string,
): Promise<StoredPack | undefined> {
  const files: Record<string, PackFile> = {};
  try {
    for (const name of manifestFiles(inc.manifest)) {
      const r = await fetcher(`${base}${inc.folder}${name}`);
      if (!r.ok) return undefined;
      files[name] = { mime: mimeOf(name), bytes: new Uint8Array(await r.arrayBuffer()) };
    }
  } catch {
    return undefined;
  }
  return { manifest: inc.manifest, files };
}

/**
 * The store of the player's packs, plus the packs that ship with the app. A shipped pack is listed
 * (marked `included`) unless the player has a stored pack with the same id (an adjusted copy, which wins).
 */
export function withIncluded(
  store: ThemeStore,
  fetcher: Fetcher = (u) => fetch(u),
  base: string = import.meta.env.BASE_URL,
): ThemeStore {
  const cache = new Map<string, StoredPack>();
  return {
    async list() {
      const mine = await store.list();
      const shipped: PackSummary[] = INCLUDED_PACKS.filter(
        (i) => !mine.some((p) => p.id === i.manifest.id),
      ).map(({ manifest: m, bytes }) => ({
        id: m.id,
        name: m.name,
        origin: m.origin,
        ...(m.author ? { author: m.author } : {}),
        ...(m.box ? { box: m.box } : {}),
        ...(m.extends ? { extends: m.extends } : {}),
        bytes,
        included: true,
      }));
      return [...shipped, ...mine];
    },
    async load(id) {
      const stored = await store.load(id);
      if (stored) return stored;
      const hit = cache.get(id);
      if (hit) return hit;
      const inc = INCLUDED_PACKS.find((i) => i.manifest.id === id);
      const pack = inc && (await fetchIncluded(inc, fetcher, base));
      if (pack) cache.set(id, pack);
      return pack;
    },
    save: (pack) => store.save(pack),
    remove: (id) => store.remove(id),
    getActive: () => store.getActive(),
    setActive: (id) => store.setActive(id),
  };
}
