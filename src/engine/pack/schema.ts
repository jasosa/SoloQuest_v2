import { z } from 'zod';
import { HEROES } from '../data/heroes';

/**
 * The manifest of a quest pack (decision 36): `core` is the base game, and every expansion is a pack that
 * depends on it. The manifest says which quests belong to the pack, in campaign order, and which campaign
 * settings it offers. Monsters, spells and the like are Core library items tagged with the pack's name
 * (`expansion`, decision 76), so they are not repeated here. Text is paraphrased (no book text).
 */
export const PACK_SCHEMA_VERSION = 1;

const slug = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'use lowercase letters, digits and dashes');
const nonEmpty = z.string().trim().min(1);

export const CampaignSettingSchema = z.strictObject({
  id: slug,
  name: nonEmpty,
  /** What the setting does, in the owner's words. */
  text: nonEmpty,
  /** On or off when a campaign starts (decision 61: off by default). */
  default: z.boolean().default(false),
});

/** A choice the New game popup offers for the pack (decision 38). */
const TeamPresetSchema = z.strictObject({ id: slug, name: nonEmpty });

export const PackTeamSchema = z.strictObject({
  /** Heroes of the pack (the alternate Barbarian) and the core hero each one plays as. */
  heroes: z.array(TeamPresetSchema.extend({ as: z.enum(HEROES) })).default([]),
  /** Mercenary types of the pack. Any name can also be typed in. */
  mercenaries: z.array(TeamPresetSchema).default([]),
  /** Animal allies of the pack (the wolf Snowdasher). */
  allies: z.array(TeamPresetSchema).default([]),
});

export const PackManifestSchema = z.strictObject({
  schemaVersion: z.literal(PACK_SCHEMA_VERSION),
  id: slug,
  name: nonEmpty,
  description: z.string().optional(),
  /** The packs it needs. Every pack except `core` depends on `core`, directly or through another pack. */
  dependsOn: z.array(slug).default([]),
  /** Quest ids (the `id` of the quest files) in campaign order. Extra quests are allowed (Frozen Horror Q0). */
  quests: z.array(nonEmpty).default([]),
  campaignSettings: z.array(CampaignSettingSchema).default([]),
  /** Team choices of the pack for the New game popup. */
  team: PackTeamSchema.default({ heroes: [], mercenaries: [], allies: [] }),
});

export type PackManifest = z.infer<typeof PackManifestSchema>;
export type CampaignSetting = z.infer<typeof CampaignSettingSchema>;
