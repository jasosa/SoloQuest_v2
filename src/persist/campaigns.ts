import { z } from 'zod';
import { HEROES } from '../engine/data/heroes';
import { CAMPAIGN_VERSION, type Campaign } from '../engine/pack/campaign';
import type { TeamInput } from '../engine/data/team';

/**
 * The campaign of each pack, kept on this device (decision 37). Small, so it lives in localStorage
 * like the quest settings. Any number per pack, each with an id and a name; an older campaign (one per pack) keeps the pack id as its id.
 */

const TeamEntry = z.union([
  z.enum(HEROES),
  z.object({
    id: z.string(),
    name: z.string(),
    kind: z.enum(['hero', 'mercenary', 'ally']),
    owner: z.string().optional(),
    as: z.enum(HEROES).optional(),
  }),
]);

export const CampaignSchema = z.object({
  version: z.literal(CAMPAIGN_VERSION),
  /** Missing in a campaign made before several campaigns per pack: the pack id is its id. */
  id: z.string().optional(),
  name: z.string().optional(),
  pack: z.string(),
  seed: z.number().int(),
  finished: z.array(z.string()),
  skipped: z.array(z.string()).default([]),
  journal: z
    .array(
      z.object({
        quest: z.string(),
        result: z.enum(['won', 'skipped']),
        at: z.number(),
      }),
    )
    .default([]),
  flags: z.record(z.string(), z.boolean()),
  team: z.array(TeamEntry),
  fallen: z.array(z.string()).default([]),
  settings: z.record(z.string(), z.boolean()),
});

/** Read one stored value; an older one (keyed by its pack) gets its id and an empty name. */
function parseCampaign(key: string, raw: unknown): Campaign | undefined {
  const r = CampaignSchema.safeParse(raw);
  if (!r.success) return undefined;
  return { ...r.data, id: r.data.id ?? key, name: r.data.name ?? '' } as {
    team: TeamInput[];
  } & Campaign;
}

export interface CampaignStore {
  /** A campaign by id, or undefined (none, or one that cannot be read). */
  get(id: string): Campaign | undefined;
  /** Every campaign on this device, in the order they were made. */
  list(): Campaign[];
  /** Saves under `campaign.id`. */
  set(campaign: Campaign): void;
  clear(id: string): void;
}

export class MemoryCampaignStore implements CampaignStore {
  private readonly all = new Map<string, Campaign>();
  get(id: string): Campaign | undefined {
    const c = this.all.get(id);
    return c ? structuredClone(c) : undefined;
  }
  list(): Campaign[] {
    return [...this.all.values()].map((c) => structuredClone(c));
  }
  set(campaign: Campaign): void {
    this.all.set(campaign.id, structuredClone(campaign));
  }
  clear(id: string): void {
    this.all.delete(id);
  }
}

const KEY = 'soloquest-campaigns';

export class LocalCampaignStore implements CampaignStore {
  private read(): Record<string, unknown> {
    try {
      const raw = localStorage.getItem(KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  private write(all: Record<string, unknown>): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(all));
    } catch {
      /* storage unavailable: the campaign lasts until the page closes */
    }
  }
  get(id: string): Campaign | undefined {
    return parseCampaign(id, this.read()[id]);
  }
  list(): Campaign[] {
    return Object.entries(this.read()).flatMap(([key, raw]) => {
      const c = parseCampaign(key, raw);
      return c ? [c] : [];
    });
  }
  set(campaign: Campaign): void {
    this.write({ ...this.read(), [campaign.id]: campaign });
  }
  clear(id: string): void {
    const { [id]: _gone, ...rest } = this.read();
    void _gone;
    this.write(rest);
  }
}
