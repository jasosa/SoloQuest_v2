import Dexie, { type EntityTable } from 'dexie';
import { z } from 'zod';
import { HEROES } from '../engine/data/heroes';
import {
  isMemberId,
  normalizeTeam,
  toStored,
  type TeamInput,
  type TeamMember,
} from '../engine/data/team';
import { MONSTER_TYPES } from '../engine/quest/schema';
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
const MemberIdSchema = z.string().refine(isMemberId, { message: 'not a team member id' });

/**
 * One entry of the team in a save. A plain core hero is a plain id, as before the free team list
 * (decision 38), so older saves still read; the other entries are small objects.
 */
const TeamMemberSchema = z.object({
  id: MemberIdSchema,
  name: z.string().trim().min(1).max(60),
  kind: z.enum(['hero', 'mercenary', 'ally']),
  owner: MemberIdSchema.optional(),
  as: z.enum(HEROES).optional(),
});

export const EventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('OPEN_DOOR'), door: z.string() }),
  z.object({ type: z.literal('LOOK_FROM'), cell: CellSchema }),
  z.object({ type: z.literal('SHOW_LAYOUT'), cell: CellSchema }),
  z.object({ type: z.literal('CROSS_MAP'), link: z.string() }),
  z.object({ type: z.literal('TUNNEL_USE'), tunnel: z.string(), from: z.enum(['a', 'b']) }),
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
  z.object({
    type: z.literal('MONSTER_LEAVE'),
    monster: z.string(),
    reason: z.enum(['escaped', 'freed']),
  }),
  z.object({ type: z.literal('MONSTER_WAKE'), monster: z.string() }),
  z.object({ type: z.literal('ZARGON_TURN_END') }),
  z.object({
    type: z.literal('SEARCH_TREASURE'),
    room: z.string(),
    hero: MemberIdSchema,
    override: z.boolean().optional(),
  }),
  // An old save may carry `adjacent`: z.object drops unknown keys, so it still parses.
  z.object({
    type: z.literal('WANDERING_MONSTER'),
    room: z.string(),
    hero: z.enum(HEROES),
    cell: CellSchema.optional(),
  }),
  z.object({
    type: z.literal('ADD_MONSTER'),
    monsterType: z.enum(MONSTER_TYPES),
    cell: CellSchema,
  }),
  z.object({
    // An old save may carry `hero`: unknown keys are dropped when parsing.
    type: z.literal('SEARCH_SECRET_DOORS'),
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
  z.object({ type: z.literal('ZONE_ENTER'), zone: z.string() }),
  z.object({ type: z.literal('SQUARE_TRIGGER'), cell: CellSchema }),
  z.object({ type: z.literal('MANUAL_TRIGGER'), note: z.string() }),
  z.object({ type: z.literal('CONFIRM_OBJECTIVE'), objective: z.string() }),
  z.object({ type: z.literal('CHOOSE'), note: z.string(), option: z.number().int().min(0) }),
  z.object({ type: z.literal('HERO_DIED'), hero: MemberIdSchema }),
  z.object({ type: z.literal('SPELL_CAST'), monster: z.string(), spell: z.string() }),
  z.object({ type: z.literal('SPELL_FAILED'), monster: z.string(), spell: z.string() }),
  z.object({ type: z.literal('MONSTER_DONE'), monster: z.string() }),
  // One object for all outcomes (a discriminated union needs one entry per type). The refine
  // keeps an ending id on 'ending' and nowhere else; the transform gives the GameEvent shape.
  z
    .object({
      type: z.literal('END_QUEST'),
      outcome: z.enum(['stairs', 'fell', 'ending']),
      ending: z.string().optional(),
    })
    .refine((e) => (e.outcome === 'ending') === (e.ending !== undefined))
    .transform((e) =>
      e.outcome === 'ending'
        ? { type: e.type, outcome: e.outcome, ending: e.ending! }
        : { type: e.type, outcome: e.outcome },
    ),
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
  /** The pack of the quest when it was saved (decision 36). Quest numbers overlap between packs, so the id and the pack go together. Missing: an older save, or a quest of this device. */
  pack: z.string().optional(),
  /** The flags the quest began with, when a campaign carried some in (decision 37). */
  startFlags: z.record(z.string(), z.boolean()).optional(),
  /** Played as part of the pack's campaign (decision 37). Missing: a one-shot. */
  campaign: z.boolean().optional(),
  /** Which campaign (several per pack). Missing with `campaign` set: the campaign that has the pack id. */
  campaignId: z.string().optional(),
  version: z.literal(SAVE_VERSION),
  seed: z.number().int(),
  /** The team at the table (decision 38): heroes, mercenaries and animal allies, all different. Not part of the engine state. */
  team: z
    .array(z.union([z.enum(HEROES), TeamMemberSchema]))
    .min(1)
    .max(16)
    .refine((t) => new Set(normalizeTeam(t as TeamInput[]).map((m) => m.id)).size === t.length, {
      message: 'team entries must be different',
    })
    .refine((t) => normalizeTeam(t as TeamInput[]).some((m) => m.kind === 'hero'), {
      message: 'the team needs a hero',
    }),
  events: z.array(EventSchema),
  /** Milliseconds since the epoch, given by the caller. */
  updatedAt: z.number(),
});
export type SavedGame = Omit<z.infer<typeof SavedGameSchema>, 'events' | 'team'> & {
  team: TeamInput[];
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
/** What a save keeps besides the log: the pack, the flags the quest began with, and whether it is a campaign game. */
export interface SaveExtra {
  readonly pack?: string | undefined;
  readonly startFlags?: Readonly<Record<string, boolean>> | undefined;
  readonly campaign?: boolean | undefined;
  readonly campaignId?: string | undefined;
}

export async function autosave(
  store: SaveStore,
  questId: string,
  seed: number,
  team: readonly TeamInput[],
  events: readonly GameEvent[],
  now: number,
  extra: SaveExtra = {},
): Promise<boolean> {
  const { pack, startFlags, campaign, campaignId } = extra;
  try {
    await store.save({
      questId,
      ...(pack === undefined ? {} : { pack }),
      ...(startFlags && Object.keys(startFlags).length > 0
        ? { startFlags: { ...startFlags } }
        : {}),
      ...(campaign || campaignId ? { campaign: true } : {}),
      ...(campaignId ? { campaignId } : {}),
      version: SAVE_VERSION,
      seed,
      team: normalizeTeam(team).map(toStored),
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
      pack?: string | undefined;
      startFlags?: Readonly<Record<string, boolean>> | undefined;
      campaign?: boolean | undefined;
      /** The campaign it belongs to (an older save of a campaign game: the pack id). */
      campaignId?: string | undefined;
      seed: number;
      team: readonly TeamMember[];
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
    const state = replay(level, parsed.data.seed, parsed.data.events, parsed.data.startFlags);
    return {
      ok: true,
      pack: parsed.data.pack,
      startFlags: parsed.data.startFlags,
      campaign: parsed.data.campaign,
      campaignId: parsed.data.campaignId ?? (parsed.data.campaign ? parsed.data.pack : undefined),
      seed: parsed.data.seed,
      team: normalizeTeam(parsed.data.team as TeamInput[]),
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

/** A saved game whose quest is not on this device any more. */
export interface OrphanSave {
  readonly questId: string;
  readonly pack: string | undefined;
  /** What to tell the player. */
  readonly message: string;
}

/**
 * The saved games that no quest on this device matches (for example a pack that is not installed).
 * `hasQuest` says whether a quest id exists here; `hasPack` whether a pack is installed. Nothing is
 * deleted: the player decides.
 */
export async function orphanSaves(
  store: SaveStore,
  hasQuest: (questId: string) => boolean,
  hasPack: (pack: string) => boolean,
): Promise<OrphanSave[]> {
  let all: SavedGame[];
  try {
    all = await store.list();
  } catch {
    return [];
  }
  return all
    .filter((g) => !hasQuest(g.questId))
    .map((g) => ({
      questId: g.questId,
      pack: g.pack,
      message:
        g.pack !== undefined && !hasPack(g.pack)
          ? `A saved game of the quest "${g.questId}" belongs to the pack "${g.pack}", which is not installed here. Install the pack to play it again, or delete the save.`
          : `A saved game of the quest "${g.questId}" has no quest on this device any more. Delete the save, or bring the quest back.`,
    }));
}
