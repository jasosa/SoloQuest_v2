/**
 * Zargon's orders for the current turn (docs/ZARGON_AI.md). Pure: the draw for a monster comes from
 * a hash of (seed, turn, monster id), so the same inputs give the same order, also after undo and
 * reload. Nothing here reads or changes `state.rng`, and no positions or hero Body Points exist.
 */
import type { Level } from '../board/level';
import { HEROES, HERO_NAMES, type Hero } from '../data/heroes';
import { next } from '../game/rng';
import type { GameState } from '../game/state';
import { monstersInPlay, type MonsterView } from '../game/view';
import type { MonsterDef, MonsterType } from '../quest/schema';
import { rngFor, shuffled } from './hash';
import {
  SPELL_KEYS,
  SPELL_EFFECT_TEXT,
  SPELL_NAMES,
  SPELL_RULES,
  SPELL_UNFIT_TEXT,
  isSpellKey,
  type SpellKey,
} from './spells';
import { PLAN_TEXT, RULE_TEXT } from './texts';
import { isCaster, profileOf, weightsOf, type Profile, type RuleKey } from './weights';

export interface SpellSuggestion {
  readonly spell: string;
  /** Display name. */
  readonly name: string;
  /** Plain words: when to cast it. The players check, the app does not know who is in sight. */
  readonly condition: string;
  /** Always "Read the Dread spell card." (the app has no spell texts). */
  readonly effect: string;
  /** False when the team cannot use it well (listed last, with a condition that says so). */
  readonly fits: boolean;
  /** Casts left for this spell (a spell listed twice in the quest has 2). */
  readonly left: number;
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
  /** Casters only: suggestions in order, restricted to spells left. */
  readonly spells?: readonly SpellSuggestion[];
  /** Casters only: why `spells` is empty, when it is. */
  readonly spellNote?: string;
  /** A sentence for the UI (stone countdown, fresh wanderer). */
  readonly note?: string;
  /** The Zargon turn this order is for (next turn for a fresh wanderer). */
  readonly turn: number;
  /** The order of this monster was carried out this turn. Not part of the grouping key. */
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

/** Rule keys that can be drawn for this monster and team, with their weights. */
export function availableRules(def: Caps, team: readonly Hero[]): [RuleKey, number][] {
  const hasCaster = team.includes('wizard') || team.includes('elf');
  return (Object.entries(weightsOf(def)) as [RuleKey, number][]).filter(
    ([k, w]) => w > 0 && (k !== 'caster' || hasCaster) && (k !== 'grudge' || team.length >= 1),
  );
}

function drawRule(
  def: Caps,
  team: readonly Hero[],
  seed: number,
  turn: number,
  id: string,
): RuleKey {
  const entries = availableRules(def, team);
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
function specialRules(def: MonsterDef | undefined): string[] {
  if (!def) return [];
  const out: string[] = [...(def.traits ?? [])];
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

/**
 * Spells left, in suggestion order. A spell that does not fit the team is not dropped: it goes to
 * the end, with a condition that says so.
 */
function suggestSpells(
  left: Readonly<Record<string, number>>,
  team: readonly Hero[],
): SpellSuggestion[] {
  const hasCaster = team.includes('wizard') || team.includes('elf');
  const fits = (k: SpellKey): boolean => {
    const need = SPELL_RULES[k].need;
    return need === 'none' || (need === 'threeHeroes' ? team.length >= 3 : hasCaster);
  };
  return Object.keys(left)
    .filter(isSpellKey)
    .sort(
      (a, b) =>
        Number(!fits(a)) - Number(!fits(b)) ||
        SPELL_RULES[a].priority - SPELL_RULES[b].priority ||
        SPELL_KEYS.indexOf(a) - SPELL_KEYS.indexOf(b),
    )
    .map((k: SpellKey) => {
      const need = SPELL_RULES[k].need;
      const ok = fits(k);
      return {
        spell: k,
        name: SPELL_NAMES[k],
        condition: ok || need === 'none' ? SPELL_RULES[k].condition : SPELL_UNFIT_TEXT[need],
        fits: ok,
        effect: SPELL_EFFECT_TEXT,
        left: left[k]!,
      };
    });
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
  const t = canon(team);
  if (t.length === 0) throw new Error('The team needs at least one hero');
  const caps: Caps = def ?? view;
  const profile = profileOf(caps);

  if (view.state === 'stone') {
    const n = view.stoneTurns;
    return {
      ...base,
      status: 'stone',
      profile,
      tie: t,
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
  const rule = drawRule(caps, t, seed, turn, id);
  const grudge = rule === 'grudge' ? grudgeHero(seed, id, t) : undefined;
  const order: Order = {
    ...base,
    status: fresh ? 'fresh' : 'act',
    profile,
    rule,
    ruleText: grudge ? `The ${HERO_NAMES[grudge]}, whatever it costs` : RULE_TEXT[rule],
    ...(grudge ? { grudgeHero: grudge } : {}),
    tie: shuffled(t, rngFor(seed, turn, id, 'tie')),
    plan: PLAN_TEXT[profile],
    special: specialRules(def),
    ...(fresh ? { note: 'It already attacked this round. Its order starts next turn.' } : {}),
    turn,
    done,
  };
  if (profile !== 'caster' || !isCaster(caps)) return order;

  const left = def ? spellsLeft(def, state, id) : {};
  // Every caster attacks or casts one spell per turn.
  const blocked = !fresh && state.castThisTurn.includes(id);
  const suggestions = blocked ? [] : suggestSpells(left, t);
  const spellNote = blocked
    ? 'It already cast a spell this turn.'
    : Object.keys(left).length === 0
      ? 'No spells left.'
      : undefined;
  return { ...order, spells: suggestions, ...(spellNote ? { spellNote } : {}) };
}

/**
 * One order per ACTIVE monster seen by the heroes, in reveal order, for `state.turn`.
 * Dormant monsters (furniture, decision 28) and slain monsters never appear. Stone monsters get an
 * entry without a rule. A wandering monster that is still fresh gets a note and next turn's order.
 * `seed` defaults to the quest seed kept in the state. An empty team gives an empty list.
 * The grudge hero and the tie lists assume the team is fixed for the whole quest.
 */
export function ordersFor(
  level: Level,
  state: GameState,
  team: readonly Hero[],
  seed: number = state.seed,
): Order[] {
  if (team.length === 0) return [];
  seed = seed >>> 0;
  const defs = new Map(level.quest.monsters.map((m) => [m.id, m]));
  return monstersInPlay(level, state)
    .filter((v) => !v.dead)
    .map((view) => buildOrder(state, team, seed, view, defs.get(view.id)));
}

export interface OrderGroup {
  /** Same key = same entry. */
  readonly key: string;
  /** Member monster ids, in reveal order. */
  readonly monsters: readonly string[];
  readonly names: readonly string[];
  /** The shared order (that of the first member). */
  readonly order: Order;
  /** Ids of members already done. */
  readonly doneIds: readonly string[];
  /** Every member is done. */
  readonly done: boolean;
}

/** What makes two orders "the same": everything except the monster and its done flag. */
export function orderKey(o: Order): string {
  return JSON.stringify([
    o.status,
    o.type,
    o.rule ?? null,
    o.grudgeHero ?? null,
    o.tie,
    o.plan ?? null,
    o.spells ?? null,
    o.spellNote ?? null,
    o.special,
    o.note ?? null,
  ]);
}

/** Merge identical orders into one entry (first appearance decides the position). */
export function groupOrders(orders: readonly Order[]): OrderGroup[] {
  const groups: { key: string; members: Order[] }[] = [];
  for (const o of orders) {
    const key = orderKey(o);
    const g = groups.find((x) => x.key === key);
    if (g) g.members.push(o);
    else groups.push({ key, members: [o] });
  }
  return groups.map(({ key, members }) => ({
    key,
    monsters: members.map((m) => m.monster),
    names: members.map((m) => m.name),
    order: members[0]!,
    doneIds: members.filter((m) => m.done).map((m) => m.monster),
    done: members.every((m) => m.done),
  }));
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
