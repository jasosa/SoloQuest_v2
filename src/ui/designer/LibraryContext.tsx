import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { AbilityDefData, EnemyDef, SpellDefData } from '../../engine/quest/schema';
import type { LibraryItem, LibraryKind, LibraryStore } from '../../persist/library';

export interface LibraryApi {
  readonly abilities: readonly AbilityDefData[];
  readonly spells: readonly SpellDefData[];
  readonly enemies: readonly EnemyDef[];
  /** Save an item to the library and reload. Resolves to an error message, or '' when saved. */
  save(kind: LibraryKind, data: unknown): Promise<string>;
}

const Ctx = createContext<LibraryApi | null>(null);

const of = <T,>(items: readonly LibraryItem[], kind: LibraryKind) =>
  items.filter((i) => i.kind === kind).map((i) => i.data as unknown as T);

/** The library items for the quest editor (decision 70). Loaded once, reloaded after a save. */
export function LibraryProvider({ store, children }: { store: LibraryStore; children: ReactNode }) {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const reload = useCallback(async () => setItems(await store.list()), [store]);
  useEffect(() => {
    // The list comes from storage, so it is loaded after the first paint.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);
  const api = useMemo<LibraryApi>(
    () => ({
      abilities: of<AbilityDefData>(items, 'ability'),
      spells: of<SpellDefData>(items, 'spell'),
      enemies: of<EnemyDef>(items, 'enemy'),
      async save(kind, data) {
        try {
          await store.save(kind, data, Date.now());
          await reload();
          return '';
        } catch (e) {
          return (e as Error).message;
        }
      },
    }),
    [items, store, reload],
  );
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

const EMPTY: LibraryApi = {
  abilities: [],
  spells: [],
  enemies: [],
  save: async () => 'The library is not available here.',
};

/** The library, or an empty one outside a provider (tests of single components). */
export function useLibrary(): LibraryApi {
  return useContext(Ctx) ?? EMPTY;
}
