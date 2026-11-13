import Dexie, { type EntityTable } from 'dexie';
import { z } from 'zod';
import { HEROES, type Hero } from '../engine/data/heroes';
import type { Level } from '../engine/board/level';
import type { GameEvent } from '../engine/game/events';
import { replay } from '../engine/game/reducer';
import type { GameState } from '../engine/game/state';

/**
 * Autosave: the event log is the save file (state = replay(level, seed, events)).
 * One save per quest. This lives outside `src/engine/` because it touches IndexedDB and the clock.
 */

export const SAVE_VERSION = 1;

const CellSchema = z.tuple([z.number().int(), z.number().int()]);
export const EventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('OPEN_DOOR'), door: z.string() }),
  z.object({ type: z.literal('LOOK_FROM'), cell: CellSchema }),
  z.object({
    type: z.literal('MONSTER_DAMAGE'),
    monster: z.string(),
    amount: z.number().int().min(1),
  }),
  z.object({
    type: z.literal('MONSTER_HEAL'),
    monster: z.string(),
    amount: z.number().int().min(1),
  }),
  z.object({ type: z.literal('MONSTER_KILL'), monster: z.string() }),
  z.object({ type: z.literal('ZARGON_TURN_END') }),
  z.object({
    type: z.literal('SEARCH_TREASURE'),
    room: z.string(),
    hero: z.enum(HEROES),
    override: z.boolean().optional(),
  }),
  z.object({ type: z.literal('WANDERING_MONSTER'), room: z.string(), hero: z.enum(HEROES) }),
  z.object({
    type: z.literal('SEARCH_SECRET_DOORS'),
    hero: z.enum(HEROES),
    area: z.string().optional(),
    cell: CellSchema.optional(),
    override: z.boolean().optional(),
  }),
  z.object({
    type: z.literal('SEARCH_TRAPS'),
    furniture: z.string(),
    override: z.boolean().optional(),
  }),
  z.object({ type: z.literal('TRAP_JUMP'), trap: z.string(), result: z.enum(['skull', 'ok']) }),
  z.object({
    type: z.literal('TRAP_DISARM'),
    trap: z.string(),
    by: z.enum(['dwarf', 'toolkit']),
    result: z.enum(['skull', 'blackShield', 'other']),
  }),
  z.object({ type: z.literal('TRAP_STEP'), trap: z.string() }),
  z.object({ type: z.literal('AREA_ENTER'), area: z.string() }),
  z.object({ type: z.literal('SQUARE_TRIGGER'), cell: CellSchema }),
  z.object({ type: z.literal('MANUAL_TRIGGER'), note: z.string() }),
  z.object({ type: z.literal('CHOOSE'), note: z.string(), option: z.number().int().min(0) }),
  z.object({ type: z.literal('END_QUEST'), outcome: z.enum(['stairs', 'fell']) }),
]);

// Compile-time guard: every GameEvent type needs an entry in EventSchema, or a save that holds
// the new event would read back as corrupt. This line fails to compile when one is missing.
const _eventSchemaCoversAllEvents: [
  Exclude<GameEvent['type'], z.infer<typeof EventSchema>['type']>,
] extends [never]
  ? true
  : never = true;
void _eventSchemaCoversAllEvents;

export const SavedGameSchema = z.object({
  questId: z.string(),
  version: z.literal(SAVE_VERSION),
  seed: z.number().int(),
  /** The heroes at the table: 1 to 4, all different. Not part of the engine state. */
  team: z
    .array(z.enum(HEROES))
    .min(1)
    .max(4)
    .refine((t) => new Set(t).size === t.length, { message: 'heroes must be different' }),
  events: z.array(EventSchema),
  /** Milliseconds since the epoch, given by the caller. */
  updatedAt: z.number(),
});
export type SavedGame = Omit<z.infer<typeof SavedGameSchema>, 'events' | 'team'> & {
  team: Hero[];
  events: GameEvent[];
};

export interface SaveStore {
  save(game: SavedGame): Promise<void>;
  load(questId: string): Promise<SavedGame | undefined>;
  list(): Promise<SavedGame[]>;
  remove(questId: string): Promise<void>;
}

export class MemorySaveStore implements SaveStore {
  private readonly games = new Map<string, SavedGame>();
  async save(game: SavedGame): Promise<void> {
    this.games.set(game.questId, structuredClone(game));
  }
  async load(questId: string): Promise<SavedGame | undefined> {
    return structuredClone(this.games.get(questId));
  }
  async list(): Promise<SavedGame[]> {
    return [...this.games.values()].map((g) => structuredClone(g));
  }
  async remove(questId: string): Promise<void> {
    this.games.delete(questId);
  }
}

class SoloQuestDb extends Dexie {
  saves!: EntityTable<SavedGame, 'questId'>;
  constructor(name: string) {
    super(name);
    this.version(1).stores({ saves: 'questId, updatedAt' });
  }
}

export class DexieSaveStore implements SaveStore {
  private readonly db: SoloQuestDb;
  constructor(name = 'soloquest') {
    this.db = new SoloQuestDb(name);
  }
  async save(game: SavedGame): Promise<void> {
    await this.db.saves.put(game);
  }
  async load(questId: string): Promise<SavedGame | undefined> {
    return this.db.saves.get(questId);
  }
  async list(): Promise<SavedGame[]> {
    return this.db.saves.orderBy('updatedAt').reverse().toArray();
  }
  async remove(questId: string): Promise<void> {
    await this.db.saves.delete(questId);
  }
  close(): void {
    this.db.close();
  }
}

/**
 * Write the whole log after every event (a log is a few hundred small events at most).
 * Returns false when the store is unavailable: play goes on, the game is just not saved.
 */
export async function autosave(
  store: SaveStore,
  questId: string,
  seed: number,
  team: readonly Hero[],
  events: readonly GameEvent[],
  now: number,
): Promise<boolean> {
  try {
    await store.save({
      questId,
      version: SAVE_VERSION,
      seed,
      team: [...team],
      events: [...events],
      updatedAt: now,
    });
    return true;
  } catch {
    return false;
  }
}

export type Resumed =
  | {
      ok: true;
      seed: number;
      team: readonly Hero[];
      events: readonly GameEvent[];
      state: GameState;
    }
  | { ok: false; reason: 'none' | 'corrupt' | 'invalid' | 'unavailable'; message: string };

/**
 * Load the save of a quest and replay it. `corrupt`: the stored data does not match the save
 * format. `invalid`: the log does not replay on this quest (for example the quest file changed).
 */
export async function resume(store: SaveStore, level: Level): Promise<Resumed> {
  let raw: SavedGame | undefined;
  try {
    raw = await store.load(level.quest.id);
  } catch {
    return {
      ok: false,
      reason: 'unavailable',
      message: 'Saved games cannot be read on this device.',
    };
  }
  if (!raw) return { ok: false, reason: 'none', message: 'No saved game for this quest.' };
  const parsed = SavedGameSchema.safeParse(raw);
  if (!parsed.success)
    return { ok: false, reason: 'corrupt', message: 'The saved game could not be read.' };
  try {
    const state = replay(level, parsed.data.seed, parsed.data.events);
    return {
      ok: true,
      seed: parsed.data.seed,
      team: parsed.data.team,
      events: parsed.data.events,
      state,
    };
  } catch (e) {
    return {
      ok: false,
      reason: 'invalid',
      message: `The saved game does not match this quest: ${(e as Error).message}`,
    };
  }
}
