import {
  NO_SELECTION,
  type ActiveSelection,
  type PackSummary,
  type ThemeStore,
} from '../../persist/themes';
import { setActiveTheme } from './activeTheme';
import { themeFromPack, type StoredPack } from './pack';
import { CLASSIC_THEME, mergeThemes, type Theme } from './theme';

/**
 * Using texture packs (decision 99). A core pack (no `box`) dresses every quest. An expansion pack (a
 * `box` and the `extends` core pack it is made for) dresses only the quests of its box, and can only be
 * used while its core pack is the core pack in use. One expansion pack per box. Nothing is used by itself.
 */

/** Object URLs of the packs in use. They are freed when the packs in use change. */
let urls: string[] = [];

function freeUrls(list: string[]): void {
  for (const u of list) URL.revokeObjectURL(u);
}

/** The theme of one pack, alone. Object URLs made on the way go into `into`. */
function themeOf(pack: StoredPack, into: string[]): Theme {
  return themeFromPack(pack, (file) => {
    const f = pack.files[file];
    if (!f) return '';
    const url = URL.createObjectURL(new Blob([f.bytes as BlobPart], { type: f.mime }));
    into.push(url);
    return url;
  });
}

export interface Change {
  /** Done, or refused (nothing changed). */
  readonly ok: boolean;
  /** A sentence for the player: why it was refused, or what else changed. */
  readonly message?: string;
}

const nameOf = (list: readonly PackSummary[], id: string) =>
  list.find((p) => p.id === id)?.name ?? id;

/** Is the expansion pack made for this core pack: the pack it names, in the family it names? */
export function fits(expansion: PackSummary, core: PackSummary): boolean {
  return (
    expansion.extends === core.id &&
    expansion.family !== undefined &&
    expansion.family === core.family
  );
}

/**
 * Why an expansion pack cannot be used now (a sentence), or null when it can: its core pack, of its
 * family, must be installed and be the core pack in use. Pure.
 */
export function expansionProblem(
  pack: PackSummary,
  coreInUse: string | null,
  list: readonly PackSummary[],
): string | null {
  const core = pack.extends ?? '';
  const named = list.find((p) => p.id === core);
  if (named && coreInUse === core && !fits(pack, named))
    return `Made for the family ${pack.family ?? '?'}, but ${named.name} is of another family.`;
  return coreInUse === core ? null : needsMessage(core, list);
}

/**
 * What a selection becomes when the packs it names are checked against the ones installed: a core
 * pack that is an expansion pack, a missing pack, an expansion pack whose core pack is not the core
 * pack in use, and a second expansion pack of one box are dropped. Pure.
 */
export function normalizeSelection(
  sel: ActiveSelection,
  list: readonly PackSummary[],
): ActiveSelection {
  const core = sel.core ? list.find((p) => p.id === sel.core && !p.box) : undefined;
  if (!core) return { ...NO_SELECTION };
  const byBox = new Map<string, string>();
  for (const id of sel.expansions) {
    const p = list.find((x) => x.id === id);
    if (p?.box && fits(p, core)) byBox.set(p.box, p.id);
  }
  return { core: core.id, expansions: [...byBox.values()] };
}

/** The sentence that says what an expansion pack needs. */
export function needsMessage(core: string, list: readonly PackSummary[]): string {
  return list.some((p) => p.id === core)
    ? `Needs the pack ${nameOf(list, core)}. Apply it first.`
    : `Needs the pack ${core}. Import it first.`;
}

/** Build the themes of a selection and show them. False when a pack cannot be loaded (nothing changes). */
async function show(store: ThemeStore, sel: ActiveSelection): Promise<boolean> {
  if (!sel.core) {
    freeUrls(urls);
    urls = [];
    setActiveTheme(CLASSIC_THEME);
    return true;
  }
  const next: string[] = [];
  const core = await store.load(sel.core);
  if (!core) return false;
  const coreTheme = themeOf(core, next);
  const expansions: Record<string, Theme> = {};
  for (const id of sel.expansions) {
    const pack = await store.load(id);
    if (!pack?.manifest.box) {
      freeUrls(next);
      return false;
    }
    expansions[pack.manifest.box] = mergeThemes(coreTheme, themeOf(pack, next));
  }
  const old = urls;
  urls = next;
  setActiveTheme(coreTheme, expansions);
  freeUrls(old);
  return true;
}

async function commit(store: ThemeStore, sel: ActiveSelection): Promise<boolean> {
  if (!(await show(store, sel))) return false;
  await store.setSelection(sel);
  return true;
}

const LOAD_FAILED = 'This texture pack could not be loaded. Check your connection and try again.';

/** Use a pack. A core pack replaces the one in use; an expansion pack needs its core pack in use. */
export async function applyPack(store: ThemeStore, id: string): Promise<Change> {
  const list = await store.list();
  const pack = list.find((p) => p.id === id);
  if (!pack) return { ok: false, message: LOAD_FAILED };
  const sel = normalizeSelection(await store.getSelection(), list);
  if (pack.box) {
    const core = pack.extends ?? '';
    const problem = expansionProblem(pack, sel.core, list);
    if (problem) return { ok: false, message: problem };
    const expansions = [
      ...sel.expansions.filter((x) => list.find((p) => p.id === x)?.box !== pack.box),
      id,
    ];
    return (await commit(store, { core, expansions }))
      ? { ok: true }
      : { ok: false, message: LOAD_FAILED };
  }
  // a core pack: the expansion packs made for it stay, those made for another core pack stop
  const mine = list.find((p) => p.id === id);
  const kept = sel.expansions.filter((x) => {
    const e = list.find((p) => p.id === x);
    return e && mine && fits(e, mine);
  });
  const dropped = sel.expansions.filter((x) => !kept.includes(x));
  if (!(await commit(store, { core: id, expansions: kept })))
    return { ok: false, message: LOAD_FAILED };
  return dropped.length
    ? {
        ok: true,
        message: `Stopped using ${dropped.map((x) => nameOf(list, x)).join(', ')}: made for another core pack.`,
      }
    : { ok: true };
}

/** Stop using a pack. Stopping the core pack stops its expansion packs too. */
export async function stopPack(store: ThemeStore, id: string): Promise<Change> {
  const list = await store.list();
  const sel = await store.getSelection();
  if (sel.core === id) {
    const others = normalizeSelection(sel, list).expansions;
    await commit(store, { ...NO_SELECTION });
    return others.length
      ? {
          ok: true,
          message: `Stopped using ${nameOf(list, id)} and its expansion packs: ${others.map((x) => nameOf(list, x)).join(', ')}.`,
        }
      : { ok: true };
  }
  const rest = { ...sel, expansions: sel.expansions.filter((x) => x !== id) };
  await commit(store, normalizeSelection(rest, list));
  return { ok: true };
}

/** Delete a pack from the device; if it was in use it stops first (with its expansion packs). */
export async function removePack(store: ThemeStore, id: string): Promise<Change> {
  const sel = await store.getSelection();
  const result =
    sel.core === id || sel.expansions.includes(id) ? await stopPack(store, id) : { ok: true };
  await store.remove(id);
  return result;
}

/** Show the packs in use again (after a pack in use was replaced or adjusted). */
export async function refreshTheme(store: ThemeStore): Promise<boolean> {
  return show(store, normalizeSelection(await store.getSelection(), await store.list()));
}

/**
 * At start: use the packs chosen last time that are still valid. An old single choice is read as the
 * core pack, and an old single expansion pack, which has no core pack in use, is cleared.
 */
export async function restorePack(store: ThemeStore): Promise<void> {
  const list = await store.list();
  const saved = await store.getSelection();
  const sel = normalizeSelection(saved, list);
  const ok = await show(store, sel);
  const final = ok ? sel : { ...NO_SELECTION };
  if (!ok) await show(store, final);
  if (JSON.stringify(final) !== JSON.stringify(saved)) await store.setSelection(final);
}

/** The line that says what is in use: "Core: X · Expansions: Y, Z", or null for the built-in look. */
export function selectionLine(sel: ActiveSelection, list: readonly PackSummary[]): string | null {
  if (!sel.core) return null;
  const parts = [`Core: ${nameOf(list, sel.core)}`];
  if (sel.expansions.length)
    parts.push(`Expansions: ${sel.expansions.map((x) => nameOf(list, x)).join(', ')}`);
  return parts.join(' · ');
}
