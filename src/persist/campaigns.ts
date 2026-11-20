import { z } from 'zod';
import { HEROES } from '../engine/data/heroes';
import { CAMPAIGN_VERSION, type Campaign } from '../engine/pack/campaign';
import type { TeamInput } from '../engine/data/team';

/**
 * The campaign of each pack, kept on this device (decision 37). Small, so it lives in localStorage
 * like the quest settings. One campaign per pack; starting over replaces it.
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
  pack: z.string(),
  seed: z.number().int(),
  finished: z.array(z.string()),
  flags: z.record(z.string(), z.boolean()),
  team: z.array(TeamEntry),
  fallen: z.array(z.string()).default([]),
  settings: z.record(z.string(), z.boolean()),
});

export interface CampaignStore {
  /** The campaign of a pack, or undefined (none, or one that cannot be read). */
  get(pack: string): Campaign | undefined;
  set(campaign: Campaign): void;
  clear(pack: string): void;
}

export class MemoryCampaignStore implements CampaignStore {
  private readonly all = new Map<string, Campaign>();
  get(pack: string): Campaign | undefined {
    const c = this.all.get(pack);
    return c ? structuredClone(c) : undefined;
  }
  set(campaign: Campaign): void {
    this.all.set(campaign.pack, structuredClone(campaign));
  }
  clear(pack: string): void {
    this.all.delete(pack);
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
  get(pack: string): Campaign | undefined {
    const r = CampaignSchema.safeParse(this.read()[pack]);
    return r.success ? (r.data as { team: TeamInput[] } & Campaign) : undefined;
  }
  set(campaign: Campaign): void {
    this.write({ ...this.read(), [campaign.pack]: campaign });
  }
  clear(pack: string): void {
    const { [pack]: _gone, ...rest } = this.read();
    void _gone;
    this.write(rest);
  }
}
