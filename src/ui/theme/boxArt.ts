import frozenHorrorManifest from '../../content/art/frozen-horror.theme.json';
import type { Quest } from '../../engine/quest/schema';
import { PackManifestSchema, themeFromPack, type PackManifest } from './pack';
import { mergeThemes, type Theme } from './theme';

/**
 * The art layer of a quest pack that ships with the app (decisions 78, 85 and 95). Frozen Horror has one: a
 * texture pack (`src/content/art/frozen-horror.theme.json`, pictures in `public/assets/frozen-horror/`)
 * that builds on the core look. It is used while a quest of that box is open, unless the player turned
 * it off, and a pack the player chose for that box is drawn on top of it.
 */

export const FROZEN_HORROR = 'frozen-horror';

/** Where the pictures of a box are served from (the files stay in `public/`, once). */
export const ART_FOLDER: Readonly<Record<string, string>> = {
  [FROZEN_HORROR]: 'assets/frozen-horror/',
};

/** The manifest of the built-in layer of each box. The same file goes into the `.sqtextures` the build script writes. */
export const ART_MANIFESTS: Readonly<Record<string, PackManifest>> = {
  [FROZEN_HORROR]: PackManifestSchema.parse(frozenHorrorManifest),
};

const layers = new Map<string, Theme>();

/** The built-in art layer of a box, or undefined when the box has none. */
export function boxArtTheme(box: string | undefined): Theme | undefined {
  if (!box) return undefined;
  const hit = layers.get(box);
  if (hit) return hit;
  const manifest = ART_MANIFESTS[box];
  const folder = ART_FOLDER[box];
  if (!manifest || folder === undefined) return undefined;
  const theme = themeFromPack(
    { manifest, files: {} },
    (file) => `${import.meta.env.BASE_URL}${folder}${file}`,
  );
  layers.set(box, theme);
  return theme;
}

/**
 * The box a quest dresses. `pack` says so; a quest made in the editor that has no pack but uses Frozen
 * Horror tiles, tunnels or doors is a Frozen Horror quest too.
 */
export function boxOfQuest(
  quest: Pick<Quest, 'pack' | 'roomTiles' | 'boardTiles' | 'tunnels' | 'edgeDoors'>,
): string | undefined {
  if (quest.pack) return quest.pack;
  const uses =
    quest.roomTiles.length +
      quest.boardTiles.length +
      quest.tunnels.length +
      quest.edgeDoors.length >
    0;
  return uses ? FROZEN_HORROR : undefined;
}

// ---- the player's setting, and the box of the quest that is open

const KEY = 'soloquest-box-art-off';
const listeners = new Set<() => void>();
let version = 0;
let questBox: string | undefined;

function readOff(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}
let off = new Set(readOff());

const changed = () => {
  version += 1;
  listeners.forEach((l) => l());
};

/** Is the built-in art of this box used? On unless the player turned it off. */
export function isBoxArtOn(box: string): boolean {
  return !off.has(box);
}

export function setBoxArtOn(box: string, on: boolean): void {
  if (on) off.delete(box);
  else off.add(box);
  try {
    if (off.size) localStorage.setItem(KEY, JSON.stringify([...off]));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable: the choice lasts until the page closes */
  }
  changed();
}

/** The screen that shows a quest says which box it is (undefined: none, so no layer is added). */
export function setQuestBox(box: string | undefined): void {
  if (box === questBox) return;
  questBox = box;
  changed();
}

export const getQuestBox = (): string | undefined => questBox;
export const getBoxArtVersion = (): number => version;
export function subscribeBoxArt(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** For tests: forget the setting and the open quest. */
export function resetBoxArt(): void {
  off = new Set();
  questBox = undefined;
  changed();
}

/**
 * The theme a board draws with: the theme the player chose, with the art layer of the quest's box (if
 * it has one and it is on). A pack the player chose for that box wins over the layer; a core pack is
 * under it. The same inputs give the same object, so the boards do not redraw for nothing.
 */
let last: { app: Theme; box: string; out: Theme } | undefined;
export function layeredTheme(app: Theme, box: string | undefined = questBox): Theme {
  const layer = box && isBoxArtOn(box) ? boxArtTheme(box) : undefined;
  if (!box || !layer) return app;
  if (last && last.app === app && last.box === box) return last.out;
  const merged = app.box === box ? mergeThemes(layer, app) : mergeThemes(app, layer);
  const out: Theme = { ...merged, id: app.id, name: app.name };
  last = { app, box, out };
  return out;
}
