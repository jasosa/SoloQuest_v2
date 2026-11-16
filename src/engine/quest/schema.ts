/**
 * Quest file schema (Zod). Mirrors `docs/QUEST_FORMAT.md`.
 * Structure only. Checks that need the board (cells inside the board, doors on an edge...)
 * live in `validate.ts`.
 */
import { z } from 'zod';

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
const MonsterState = z.enum(['active', 'dormant', 'stone']);

// ---- geometry

const DoorSchema = z.strictObject({ id, a: cell, b: cell });
const BlockSchema = z.strictObject({ id: id.optional(), cells: z.array(cell).min(1).max(2) });

const FurnitureSchema = z.strictObject({
  id,
  type: z.enum(FURNITURE_TYPES),
  cells,
  letter: z.string().min(1).optional(),
});

const MonsterSchema = z
  .strictObject({
    id,
    type: MonsterType,
    cell: cell.optional(),
    name: nonEmpty.optional(),
    overrides: z
      .strictObject({
        move: z.number().int().min(0).optional(),
        att: z.number().int().min(0).optional(),
        def: z.number().int().min(0).optional(),
        body: z.number().int().min(0).optional(),
        mind: z.number().int().min(0).optional(),
      })
      .optional(),
    state: MonsterState.optional(),
    spells: z.array(nonEmpty).optional(),
    spellLimit: z.enum(['onePerTurn']).optional(),
    /** Paraphrased special rules of a named monster, shown first on its Zargon order. */
    traits: z.array(nonEmpty).optional(),
    hidden: z.boolean().optional(),
  })
  .refine((m) => m.hidden === true || m.cell !== undefined, {
    message: 'a monster needs a cell unless it is hidden',
    path: ['cell'],
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
  z.strictObject({
    type: z.literal('zargonTurn'),
    n: z.number().int().min(1).optional(),
    every: z.number().int().min(1).optional(),
  }),
  z.strictObject({ type: z.literal('manual'), label: nonEmpty }),
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
      state: 'active' | 'dormant' | 'stone';
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
  kind: z.enum(['door', 'furniture', 'monster', 'trap', 'marker', 'area']),
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
  notes: z.array(NoteSchema).default([]),
  wandering: WanderingSchema.optional(),
  objectives: z.array(ObjectiveSchema).default([]),
  rewards: z.string().optional(),
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
