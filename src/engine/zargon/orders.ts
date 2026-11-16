/**
 * Zargon's orders for the current turn (docs/ZARGON_AI.md). Pure: the draw for a monster comes from
 * a hash of (seed, turn, monster id), so the same inputs give the same order, also after undo and
 * reload. Nothing here reads or changes `state.rng`, and no positions or hero Body Points exist.
 */
import type { Level } from '../board/level';
import type { AbilityDef } from '../data/abilities';
import { HEROES, HERO_NAMES, type Hero } from '../data/heroes';
import { next } from '../game/rng';
import type { GameState } from '../game/state';
import { monstersInPlay, type MonsterView } from '../game/view';
import type { MonsterDef, MonsterType } from '../quest/schema';
import { rngFor, shuffled } from './hash';
import { SPELL_EFFECT_TEXT, SPELL_NAMES, isSpellKey } from './spells';
import { pickSpell } from './spellPick';
import { PLAN_TEXT, RULE_TEXT, noTargetText } from './texts';
import { isCaster, profileOf, weightsOf, type Profile, type RuleKey } from './weights';

/** The one spell picked for a caster this turn. The app does not describe spells. */
export interface SpellPick {
  readonly spell: string;
  /** Display name. */
  readonly name: string;
  /** Casts left for this spell, this one included (a spell listed twice in the quest has 2). */
  readonly left: number;
  /** Always "Read the Dread spell card." */
  readonly effect: string;
}

export type OrderStatus = 'act' | 'stone' | 'fresh';

export interface Order {
  readonly monster: string;
  readonly type: MonsterType;
  readonly name: string;
  /** `act`: carry it out now. `stone`: does nothing. `fresh`: wandering monster, already attacked. */
  readonly status: OrderStatus;
  readonly profile: Profile;
  /** Absent for a stone monster. For a fresh wanderer it is the order for next turn. */
  readonly rule?: RuleKey;
  readonly ruleText?: string;
  /** The hero of a `grudge` rule. */
  readonly grudgeHero?: Hero;
  /** A permutation of the team. Never empty. */
  readonly tie: readonly Hero[];
  readonly plan?: string;
  /** Rules from the quest data that apply now (stat overrides, spell limit). */
  readonly special: readonly string[];
  /** Casters with a spell to try: the random pick. Ask "Could it cast it?" (SPELL_CAST / SPELL_FAILED). */
  readonly spell?: SpellPick;
  /** Only for lastAttacker, caster and grudge on an acting monster: what to do with no valid target. */
  readonly noTarget?: string;
  /** Casters only: spells declined this turn (SPELL_FAILED), in the order they were offered. */
  readonly declined?: readonly string[];
  /** Shown with `spell`: "If it cannot cast: <plan>". */
  readonly fallbackPlan?: string;
  /** Casters only: why there is no spell (none left, all declined, already cast). */
  readonly spellNote?: string;
  /** A sentence for the UI (stone countdown, fresh wanderer). */
  readonly note?: string;
  /** The Zargon turn this order is for (next turn for a fresh wanderer). */
  readonly turn: number;
  /** The order of this monster was carried out this turn. */
  readonly done: boolean;
}

/** Heroes in canonical order, so the team order in the UI never changes an order. */
function canon(team: readonly Hero[]): Hero[] {
  return HEROES.filter((h) => team.includes(h));
}

/** The grudge hero: a pure function of (seed, monster, team). Stable for the whole quest. */
export function grudgeHero(seed: number, monsterId: string, team: readonly Hero[]): Hero {
  const t = canon(team);
  if (t.length === 0) throw new Error('The team needs at least one hero');
  const [v] = next(rngFor(seed, 'grudge', monsterId, t.join(',')));
  return t[Math.floor(v * t.length)]!;
}

type Caps = Pick<MonsterDef, 'type' | 'spells'>;

/**
 * Rule keys that can be drawn for this monster, with their weights. `living` are the heroes still
 * alive. `caster` needs a living Wizard or Elf; `grudge` needs a living grudge hero (`grudgeAlive`).
 */
export function availableRules(
  def: Caps,
  living: readonly Hero[],
  grudgeAlive = true,
): [RuleKey, number][] {
  const hasCaster = living.includes('wizard') || living.includes('elf');
  return (Object.entries(weightsOf(def)) as [RuleKey, number][]).filter(
    ([k, w]) =>
      w > 0 &&
      (k !== 'caster' || hasCaster) &&
      (k !== 'grudge' || (living.length >= 1 && grudgeAlive)),
  );
}

function drawRule(
  def: Caps,
  living: readonly Hero[],
  grudgeAlive: boolean,
  seed: number,
  turn: number,
  id: string,
): RuleKey {
  const entries = availableRules(def, living, grudgeAlive);
  if (entries.length === 0) return 'closest';
  const total = entries.reduce((s, [, w]) => s + w, 0);
  const [v] = next(rngFor(seed, turn, id, 'rule'));
  let pick = v * total;
  for (const [k, w] of entries) {
    if (pick < w) return k;
    pick -= w;
  }
  return entries[entries.length - 1]![0];
}

/**
 * Special rules from the quest data: its `traits` first, then a line for every stat override that
 * is present in the def (even when equal to the base table: named monsters carry their own stats).
 */
function specialRules(def: MonsterDef | undefined, abilities: readonly AbilityDef[]): string[] {
  if (!def) return [];
  const out: string[] = [...(def.traits ?? [])];
  for (const a of abilities) out.push(`${a.name}: ${a.text}`);
  const o = def.overrides;
  if (o?.att !== undefined) out.push(`Rolls ${o.att} attack ${o.att === 1 ? 'die' : 'dice'}`);
  if (o?.def !== undefined) out.push(`Rolls ${o.def} defend ${o.def === 1 ? 'die' : 'dice'}`);
  if (o?.move !== undefined) out.push(`Moves ${o.move} ${o.move === 1 ? 'square' : 'squares'}`);
  if (o?.body !== undefined) out.push(`Has ${o.body} Body Points`);
  return out;
}

/** Spells left for a monster: the quest list minus the casts so far (one cast uses one listing). */
export function spellsLeft(
  def: Pick<MonsterDef, 'spells'>,
  state: Pick<GameState, 'spellsCast'>,
  id: string,
): Record<string, number> {
  const left: Record<string, number> = {};
  for (const s of def.spells ?? []) left[s] = (left[s] ?? 0) + 1;
  for (const s of state.spellsCast[id] ?? []) if (left[s]) left[s] -= 1;
  for (const k of Object.keys(left)) if (left[k] === 0) delete left[k];
  return left;
}

function buildOrder(
  state: GameState,
  team: readonly Hero[],
  seed: number,
  view: MonsterView,
  def: MonsterDef | undefined,
): Order {
  const id = view.id;
  const done = state.doneThisTurn.includes(id);
  const base = { monster: id, type: view.type, name: view.name };
  const full = canon(team);
  const living = full.filter((h) => !state.deadHeroes.includes(h));
  const caps: Caps = def ?? view;
  const profile = profileOf(caps);

  if (view.state === 'stone') {
    const n = view.stoneTurns;
    return {
      ...base,
      status: 'stone',
      profile,
      tie: living,
      special: [],
      note:
        n === undefined
          ? 'Stone: it does nothing until the quest says otherwise.'
          : `Stone: ${n} ${n === 1 ? 'turn' : 'turns'} left, it does nothing.`,
      turn: state.turn,
      done,
    };
  }

  const fresh = view.wandering === true && view.fresh === true;
  const turn = fresh ? state.turn + 1 : state.turn;
  // The grudge hero comes from the FULL team; once he is dead the rule is no longer offered.
  const grudgeHeroOfMonster = grudgeHero(seed, id, full);
  const rule = drawRule(caps, living, living.includes(grudgeHeroOfMonster), seed, turn, id);
  const grudge = rule === 'grudge' ? grudgeHeroOfMonster : undefined;
  const order: Order = {
    ...base,
    status: fresh ? 'fresh' : 'act',
    profile,
    rule,
    ruleText: grudge ? `The ${HERO_NAMES[grudge]}, whatever it costs` : RULE_TEXT[rule],
    ...(grudge ? { grudgeHero: grudge } : {}),
    // The shuffle is of the full team, so the relative order stays the same after a death.
    tie: shuffled(full, rngFor(seed, turn, id, 'tie')).filter((h) => living.includes(h)),
    plan: PLAN_TEXT[profile],
    ...(fresh || noTargetText(rule, grudge && HERO_NAMES[grudge]) === undefined
      ? {}
      : { noTarget: noTargetText(rule, grudge && HERO_NAMES[grudge])! }),
    special: specialRules(def, view.abilities),
    ...(fresh ? { note: 'It already attacked this round. Its order starts next turn.' } : {}),
    turn,
    done,
  };
  if (profile !== 'caster' || !isCaster(caps)) return order;

  const left = def ? spellsLeft(def, state, id) : {};
  // Casting was its action for the turn: no plan then.
  if (!fresh && state.castThisTurn.includes(id)) {
    const { plan: _plan, ...rest } = order;
    void _plan;
    return { ...rest, declined: [], spellNote: 'It already cast a spell this turn.' };
  }
  const declined = state.spellsFailed[id] ?? [];
  const pick = pickSpell(seed, turn, id, Object.keys(left), declined);
  if (pick === undefined)
    return {
      ...order,
      declined: [...declined],
      spellNote: Object.keys(left).length === 0 ? 'No spells left.' : 'No spell this turn.',
    };
  const { plan: _plan, ...rest } = order;
  void _plan;
  return {
    ...rest,
    declined: [...declined],
    spell: {
      spell: pick,
      name: isSpellKey(pick) ? SPELL_NAMES[pick] : pick,
      left: left[pick]!,
      effect: SPELL_EFFECT_TEXT,
    },
    fallbackPlan: PLAN_TEXT.caster,
  };
}

/**
 * One order per ACTIVE monster seen by the heroes, in reveal order, for `state.turn`.
 * Dormant monsters (furniture, decision 28) and slain monsters never appear. Stone monsters get an
 * entry without a rule. A wandering monster that is still fresh gets a note and next turn's order.
 * `seed` defaults to the quest seed kept in the state. An empty team, or a team that is all dead, gives an empty list. `team` is the FULL team: dead
 * heroes (state.deadHeroes) are taken out of the tie list and the rules.
 * The grudge hero and the tie lists assume the team is fixed for the whole quest.
 */
export function ordersFor(
  level: Level,
  state: GameState,
  team: readonly Hero[],
  seed: number = state.seed,
): Order[] {
  if (team.length === 0) return [];
  // All heroes dead: nobody to order against.
  if (team.every((h) => state.deadHeroes.includes(h))) return [];
  seed = seed >>> 0;
  const defs = new Map(level.quest.monsters.map((m) => [m.id, m]));
  return monstersInPlay(level, state)
    .filter((v) => !v.dead)
    .map((view) => buildOrder(state, team, seed, view, defs.get(view.id)));
}

export interface TurnProgress {
  readonly turn: number;
  /** Monsters that act this turn (not stone, not fresh wanderers, not dead). */
  readonly total: number;
  readonly done: readonly string[];
  readonly remaining: readonly string[];
  readonly allDone: boolean;
}

export function turnProgress(level: Level, state: GameState): TurnProgress {
  const acting = monstersInPlay(level, state).filter(
    (v) => !v.dead && v.state === 'active' && !(v.wandering === true && v.fresh === true),
  );
  const done = acting.filter((v) => state.doneThisTurn.includes(v.id)).map((v) => v.id);
  const remaining = acting.filter((v) => !state.doneThisTurn.includes(v.id)).map((v) => v.id);
  return {
    turn: state.turn,
    total: acting.length,
    done,
    remaining,
    allDone: remaining.length === 0,
  };
}
