/**
 * Quest file schema (Zod). Mirrors `docs/QUEST_FORMAT.md`.
 * Structure only. Checks that need the board (cells inside the board, doors on an edge...)
 * live in `validate.ts`.
 */
import { z } from 'zod';
import { IMAGE_PATTERN, MAX_IMAGE_CHARS } from '../data/enemies';
import { SPELL_TAG_IDS, SPELL_TIMINGS } from '../data/spells';

export const SCHEMA_VERSION = 1;

const nonEmpty = z.string().min(1);
const id = nonEmpty;
const areaId = z.string().regex(/^(C|R\d{2})$/, 'area id must be C or R01..R22');
const roomId = z.string().regex(/^R\d{2}$/, 'room id must be R01..R22');
const cell = z.tuple([z.number().int().min(0), z.number().int().min(0)]);
const cells = z.array(cell).min(1);

export const FURNITURE_TYPES = [
  'stairs',
  'table',
  'sorcerersTable',
  'alchemistsBench',
  'bookcase',
  'cupboard',
  'chest',
  'throne',
  'tomb',
  'rack',
  'weaponsRack',
  'fireplace',
] as const;

export const MONSTER_TYPES = [
  'goblin',
  'orc',
  'abomination',
  'skeleton',
  'zombie',
  'mummy',
  'dreadWarrior',
  'gargoyle',
  'dreadSorcerer',
] as const;

export const TRAP_KINDS = ['pit', 'fallingBlock', 'spear', 'chest', 'scripted'] as const;

const MonsterType = z.enum(MONSTER_TYPES);
const MonsterState = z.enum(['active', 'dormant', 'stone', 'away']);

// ---- geometry

const DoorSchema = z.strictObject({ id, a: cell, b: cell });
const BlockSchema = z.strictObject({ id: id.optional(), cells: z.array(cell).min(1).max(2) });

const FurnitureSchema = z.strictObject({
  id,
  type: z.enum(FURNITURE_TYPES),
  cells,
  letter: z.string().min(1).optional(),
});

/** A small picture as a data URL (the editor shrinks it). */
const ImageSchema = z
  .string()
  .max(MAX_IMAGE_CHARS)
  .regex(IMAGE_PATTERN, 'an image is a png, jpeg or webp data URL');

const StatOverrides = z.strictObject({
  move: z.number().int().min(0).optional(),
  att: z.number().int().min(0).optional(),
  def: z.number().int().min(0).optional(),
  body: z.number().int().min(0).optional(),
  mind: z.number().int().min(0).optional(),
});

/**
 * How a monster behaves (prompts for the players, never enforced: the app does not track
 * positions). `waitsFor`: it does nothing until the condition is true. `goesToward`: who or what
 * it heads for instead of the rule of its type; `marker` needs a `marker` id of the quest.
 */
export const BEHAVIOR_WAITS = ['heroInSight', 'heroInRoom', 'heroAdjacent'] as const;
export const BEHAVIOR_TOWARD = ['strongestHero', 'weakestHero', 'stayPut', 'marker'] as const;
const BehaviorSchema = z
  .strictObject({
    waitsFor: z.enum(BEHAVIOR_WAITS).optional(),
    goesToward: z.enum(BEHAVIOR_TOWARD).optional(),
    marker: id.optional(),
  })
  .refine((b) => (b.goesToward === 'marker') === (b.marker !== undefined), {
    message: 'goesToward "marker" needs a marker id, and a marker id needs goesToward "marker"',
    path: ['marker'],
  });
export type MonsterBehavior = z.infer<typeof BehaviorSchema>;

const MonsterSchema = z
  .strictObject({
    id,
    type: MonsterType,
    cell: cell.optional(),
    name: nonEmpty.optional(),
    /** An enemy of the quest (`enemyDefs`) that gives defaults: name, stats, abilities, spells, image. */
    enemy: id.optional(),
    /** The letter of its token code when it is not the letter of its type. */
    letter: z.string().min(1).max(2).optional(),
    image: ImageSchema.optional(),
    overrides: StatOverrides.optional(),
    state: MonsterState.optional(),
    spells: z.array(nonEmpty).optional(),
    spellLimit: z.enum(['onePerTurn']).optional(),
    /** Spell id to the place it is offered in (1 = first). A spell not listed is offered at random. */
    spellOrder: z.record(nonEmpty, z.number().int().min(1).max(9)).optional(),
    /** Paraphrased special rules of a named monster, shown first on its Zargon order. */
    traits: z.array(nonEmpty).optional(),
    /** Story-critical monster (decision 69): drawn with a ring and a star. Not the same as having an ability. */
    special: z.boolean().optional(),
    /** Waits for something, or goes toward someone (decision 71). Prompts only. */
    behavior: BehaviorSchema.optional(),
    /** Reusable abilities by id: the core ones (`stone`, `fireImmune`...) or the quest's `abilityDefs`. */
    abilities: z.array(id).optional(),
    hidden: z.boolean().optional(),
  })
  .refine((m) => m.hidden === true || m.cell !== undefined, {
    message: 'a monster needs a cell unless it is hidden',
    path: ['cell'],
  });

/** A reusable monster definition (decision 70). A monster of the quest points at it. */
export const EnemyDefSchema = z.strictObject({
  id,
  name: nonEmpty,
  /** The core type it behaves like (target rules, base stats). */
  base: MonsterType,
  letter: z.string().min(1).max(2).optional(),
  image: ImageSchema.optional(),
  overrides: StatOverrides.optional(),
  abilities: z.array(id).optional(),
  spells: z.array(nonEmpty).optional(),
  traits: z.array(nonEmpty).optional(),
});

export const AbilityDefSchema = z.strictObject({
  id,
  name: nonEmpty,
  text: nonEmpty,
  kind: z.enum(['ability', 'weakness', 'immunity']).optional(),
});

export const SpellDefSchema = z
  .strictObject({
    id,
    name: nonEmpty,
    text: nonEmpty.optional(),
    tags: z.array(z.enum(SPELL_TAG_IDS)).default([]),
    question: nonEmpty.optional(),
    warning: nonEmpty.optional(),
    offerWhen: z.enum(['always', 'escapePoint']).optional(),
    timing: z.enum(SPELL_TIMINGS).optional(),
  })
  .refine((s) => s.tags.length > 0 || s.question !== undefined, {
    message: 'a spell needs situation tags or a question of its own',
    path: ['tags'],
  });

const TrapSchema = z
  .strictObject({
    id,
    kind: z.enum(TRAP_KINDS),
    cell: cell.optional(),
    furniture: id.optional(),
    effect: z.string().optional(),
  })
  .refine(
    (t) => {
      if (t.kind === 'scripted') return t.cell === undefined || t.furniture === undefined;
      if (t.kind === 'chest') return t.furniture !== undefined && t.cell === undefined;
      return t.cell !== undefined && t.furniture === undefined;
    },
    { message: 'chest traps use "furniture"; pit, fallingBlock and spear use "cell"' },
  );

/** A set of squares (decision 68): a place where "a hero enters" can be an event of its own. */
const ZoneSchema = z.strictObject({ id, cells: z.array(cell).min(1) });

const MarkerSchema = z.strictObject({
  id,
  label: nonEmpty,
  cell,
  /** `editor`: an anchor seen only in the editor (decision 66). Old files said `zargon`. */
  visible: z.enum(['editor', 'players']).optional(),
});

// ---- notes

const TriggerSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('questStart') }),
  z.strictObject({ type: z.literal('areaRevealed'), area: areaId }),
  z.strictObject({ type: z.literal('doorOpened'), door: id }),
  z.strictObject({ type: z.literal('areaEntered'), area: areaId }),
  z.strictObject({ type: z.literal('zoneEntered'), zone: id }),
  z.strictObject({ type: z.literal('squareEntered'), cell, repeat: z.boolean().optional() }),
  z.strictObject({
    type: z.literal('treasureSearch'),
    area: areaId,
    first: z.boolean().optional(),
  }),
  z.strictObject({ type: z.literal('secretDoorSearch'), area: areaId }),
  z.strictObject({ type: z.literal('trapSprung'), trap: id }),
  z.strictObject({ type: z.literal('trapDisarmed'), trap: id }),
  z.strictObject({
    type: z.literal('monsterKilled'),
    monster: id.optional(),
    monsterType: MonsterType.optional(),
  }),
  z.strictObject({ type: z.literal('allKilled'), monsters: z.array(id).min(1) }),
  z.strictObject({
    type: z.literal('spellCast'),
    monster: id.optional(),
    spell: nonEmpty.optional(),
  }),
  /** The quest is over. Its notes show in the end dialog. `outcome` and `ending` limit it. */
  z.strictObject({
    type: z.literal('questEnds'),
    outcome: z.enum(['stairs', 'fell', 'ending']).optional(),
    ending: id.optional(),
  }),
  z.strictObject({
    type: z.literal('zargonTurn'),
    n: z.number().int().min(1).optional(),
    every: z.number().int().min(1).optional(),
  }),
  /** `hint`: one plain line shown with the button (what to do, or what the players need to know). */
  /** The first time a monster (or a monster of that type) comes into view. */
  z.strictObject({
    type: z.literal('monsterSeen'),
    monster: id.optional(),
    monsterType: MonsterType.optional(),
  }),
  z.strictObject({
    type: z.literal('manual'),
    label: nonEmpty,
    hint: nonEmpty.optional(),
    /** The button can be pressed again and again (for example a magic door). */
    repeat: z.boolean().optional(),
  }),
]);

const ConditionSchema = z.union([
  z.strictObject({ flag: nonEmpty, is: z.boolean() }),
  z.strictObject({ counter: nonEmpty, gte: z.number() }),
  z.strictObject({ monster: id, alive: z.boolean() }),
  z.strictObject({ monstersAliveIn: areaId, is: z.number().int().min(0) }),
  /** The room is revealed, the door is open, the monster was seen (decision 67). */
  z.strictObject({ areaRevealed: areaId }),
  z.strictObject({ doorOpened: id }),
  z.strictObject({ monsterSeen: id }),
  /** Looking from this square is done, or there is nothing left to see from it (needs it seen). */
  z.strictObject({ lookDone: cell }),
  z.strictObject({ firstTime: z.literal(true) }),
]);

export type Effect =
  | { type: 'showText'; text: string; title?: string | undefined }
  | { type: 'revealArea'; area: string }
  | { type: 'revealAll' }
  | { type: 'openAllDoors' }
  | { type: 'placeMonster'; monster: string; cell?: [number, number] | undefined }
  | {
      type: 'setMonsterState';
      monster: string;
      state: 'active' | 'dormant' | 'stone' | 'away';
      turns?: number | undefined;
    }
  | { type: 'addSecretDoor'; door: string }
  | { type: 'placeBlock'; cells: [number, number][] }
  | { type: 'giveItem'; text: string }
  | { type: 'setFlag'; flag: string; value: boolean }
  | { type: 'addCounter'; counter: string; by: number }
  | { type: 'completeObjective'; objective: string }
  | { type: 'spawnNpc'; npc: string }
  | { type: 'promptChoice'; text: string; options: { label: string; effects: Effect[] }[] };

const EffectSchema: z.ZodType<Effect> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.strictObject({ type: z.literal('showText'), text: nonEmpty, title: z.string().optional() }),
    z.strictObject({ type: z.literal('revealArea'), area: areaId }),
    z.strictObject({ type: z.literal('revealAll') }),
    z.strictObject({ type: z.literal('openAllDoors') }),
    z.strictObject({ type: z.literal('placeMonster'), monster: id, cell: cell.optional() }),
    z.strictObject({
      type: z.literal('setMonsterState'),
      monster: id,
      state: MonsterState,
      turns: z.number().int().min(1).optional(),
    }),
    z.strictObject({ type: z.literal('addSecretDoor'), door: id }),
    z.strictObject({ type: z.literal('placeBlock'), cells }),
    z.strictObject({ type: z.literal('giveItem'), text: nonEmpty }),
    z.strictObject({ type: z.literal('setFlag'), flag: nonEmpty, value: z.boolean() }),
    z.strictObject({ type: z.literal('addCounter'), counter: nonEmpty, by: z.number() }),
    z.strictObject({ type: z.literal('completeObjective'), objective: id }),
    z.strictObject({ type: z.literal('spawnNpc'), npc: id }),
    z.strictObject({
      type: z.literal('promptChoice'),
      text: nonEmpty,
      options: z.array(z.strictObject({ label: nonEmpty, effects: z.array(EffectSchema) })).min(1),
    }),
  ]),
);

/** The quest element a note belongs to (decision 67). Derived from the trigger when missing. */
const TargetSchema = z.strictObject({
  kind: z.enum(['door', 'furniture', 'monster', 'trap', 'marker', 'area', 'square', 'zone']),
  id: nonEmpty,
});

const NoteSchema = z.strictObject({
  id,
  target: TargetSchema.optional(),
  letter: z.string().min(1).optional(),
  at: cell.optional(),
  trigger: TriggerSchema,
  when: z.array(ConditionSchema).optional(),
  effects: z.array(EffectSchema),
  consumesTreasure: z.boolean().optional(),
  /** Treasure search only: the note is shown, no card, no chest trap, and the search is not used up. */
  blocksSearch: z.boolean().optional(),
});

// ---- the rest

const WanderingSchema = z.union([
  z.strictObject({ monster: MonsterType }),
  z.strictObject({ text: nonEmpty }),
]);

const ObjectiveSchema = z.strictObject({
  id,
  text: nonEmpty,
  done: z
    .union([
      z.strictObject({ monsterKilled: id }),
      z.strictObject({ allKilled: z.array(id).min(1) }),
      /** Every monster the players have seen is slain (and at least one was seen). */
      z.strictObject({ allSeenKilled: z.literal(true) }),
      z.strictObject({ flag: nonEmpty }),
      /** Done when all these conditions hold (checked after every event). `firstTime` is not allowed. */
      z.strictObject({ when: z.array(ConditionSchema).min(1) }),
    ])
    .optional(),
  /** A button in the Quest sheet that completes the objective: for goals the app cannot see. */
  confirm: nonEmpty.optional(),
  /** The confirm button only shows while all these conditions hold. */
  confirmWhen: z.array(ConditionSchema).min(1).optional(),
});

const RulesSchema = z.strictObject({
  fallingBlock: nonEmpty.optional(),
  doorTeleport: z.strictObject({ dice: nonEmpty, squares: nonEmpty }).optional(),
  noEquipmentUntil: id.optional(),
  bounty: z.partialRecord(MonsterType, z.number().int().min(0)).optional(),
});

const EndingSchema = z.strictObject({
  id,
  label: nonEmpty,
  text: nonEmpty.optional(),
});

const NpcSchema = z.strictObject({
  id,
  name: nonEmpty,
  cell,
  defend: z.number().int().min(0),
  body: z.number().int().min(0),
  /** Movement dice (shown only, never tracked). */
  move: z.number().int().min(0).optional(),
  /** Attack dice; 0 means it cannot attack. */
  attack: z.number().int().min(0).optional(),
  text: z.string(),
});

export const QuestSchema = z.strictObject({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id: nonEmpty,
  number: z.number().int().min(1),
  title: nonEmpty,
  intro: z.strictObject({ summary: nonEmpty, userText: z.string().optional() }),
  start: z.strictObject({ area: roomId }),
  rock: z
    .strictObject({
      rooms: z.array(roomId).default([]),
      cells: z.array(cell).default([]),
    })
    .default({ rooms: [], cells: [] }),
  doors: z.array(DoorSchema).default([]),
  secretDoors: z.array(DoorSchema).default([]),
  falseDoors: z.array(DoorSchema).default([]),
  blocks: z.array(BlockSchema).default([]),
  furniture: z.array(FurnitureSchema).default([]),
  monsters: z.array(MonsterSchema).default([]),
  traps: z.array(TrapSchema).default([]),
  markers: z.array(MarkerSchema).default([]),
  zones: z.array(ZoneSchema).default([]),
  /** The quest's own abilities, next to the core library (decision 69). */
  abilityDefs: z.array(AbilityDefSchema).default([]),
  /** The quest's own spells, next to the core ones (decision 70). */
  spellDefs: z.array(SpellDefSchema).default([]),
  /** The quest's own enemies (decision 70). */
  enemyDefs: z.array(EnemyDefSchema).default([]),
  notes: z.array(NoteSchema).default([]),
  wandering: WanderingSchema.optional(),
  objectives: z.array(ObjectiveSchema).default([]),
  rewards: z.string().optional(),
  /** Shown on the end screen after every ending (a note the players should read at the end). */
  endText: nonEmpty.optional(),
  rules: RulesSchema.default({}),
  npcs: z.array(NpcSchema).default([]),
  /** Extra ways to end the quest (for example an NPC died). Optional, no schema bump needed. */
  endings: z.array(EndingSchema).optional(),
});

export type Quest = z.infer<typeof QuestSchema>;
export type QuestInput = z.input<typeof QuestSchema>;
export type Trigger = z.infer<typeof TriggerSchema>;
export type Condition = z.infer<typeof ConditionSchema>;
export type Note = z.infer<typeof NoteSchema>;
export type NoteTarget = z.infer<typeof TargetSchema>;
export type ZoneDef = z.infer<typeof ZoneSchema>;
export type EnemyDef = z.infer<typeof EnemyDefSchema>;

/** A hero for the library (decision 70): a name and a picture. Not used in play yet. */
export const HeroDefSchema = z.strictObject({ id, name: nonEmpty, image: ImageSchema.optional() });
export type HeroDef = z.infer<typeof HeroDefSchema>;

/** A companion for the library: the helper characters of a quest (Sir Ragnar), reusable. */
export const CompanionDefSchema = z.strictObject({
  id,
  name: nonEmpty,
  defend: z.number().int().min(0),
  body: z.number().int().min(0),
  text: z.string(),
  image: ImageSchema.optional(),
});
export type CompanionDef = z.infer<typeof CompanionDefSchema>;
export type AbilityDefData = z.infer<typeof AbilityDefSchema>;
export type SpellDefData = z.infer<typeof SpellDefSchema>;
export type DoorDef = z.infer<typeof DoorSchema>;
export type BlockDef = z.infer<typeof BlockSchema>;
export type FurnitureDef = z.infer<typeof FurnitureSchema>;
export type MonsterDef = z.infer<typeof MonsterSchema>;
export type TrapDef = z.infer<typeof TrapSchema>;
export type MarkerDef = z.infer<typeof MarkerSchema>;
export type EndingDef = z.infer<typeof EndingSchema>;
export type NpcDef = z.infer<typeof NpcSchema>;
export type ObjectiveDef = z.infer<typeof ObjectiveSchema>;
export type QuestRules = z.infer<typeof RulesSchema>;
export type MonsterType = z.infer<typeof MonsterType>;
