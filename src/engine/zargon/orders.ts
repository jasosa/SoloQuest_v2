/**
 * Zargon's orders for the current turn (docs/ZARGON_AI.md). Pure: the draw for a monster comes from
 * a hash of (seed, turn, monster id), so the same inputs give the same order, also after undo and
 * reload. Nothing here reads or changes `state.rng`, and no positions or hero Body Points exist.
 */
import type { Level } from '../board/level';
import { tr } from '../../i18n/translate';
import type { AbilityDef } from '../data/abilities';
import { HEROES } from '../data/heroes';
import {
  heroClass,
  labelOf,
  normalizeTeam,
  type MemberKind,
  type TeamInput,
  type TeamMember,
} from '../data/team';
import type { GameState } from '../game/state';
import { monstersInPlay, type MonsterView } from '../game/view';
import { npcsInPlay } from '../game/noteView';
import type { MonsterDef, MonsterType } from '../quest/schema';
import { next } from '../game/rng';
import { wandererDef } from '../game/roster';
import { rngFor, shuffled } from './hash';
import { SPELL_EFFECT_TEXT } from './spells';
import { SPELL_TIMING_TEXT, hasEscapePoint, spellLookup, spellQuestions } from '../data/spells';
import { pickSpell } from './spellPick';
import {
  PLAN_TEXT,
  RULE_TEXT,
  fighterPlan,
  grapplerPlan,
  multiAttackLines,
  noTargetText,
  shooterPlan,
  thiefPlan,
} from './texts';
import {
  isCaster,
  profileOf,
  weightsOf,
  type Profile,
  type RuleKey,
  type Weights,
} from './weights';

/** The one spell picked for a caster this turn. The app does not describe spells. */
export interface SpellPick {
  readonly spell: string;
  /** Display name. */
  readonly name: string;
  /** Casts left for this spell, this one included (a spell listed twice in the quest has 2). */
  readonly left: number;
  /** "Read the Dread spell card." for a core spell, or the quest's own text. */
  readonly effect: string;
  /** The question(s) the players answer: one per situation tag, or the spell's own question. The spell can be cast if any is true (decision 48). */
  readonly questions: readonly string[];
  /** A warning to show with the spell (it also hits monsters, for example). */
  readonly warning?: string;
  /** When it is cast relative to the move, and that casting is the action. */
  readonly timing: string;
  /** Which spell this is of the ones it can still try this turn, and how many there are. */
  readonly place: number;
  readonly of: number;
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
  /** The id of the hero of a `grudge` rule. */
  readonly grudgeHero?: string;
  /** The name of the grudge hero. */
  readonly grudgeName?: string;
  /** A permutation of the team entries that are alive (member ids). Never empty. */
  readonly tie: readonly string[];
  /** The names of `tie`, in the same order ("Scout (Dwarf)" for a mercenary). */
  readonly tieNames: readonly string[];
  readonly plan?: string;
  /** Rules from the quest data that apply now (stat overrides, spell limit). */
  readonly special: readonly string[];
  /** Casters with a spell to try: the random pick. Ask "Can it see a hero?" (SPELL_CAST / SPELL_FAILED). */
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

const KIND_RANK: Record<MemberKind, number> = { hero: 0, mercenary: 1, ally: 2 };

/**
 * The team in a fixed order (heroes in the order of the four heroes, then mercenaries, then allies, then by id),
 * so the order of the list in the UI never changes an order.
 */
function canon(team: readonly TeamMember[]): TeamMember[] {
  const rank = (m: TeamMember) => {
    const c = heroClass(m);
    return c ? HEROES.indexOf(c) : HEROES.length;
  };
  return [...team].sort(
    (a, b) =>
      KIND_RANK[a.kind] - KIND_RANK[b.kind] || rank(a) - rank(b) || a.id.localeCompare(b.id),
  );
}

/** What the rules look at for a hero: its class (a pack hero plays as a core hero), else its id. */
const heroKey = (m: TeamMember): string => heroClass(m) ?? m.id;

/**
 * The grudge hero id: a pure function of (seed, monster, team). Stable for the whole quest. Only heroes
 * are drawn (decision 39), never a mercenary or an ally.
 */
export function grudgeHero(seed: number, monsterId: string, team: readonly TeamInput[]): string {
  const t = canon(normalizeTeam(team).filter((m) => m.kind === 'hero')).map((m) => m.id);
  if (t.length === 0) throw new Error('The team needs at least one hero');
  const [v] = next(rngFor(seed, 'grudge', monsterId, t.join(',')));
  return t[Math.floor(v * t.length)]!;
}

type Caps = Pick<MonsterDef, 'type' | 'spells' | 'profile' | 'weights'>;

/**
 * Rule keys that can be drawn for this monster, with their weights. `living` are the heroes still
 * alive (a class such as `wizard`, or the id of a hero that has none). `caster` needs a living Wizard
 * or Elf; `grudge` needs a living grudge hero (`grudgeAlive`).
 */
export function availableRules(
  def: Caps,
  living: readonly string[],
  grudgeAlive = true,
  weights: Weights = weightsOf(def),
): [RuleKey, number][] {
  const hasCaster = living.includes('wizard') || living.includes('elf');
  return (Object.entries(weights) as [RuleKey, number][]).filter(
    ([k, w]) =>
      w > 0 &&
      (k !== 'caster' || hasCaster) &&
      (k !== 'grudge' || (living.length >= 1 && grudgeAlive)),
  );
}

function drawRule(
  def: Caps,
  living: readonly string[],
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
const waitsText = (k: 'heroInSight' | 'heroInRoom' | 'heroAdjacent'): string =>
  k === 'heroInSight'
    ? tr('zargon.waitsSight', 'Waits: it does nothing until a hero is in its line of sight.')
    : k === 'heroInRoom'
      ? tr('zargon.waitsRoom', 'Waits: it does nothing until a hero is in its room.')
      : tr('zargon.waitsAdjacent', 'Waits: it does nothing until a hero is next to it.');

const towardText = (k: 'strongestHero' | 'weakestHero' | 'stayPut'): string =>
  k === 'strongestHero'
    ? tr(
        'zargon.towardStrongest',
        'Goes toward the hero with the most Body Points left, not the nearest.',
      )
    : k === 'weakestHero'
      ? tr(
          'zargon.towardWeakest',
          'Goes toward the hero with the fewest Body Points left, not the nearest.',
        )
      : tr('zargon.stayPut', 'Stays where it is. It only attacks a hero next to it.');

/** The behavior prompts of a monster (decision 71), as lines for the players. */
export function behaviorLines(
  def: Pick<MonsterDef, 'behavior'> | undefined,
  markers: readonly { id: string; label: string }[],
): string[] {
  const b = def?.behavior;
  if (!b) return [];
  const out: string[] = [];
  if (b.waitsFor) out.push(waitsText(b.waitsFor));
  if (b.goesToward === 'marker') {
    const m = markers.find((k) => k.id === b.marker);
    out.push(
      m
        ? tr(
            'zargon.towardMarkerNamed',
            'Goes toward the marked square "{label}", not the nearest hero.',
            { label: m.label },
          )
        : tr('zargon.towardMarker', 'Goes toward the marked square, not the nearest hero.'),
    );
  } else if (b.goesToward === 'guardMarker') {
    const m = markers.find((k) => k.id === b.marker);
    out.push(
      m
        ? tr(
            'zargon.guardsMarkerNamed',
            'Guards the marked square "{label}": it stays close to it and only attacks a hero who comes near.',
            { label: m.label },
          )
        : tr(
            'zargon.guardsMarker',
            'Guards the marked square: it stays close to it and only attacks a hero who comes near.',
          ),
    );
  } else if (b.goesToward) out.push(towardText(b.goesToward));
  return out;
}

function specialRules(
  def: MonsterDef | undefined,
  abilities: readonly AbilityDef[],
  markers: readonly { id: string; label: string }[],
): string[] {
  if (!def) return [];
  const out: string[] = [...behaviorLines(def, markers), ...(def.traits ?? [])];
  for (const a of abilities) out.push(`${a.name}: ${a.text}`);
  // The stats are on the card above (Move, Att, Def, Body, Mind): Special never repeats them.
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

/** The plan line of one turn. The seeded draws use their own labels, so they never change the rule draw. */
function planOf(
  profile: Profile,
  seed: number,
  turn: number,
  id: string,
  attacks: number,
  caps: Caps,
  living: readonly string[],
  grudgeOk: boolean,
  hugs: boolean,
): string {
  const draw = (label: string) => next(rngFor(seed, turn, id, label))[0];
  let plan: string;
  switch (profile) {
    case 'fighter':
      plan = fighterPlan(draw('back') < 1 / 3);
      break;
    case 'thief':
      plan = thiefPlan(draw('steal') < 1 / 2);
      break;
    case 'grappler':
      plan = grapplerPlan(hugs);
      break;
    case 'shooter':
      plan = shooterPlan(draw('stepback') < 0.7);
      break;
    default:
      plan = PLAN_TEXT[profile];
  }
  if (attacks < 2) return plan;
  // One target rule per attack: the first is the order's own rule, the others are drawn here.
  const rules: string[] = [];
  for (let k = 1; k < attacks; k++) {
    const entries = availableRules(caps, living, grudgeOk);
    if (entries.length === 0) {
      rules.push(RULE_TEXT.closest);
      continue;
    }
    const total = entries.reduce((s, [, w]) => s + w, 0);
    let pick = next(rngFor(seed, turn, id, `rule${k + 1}`))[0] * total;
    let chosen = entries[entries.length - 1]![0];
    for (const [key, w] of entries) {
      if (pick < w) {
        chosen = key;
        break;
      }
      pick -= w;
    }
    rules.push(RULE_TEXT[chosen]);
  }
  return `${plan} ${multiAttackLines([tr('zargon.targetAbove', 'The target above'), ...rules])}`;
}

function buildOrder(
  level: Level,
  state: GameState,
  team: readonly TeamMember[],
  seed: number,
  opts: OrderOptions,
  view: MonsterView,
  def: MonsterDef | undefined,
): Order {
  const id = view.id;
  const done = state.doneThisTurn.includes(id);
  const base = { monster: id, type: view.type, name: view.name };
  const full = canon(team);
  const alive = full.filter((m) => !state.deadHeroes.includes(m.id));
  const livingHeroes = alive.filter((m) => m.kind === 'hero');
  const living = livingHeroes.map(heroKey);
  const nameOf = (id: string) => labelOf(full, id);
  const caps: Caps = def ?? view;
  const profile = profileOf(caps);

  if (view.state === 'stone') {
    const n = view.stoneTurns;
    return {
      ...base,
      status: 'stone',
      profile,
      tie: alive.map((m) => m.id),
      tieNames: alive.map((m) => labelOf(full, m.id)),
      special: [],
      note:
        n === undefined
          ? 'Stone: it does nothing until the quest says otherwise.'
          : `Stone: ${n} ${n === 1 ? 'turn' : 'turns'} left, it does nothing.`,
      turn: state.turn,
      done,
    };
  }

  if (view.state === 'passive') {
    return {
      ...base,
      status: 'stone',
      profile,
      tie: alive.map((m) => m.id),
      tieNames: alive.map((m) => labelOf(full, m.id)),
      special: [],
      note: tr(
        'zargon.passiveNote',
        'Passive: no orders. If the heroes free it or it leaves, tap "It left". If a hero attacks it, tap "A hero attacked it".',
      ),
      turn: state.turn,
      done,
    };
  }

  const fresh = view.wandering === true && view.fresh === true;
  const turn = fresh ? state.turn + 1 : state.turn;
  // The grudge hero comes from the FULL team; once he is dead the rule is no longer offered.
  const grudgeHeroOfMonster = grudgeHero(seed, id, full);
  const grudgeOk = livingHeroes.some((m) => m.id === grudgeHeroOfMonster);
  const rule = drawRule(caps, living, grudgeOk, seed, turn, id);
  const grudge = rule === 'grudge' ? grudgeHeroOfMonster : undefined;
  const grudgeName = grudge ? nameOf(grudge) : undefined;
  // The team and the NPCs of the quest that are not excluded (decision 39). The shuffle is of the fixed
  // list, so an NPC that appears later does not move the others; one that is not in play is dropped.
  const excluded = level.quest.excludeTargets ?? [];
  const npcs = level.quest.npcs.filter((n) => !excluded.includes(n.id));
  const npcsHere = new Set(npcsInPlay(level, state).map((n) => `npc:${n.id}`));
  const npcNames = new Map(npcs.map((n) => [`npc:${n.id}`, n.name]));
  const tie = shuffled(
    [...full.map((m) => m.id), ...npcs.map((n) => `npc:${n.id}`)],
    rngFor(seed, turn, id, 'tie'),
  ).filter((m) => (npcNames.has(m) ? npcsHere.has(m) : alive.some((a) => a.id === m)));
  const order: Order = {
    ...base,
    status: fresh ? 'fresh' : 'act',
    profile,
    rule,
    ruleText: grudgeName ? `The ${grudgeName}, whatever it costs` : RULE_TEXT[rule],
    ...(grudge ? { grudgeHero: grudge, grudgeName: grudgeName! } : {}),
    // The shuffle is of the full team, so the relative order stays the same after a death.
    tie,
    tieNames: tie.map((m) => npcNames.get(m) ?? nameOf(m)),
    plan: planOf(
      profile,
      seed,
      turn,
      id,
      def?.attacks ?? 1,
      caps,
      living,
      grudgeOk,
      !(opts.noHugInSolo && level.quest.team?.solo),
    ),
    ...(fresh || noTargetText(rule, grudgeName) === undefined
      ? {}
      : { noTarget: noTargetText(rule, grudgeName)! }),
    special: [
      ...specialRules(def, view.abilities, level.quest.markers),
      ...(profile === 'grappler' && opts.noHugInSolo && level.quest.team?.solo
        ? [tr('zargon.soloNoHug', 'Solo quest: it does not hug. Ignore the hug rule above.')]
        : []),
      ...(opts.raiment ? raimentLines(profile) : []),
    ],
    ...(fresh
      ? {
          note: tr(
            'zargon.freshNote',
            'It already attacked this round. Its order starts next turn.',
          ),
        }
      : {}),
    turn,
    done,
  };
  if (profile !== 'caster' || !isCaster(caps)) return order;

  const lookup = spellLookup(level.quest);
  // A spell that needs an escape point is only offered when the quest has one (decision 47).
  const left = Object.fromEntries(
    Object.entries(def ? spellsLeft(def, state, id) : {}).filter(([k]) => {
      const sp = lookup.get(k);
      return !sp || sp.offerWhen !== 'escapePoint' || hasEscapePoint(level.quest, k);
    }),
  );
  // Casting was its action for the turn: no plan then.
  if (!fresh && state.castThisTurn.includes(id)) {
    const { plan: _plan, ...rest } = order;
    void _plan;
    return {
      ...rest,
      declined: [],
      spellNote: tr('zargon.alreadyCast', 'It already cast a spell this turn.'),
    };
  }
  const declined = state.spellsFailed[id] ?? [];
  if (Object.keys(left).length === 0)
    return {
      ...order,
      declined: [...declined],
      spellNote: tr('zargon.noSpellsLeft', 'No spells left.'),
    };
  // A caster always tries a spell first (decision 72). Each "no" shows the next spell it has; when
  // none is left the order is the normal plan, with no note.
  const pick = pickSpell(seed, turn, id, Object.keys(left), declined, def?.spellOrder);
  if (pick === undefined) return { ...order, declined: [...declined] };
  const { plan: _plan, ...rest } = order;
  void _plan;
  return {
    ...rest,
    declined: [...declined],
    spell: {
      spell: pick,
      name: lookup.get(pick)?.name ?? pick,
      left: left[pick]!,
      effect: lookup.get(pick)?.text ?? SPELL_EFFECT_TEXT,
      questions: lookup.get(pick)
        ? spellQuestions(lookup.get(pick)!)
        : [tr('zargon.canItSee', 'Can it see a hero?')],
      ...(lookup.get(pick)?.warning ? { warning: lookup.get(pick)!.warning } : {}),
      timing: SPELL_TIMING_TEXT[lookup.get(pick)?.timing ?? 'either'],
      place: declined.length + 1,
      of: Object.keys(left).length,
    },
    fallbackPlan: PLAN_TEXT.caster,
  };
}

/**
 * Settings that change what an order says (decisions 59 and 61). Off when left out, so the engine alone
 * gives the plain card text; the app passes its settings.
 */
export interface OrderOptions {
  /** "No Yeti hug in solo quests" (decision 59): in a quest whose `team.solo` is set, a grappler is a plain brute. */
  readonly noHugInSolo?: boolean | undefined;
  /** The campaign setting "Raiment of the Frozen Champion" (decision 61): the thief and grappler cards name the artifact warnings. */
  readonly raiment?: boolean | undefined;
}

/** Warning lines of the Raiment setting, by profile. */
function raimentLines(profile: Profile): string[] {
  if (profile === 'thief')
    return [
      tr(
        'zargon.raimentThief',
        'Raiment of the Frozen Champion: it cannot steal from a hero wearing the Cold Iron Plate Mail.',
      ),
    ];
  if (profile === 'grappler')
    return [
      tr(
        'zargon.raimentGrappler',
        'Raiment of the Frozen Champion: it cannot hug a hero carrying the Spiked Shield.',
      ),
    ];
  return [];
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
  teamInput: readonly TeamInput[],
  seed: number = state.seed,
  opts: OrderOptions = {},
): Order[] {
  const team = normalizeTeam(teamInput);
  // All heroes dead (or no hero at all): nobody to order against. A mercenary alone does not count.
  if (!team.some((m) => m.kind === 'hero' && !state.deadHeroes.includes(m.id))) return [];
  seed = seed >>> 0;
  const defs = new Map(level.quest.monsters.map((m) => [m.id, m]));
  return monstersInPlay(level, state)
    .filter((v) => !v.dead)
    .map((view) =>
      buildOrder(
        level,
        state,
        team,
        seed,
        opts,
        view,
        defs.get(view.id) ??
          (state.wanderers[view.id]
            ? wandererDef(level, state.wanderers[view.id]!, view.id)
            : undefined),
      ),
    );
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
