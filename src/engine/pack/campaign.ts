/**
 * Campaign and one-shot play (decision 37). A one-shot plays a quest alone: carried flags take their
 * `oneShot` value. A campaign keeps, per pack on this device: the finished quests, the flags that
 * quests hand on, the team, the campaign settings and the campaign seed. Nothing else: no stats, no
 * items. Pure: the caller stores it and gives the seed.
 */
import type { GameState } from '../game/state';
import { objectivesStatus } from '../game/noteView';
import type { Level } from '../board/level';
import type { TeamInput } from '../data/team';
import type { PackManifest } from './schema';
import type { Quest } from '../quest/schema';

export const CAMPAIGN_VERSION = 1;

/** One line of the campaign journal: a quest finished or skipped, and when (decision 101). */
export interface JournalEntry {
  readonly quest: string;
  readonly result: 'won' | 'skipped';
  /** Milliseconds since 1970, given by the caller. */
  readonly at: number;
}

export interface Campaign {
  readonly version: typeof CAMPAIGN_VERSION;
  /** Unique on the device. The first campaign of a pack has the pack id, the next `<pack>-2`, and so on. */
  readonly id: string;
  /** What the player sees in the list of saved campaigns ("Campaign 2"). Empty in a campaign made before names. */
  readonly name: string;
  readonly pack: string;
  /** Drawn when the campaign starts. Campaign draws (such as the Raiment artifacts) come from it. */
  readonly seed: number;
  /** Quest ids, in the order they were finished. */
  readonly finished: readonly string[];
  /** Quest ids the players chose to skip. A skipped quest can still be played later. */
  readonly skipped: readonly string[];
  /** What happened, oldest first. */
  readonly journal: readonly JournalEntry[];
  /** Flags handed on by finished quests. */
  readonly flags: Readonly<Record<string, boolean>>;
  /** The team of the last quest started. */
  readonly team: readonly TeamInput[];
  /** Ids of the team entries that fell in the last finished quest (the players decide who plays on). */
  readonly fallen: readonly string[];
  /** Campaign settings by id (the pack manifest lists them). */
  readonly settings: Readonly<Record<string, boolean>>;
}

/** The id and the number of the next campaign of a pack, given the ids that are taken. */
export function nextCampaignSlot(
  pack: string,
  taken: readonly string[],
): { id: string; number: number } {
  for (let number = 1; ; number++) {
    const id = number === 1 ? pack : `${pack}-${number}`;
    if (!taken.includes(id)) return { id, number };
  }
}

export function newCampaign(
  pack: PackManifest,
  seed: number,
  own: { id?: string; name?: string } = {},
): Campaign {
  return {
    version: CAMPAIGN_VERSION,
    id: own.id ?? pack.id,
    name: own.name ?? pack.name,
    pack: pack.id,
    seed: seed >>> 0,
    finished: [],
    skipped: [],
    journal: [],
    flags: {},
    team: [],
    fallen: [],
    settings: Object.fromEntries(pack.campaignSettings.map((s) => [s.id, s.default])),
  };
}

/** The flags a quest begins with: from the campaign, or the one-shot values when there is none. */
export function startFlagsFor(
  quest: Pick<Quest, 'flagsIn'>,
  campaign: Campaign | undefined,
): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const f of quest.flagsIn ?? [])
    out[f.flag] = campaign ? (campaign.flags[f.flag] ?? false) : f.oneShot;
  return out;
}

/**
 * A quest counts as finished when it ended with its goal done, or by one of its own endings. Leaving
 * with the goal undone, or all heroes falling, does not finish it.
 */
export function questFinished(level: Level, state: GameState): boolean {
  const e = state.ended;
  if (!e) return false;
  if (e.outcome === 'ending') return true;
  return e.outcome === 'stairs' && objectivesStatus(level, state).goalDone;
}

/** The campaign after a quest was finished: it is listed once, its `flagsOut` are kept, the fallen are noted. */
export function finishQuest(
  c: Campaign,
  quest: Pick<Quest, 'id' | 'flagsOut'>,
  state: Pick<GameState, 'flags' | 'deadHeroes'>,
  at = 0,
): Campaign {
  const flags = { ...c.flags };
  for (const f of quest.flagsOut ?? []) flags[f] = state.flags[f] === true;
  return {
    ...c,
    finished: c.finished.includes(quest.id) ? c.finished : [...c.finished, quest.id],
    skipped: c.skipped.filter((q) => q !== quest.id),
    journal: c.finished.includes(quest.id)
      ? c.journal
      : [...c.journal, { quest: quest.id, result: 'won', at }],
    flags,
    fallen: [...state.deadHeroes],
  };
}

/** The campaign after the players skipped a quest. A finished quest cannot be skipped. */
export function skipQuest(c: Campaign, questId: string, at: number): Campaign {
  if (c.finished.includes(questId) || c.skipped.includes(questId)) return c;
  return {
    ...c,
    skipped: [...c.skipped, questId],
    journal: [...c.journal, { quest: questId, result: 'skipped', at }],
  };
}

/** The first quest of the pack's campaign order that is neither finished nor skipped, or undefined. */
export function nextQuest(
  pack: Pick<PackManifest, 'quests'>,
  c: Campaign | undefined,
): string | undefined {
  return pack.quests.find(
    (q) => !(c?.finished ?? []).includes(q) && !(c?.skipped ?? []).includes(q),
  );
}

/** The id of the Frozen Horror campaign setting that adds the artifact warnings to cards (decision 61). */
export const RAIMENT_SETTING = 'raiment-of-the-frozen-champion';

/** Is a campaign setting on? A campaign's own value, else the default of the pack manifest (no campaign: its default). */
export function settingOn(
  pack: Pick<PackManifest, 'campaignSettings'>,
  campaign: Pick<Campaign, 'settings'> | undefined,
  id: string,
): boolean {
  const own = campaign?.settings[id];
  if (own !== undefined) return own;
  return pack.campaignSettings.find((s) => s.id === id)?.default ?? false;
}
