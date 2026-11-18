import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { CORE_EXTRA } from '../../engine/data/coreFile';
import type { AbilityDefData, EnemyDef, SpellDefData } from '../../engine/quest/schema';
import type { LibraryItem, LibraryKind, LibraryStore } from '../../persist/library';
import { isShown, useHiddenExpansions } from './expansions';

export interface LibraryApi {
  /** Everything the quest editor can use: My library on top of Core (the library wins on the same id). */
  readonly abilities: readonly AbilityDefData[];
  readonly spells: readonly SpellDefData[];
  readonly enemies: readonly EnemyDef[];
  /** The part of the above that the add menus offer: without the expansions the person switched off. */
  readonly addable: {
    readonly abilities: readonly AbilityDefData[];
    readonly spells: readonly SpellDefData[];
    readonly enemies: readonly EnemyDef[];
  };
  /** Is an item of a kind (a core ability, say) shown in the add menus? */
  isShown(kind: LibraryKind, id: string, data?: { readonly expansion?: unknown }): boolean;
  /** Save an item to the library and reload. Resolves to an error message, or '' when saved. */
  save(kind: LibraryKind, data: unknown): Promise<string>;
}

const Ctx = createContext<LibraryApi | null>(null);

const of = <T,>(items: readonly LibraryItem[], kind: LibraryKind) =>
  items.filter((i) => i.kind === kind).map((i) => i.data as unknown as T);

/** Core first, then My library: an item of the library replaces the Core item with the same id. */
function stacked<T extends { id: string }>(core: readonly T[], mine: readonly T[]): T[] {
  const ids = new Set(mine.map((m) => m.id));
  return [...core.filter((c) => !ids.has(c.id)), ...mine];
}

/** The library items for the quest editor (decision 70). Loaded once, reloaded after a save. */
export function LibraryProvider({ store, children }: { store: LibraryStore; children: ReactNode }) {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const hidden = useHiddenExpansions();
  const reload = useCallback(async () => setItems(await store.list()), [store]);
  useEffect(() => {
    // The list comes from storage, so it is loaded after the first paint.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);
  const api = useMemo<LibraryApi>(() => {
    const abilities = of<AbilityDefData>(items, 'ability');
    const spells = of<SpellDefData>(items, 'spell');
    // Core enemies that Core files add (an expansion's monsters), under the person's own
    const enemies = stacked(
      CORE_EXTRA.enemy.map((c) => ({ ...c.data }) as unknown as EnemyDef),
      of<EnemyDef>(items, 'enemy'),
    );
    const shown = (kind: LibraryKind, id: string, data?: { readonly expansion?: unknown }) =>
      isShown(hidden, kind, id, data);
    return {
      abilities,
      spells,
      enemies,
      addable: {
        abilities: abilities.filter((a) => shown('ability', a.id, a)),
        spells: spells.filter((s) => shown('spell', s.id, s)),
        enemies: enemies.filter((e) => shown('enemy', e.id, e)),
      },
      isShown: shown,
      async save(kind, data) {
        try {
          await store.save(kind, data, Date.now());
          await reload();
          return '';
        } catch (e) {
          return (e as Error).message;
        }
      },
    };
  }, [items, store, reload, hidden]);
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

const EMPTY: LibraryApi = {
  abilities: [],
  spells: [],
  enemies: [],
  addable: { abilities: [], spells: [], enemies: [] },
  isShown: () => true,
  save: async () => 'The library is not available here.',
};

/** The library, or an empty one outside a provider (tests of single components). */
export function useLibrary(): LibraryApi {
  return useContext(Ctx) ?? EMPTY;
}
