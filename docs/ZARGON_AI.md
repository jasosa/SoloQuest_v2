Can it see a hero? | Part | Example |
|---|---|
| **Target rule** | "The hero who attacked it last" |
| **Tie list** (always shown) | Dwarf › Wizard › Barbarian › Elf |
| **Plan** | "Move in and attack. Already next to a hero: attack and stay." |
| **Special rules** (when they apply) | "Cannot be harmed until it has moved or attacked." "Rolls 4 attack dice." |
| **Roster buttons** (some monsters) | "Escaped" (thief), "It left" / "A hero attacked it" (passive) |

How players use it: the monster goes for the first hero that fits the rule **and that it can reach this turn**. If the rule does not decide (two heroes fit, or the rule needs information nobody remembers), use the tie list. If no hero fits the rule within reach, use the tie list on the heroes it can reach. If it can reach nobody: move toward the heroes, or hold the nearest doorway. The page shows one monster at a time in a dialog (decision 34); there is no "Who can it reach?" mode.

## Targets (decisions 38, 39)

- The team is a free list of named entries: heroes, mercenaries (named with their owner, "Scout (Dwarf)") and animal allies ("Snowdasher (Elf)"). NPCs (decision 27, e.g. Sir Ragnar) are targets too. All of them are in the tie list.
- A quest can exclude a target (Frozen Horror Q3: Gothar is never a target).
- `caster`, `grudge` and Gremlin theft pick heroes only. The other rules can name any target ("the one with the fewest defend dice").
- `HERO_DIED` works for any team entry: a dead mercenary or ally leaves the tie list like a dead hero.

## Dead heroes (decision 32)

The app tracks only whether a hero died (`HERO_DIED`), nothing else about wounds. `ordersFor` takes the full team and takes dead heroes out: the tie list is the seeded shuffle of the full team with the dead filtered out (so the relative order does not change after a death). The grudge hero is still drawn from the full team; once he is dead the `grudge` rule is no longer offered (the draw uses the remaining weights). `caster` needs a living Wizard or Elf. When every hero is dead there are no orders.

### No valid target (decision 35)

When the rule has no valid target, or the monster cannot reach the hero it names, use the tie list among the heroes it can reach; ties on the stat rules work the same way. A monster can only attack a hero it can attack this turn: if the target is out of reach but another hero is next to it, it attacks the first adjacent hero in the tie list. If it can reach nobody, the plan covers it: it moves toward the target (or the closest hero). A monster pursues the heroes unless the quest says it guards something (`behavior`). A monster may move then act, or act then move, never move, act, move again; no diagonals, no passing heroes, no opening doors. This is written here once and not repeated in each order.

Only three rules get a short line on the order (`Order.noTarget`), because the case is not obvious:

| Rule | Line |
|---|---|
| `lastAttacker` | If nobody has attacked it yet, use the tie list. |
| `caster` | If no Wizard or Elf is in reach, use the tie list. |
| `grudge` | If the <Hero> is out of reach, use the tie list. |

Stone entries and fresh wandering monsters have no `noTarget`.

## Target rules

| Key | Text shown | Needs |
|---|---|---|
| `closest` | The closest hero it can reach | the board |
| `isolated` | A hero with no other hero next to them and another monster next to them (cut off from the others) | the board |
| `lastAttacker` | The hero who attacked it last | players remember |
| `lowestBody` | The hero with the fewest Body Points left | character sheets |
| `highestBody` | The hero with the most Body Points left | character sheets |
| `lowestDef` | The hero with the fewest defend dice | character sheets |
| `highestDef` | The hero with the most defend dice | character sheets |
| `highestAtt` | The hero with the most attack dice | character sheets |
| `caster` | A spellcaster (Wizard or Elf) | team |
| `grudge` | The **<Hero>**, whatever it costs | the named hero is drawn once per monster and kept for the whole quest |

## Weights per monster type

A rule is drawn **each Zargon turn, per monster**, with these weights. Monsters with the same order in the same turn share one entry on the page.

| Monster | Profile (plan) | Weights |
|---|---|---|
| Goblin | skirmisher | isolated 1 (no hero fits: the tie list) |
| Orc | fighter | closest 3, lastAttacker 3, lowestBody 2, highestAtt 1, grudge 1 |
| Abomination | fighter | highestAtt 2, closest 2, lastAttacker 2, highestBody 1, grudge 1 |
| Dread warrior | fighter | highestAtt 3, highestBody 2, grudge 2, lastAttacker 1 |
| Skeleton, Zombie, Mummy | relentless | closest 1 (always the closest) |
| Gargoyle | relentless | highestBody 2, closest 2, lastAttacker 1, grudge 1 |
| Named casters (Grak, Balur, Witch Lord; packs: Vilor, Frozen Horror, Jracksfot) | caster | spell flow first (below), then like Dread warrior |
| Ice Gremlin | thief | closest 3, lowestDef 2, lowestBody 1 |
| Polar Warbear | relentless, 2 attacks | closest 3, highestAtt 2, lastAttacker 2, grudge 1 |
| Yeti | grappler | lowestDef 3, lowestBody 2, closest 2 |
| Crossbowman (enemy) | shooter | caster 3, lowestDef 2, lastAttacker 2 |
| Halberdier (enemy) | fighter | like Orc; special rule: attacks diagonally |
| Scout (enemy) | skirmisher | like Goblin |
| Swordsman (enemy), Krag, Kelvinos | fighter | like Dread warrior |
| Wolf mummy | relentless | like Mummy |

Tune weights in `src/engine/zargon/weights.ts` only; keep this table in sync. Pack monsters (decision 36) bring their profile and weights in the pack data; the rows for Frozen Horror monsters are listed here so the table stays complete.

## Plans

| Profile | Plan text |
|---|---|
| skirmisher | Next to a hero: attack, then run back out of reach. Otherwise: move in and attack. |
| fighter | Move in and attack. Already next to a hero: attack and stay, or (1 turn in 3, seeded) attack, then move back out of reach. |
| relentless | Move in and attack. Never falls back. |
| caster | Cast a spell first (see below); otherwise as fighter, without moving back. |
| thief | See below. |
| grappler | See below. |
| shooter | Target in sight, not adjacent: shoot, don't move. None in sight: move until one is, then shoot. Starts next to a target: 70% "step back out of contact and shoot; if it can't, melee and stay", 30% "melee and stay". |
| passive | No orders (like a dormant monster). Buttons "It left" / "A hero attacked it". |

Rule from the rulebook: a monster may move then act, or act then move, but never move part way, act, and move again. "Attack, then run back" is only possible when it starts next to a hero.

### Pack profiles (decision 49)

**Multi-attack (Polar Warbear).** One target rule per attack; it moves only once. Plan: "Attack 1: rule A. Attack 2: rule B. If B's target is out of reach, hit A's target again." Special rules: one defend roll per turn against it; the hero may see the first attack before deciding to defend.

**Large monsters (Frozen Horror, 2x2).** Special rules: attacks any adjacent square, diagonals included; can squeeze through 1-square corridors.

**Thief (Ice Gremlin).** No app state for the theft.
- Card text: "If it has already stolen: run away at full speed; if no hero sees it at the start of Zargon's turn, it escapes with the item (tap Escaped). Killed before that: the hero gets the item back."
- Otherwise a seeded 50% steal / 50% attack (attack as skirmisher). Steal: heroes only; suggested item: a potion if the hero has one, else the most valuable item they carry; never the armor, shield or weapon in use (decision 50). With the Raiment setting: never from a hero wearing Cold Iron Plate Mail.
- **Escaped** takes it off the roster, not a kill (decision 51). Quests can ask a question on escape (Frozen Horror Q9-10: "Was it the Crystal Key?").

**Grappler (Yeti).** No app state for the hug.
- Card text: "If it is hugging a hero: that hero takes 2 BP, cannot defend and cannot act; the Yeti does nothing else. If its attack makes a hero lose at least 1 BP, it starts hugging them. Otherwise: move in and attack."
- Setting "No Yeti hug in solo quests" (decision 59, on by default): in solo quests it is a plain brute. With the Raiment setting: it cannot hug a hero carrying the Spiked Shield.

**Passive (Frozen Horror Q0 caged Warbear).** No orders. "It left" makes it `freed`; "A hero attacked it" makes it `active` with its brute profile.

**In the data**: `profile` is `thief`, `grappler`, `shooter` or `passive`; `attacks: 2` gives the multi-attack plan; `size: 2` marks a large monster. The events are `MONSTER_LEAVE` (reason `escaped` or `freed`: off the roster, no kill notes) and `MONSTER_WAKE` (passive to active). The plan lines are in `src/engine/zargon/texts.ts`. Still open: the Yeti setting of decision 59 and the Raiment exceptions, with the campaign settings (M9 slice 6).

**Monster states**: `hidden`, `dormant`, `passive`, `active`, `dead`, plus `escaped` and `freed`, which leave the roster without being kills (decision 51). A surrender is not a state: a quest action sets the monster `away`.

**Defensive abilities** (future packs, decision 52): a toast on first reveal per monster type and a badge on the token.

## Tie list

A seeded shuffle of the team (heroes, mercenaries, animal allies) and the NPCs that are not excluded, drawn each turn per monster. Always shown, even when the rule names one target.

## Casters

The app does not model spells in detail (decision 31). Each spell listing in the quest is one cast (a spell listed twice, as the Witch Lord of Q14 has fear, can be cast twice). Every caster attacks or casts one spell per turn, so a second cast in the same turn is refused (`spellLimit: onePerTurn` is the explicit form of the same rule).

For a caster with at least one spell left that has not cast this turn, the order shows ONE spell, picked at random among the spells it still has (seeded: a hash of seed, turn and monster id, so the same pick after undo and reload; never the game rng). The players answer "Could it cast it?":
- **Yes**: `SPELL_CAST` records it. The players apply the effect on the board themselves (the app only says "Read the Dread spell card"). Casting was its action, so no plan is shown.
- **No**: `SPELL_FAILED` records that this spell could not be cast this turn. The order then shows the next spell of the same seeded shuffle (the pick is element k of the shuffle of the spells left, k = declined count, so it never repeats). Declined spells are forgotten at the end of the Zargon turn.
- When no spell is left (or all were declined), the order says there is no spell this turn and shows the plan of a duelist, as for a non-caster.

Before any answer, the order shows the spell and the plan as a fallback line ("If it cannot cast: ...").

### Spell flow (decisions 47, 48, 72)

A caster always tries a spell first.
1. **App checks first.** If monster Body Points are tracked, spells tagged `selfHurt`, `selfNearDeath` or `allyHurt` are checked against the roster: true, they come first; false, they are skipped this turn. If BP are not tracked, these tags are asked like the others.
2. **The offer order** is a seeded shuffle of the spells it still has. A monster can pin a spell to a place (`spellOrder`, 1 = first), the others fill the rest at random.
3. **Each spell is shown with** its name, a line about when it is cast (below), and "It casts this spell if:" with the questions of its tags (any one true is enough). The questions are about where the monster can stand this turn, since it may move first.
4. **Yes** records the cast. **No** shows the next spell ("spell 2 of 3"). When no spell is left, the order is the normal plan, with no note.
5. Escape is only offered when the quest has an escape point.

When it is cast (`timing`, per spell, default `either`): `either` = it may move first, then cast; `beforeMoving` = cast, then it may move; `afterMoving` = move, then cast; `instead` = cast instead of moving (Escape). Casting is its action, so it never attacks the same turn.

| Tag | Question | App checks alone |
|---|---|---|
| `selfHurt` | Has this monster lost at least 1 Body Point? | if monster BP tracked |
| `selfNearDeath` | Does this monster have only 1 Body Point left? | if monster BP tracked |
| `allyHurt` | Has any other monster lost at least 1 Body Point? | if monster BP tracked |
| `manyInSight` | Can it see 3 or more heroes? | no |
| `heroesGrouped` | Can it see 2 or more heroes standing within 2 squares of each other? | no |
| `heroesInSameRoom` | Are 2 or more heroes in the same room as it? | no |
| `heroesInSameArea` | Are 2 or more heroes in the same room or corridor as it? | no |
| `heroInLine` | Is a hero in the same row or column as it, with no wall or closed door between them? | no |
| `heroAdjacent` | Is a hero on a square right next to it? | no |
| `strongAdjacent` | Is a hero that rolls 3 or more attack dice right next to it? | no |
| `strongInSight` | Can it see a hero that rolls 3 or more attack dice? | no |
| `casterInSight` | Can it see the Wizard or the Elf? | no |
| `noneInReach` | Is every hero too far away for it to get next to this turn? | no |
| `canBlockPath` | Can it stand in a doorway or a corridor square so that the heroes cannot pass it? | no |
| `nearObjective` | Could a hero finish the quest goal within 2 turns? | no |
| `any` | Can it see a hero? | no |

**Core Dread spells** (tags only, no card text; checked against the owner's photos of the 2021 and 2024 cards)

| Spell | Tags | Warning shown |
|---|---|---|
| Fear | `strongAdjacent`, `strongInSight` | |
| Sleep | `strongAdjacent`, `strongInSight` | |
| Command | `strongInSight` | |
| Tempest | `nearObjective`, `strongInSight` | |
| Ball of Flame | `any` | |
| Lightning Bolt | `heroInLine` | Older card: also hits monsters in the line |
| Firestorm | `heroesInSameRoom` | Also hits monsters in the room; not in corridors |
| Cloud of Dread | `heroesInSameArea` | |
| Summon Orcs | `manyInSight`, `selfHurt` | |
| Summon Undead | `manyInSight`, `selfHurt` | |
| Escape | `selfNearDeath` | Only offered when the quest has an escape point |
| Rust | custom: "Does a hero in sight carry a metal sword or helmet that is not an artifact?" | |

Pack spells: `FROZEN_HORROR.md`. Fan-made spells are made in the editor (name, own text, tags or custom question, optional warning).

## Determinism

`rng(seed | turn | monsterId)`: same turn, same order, also after undo and reload. The quest seed is set when the game starts. The seed is kept in the game state. The grudge hero is a pure function of (seed, monster id, team), so nothing else is stored. The draw never uses `state.rng`.

The grudge hero and the tie lists assume the team is fixed for the whole quest. If the team changes, they change too. Deaths do not change the team: they only filter it. Campaign draws (Raiment artifact placement, decision 61) use a campaign seed and are stored in the campaign.

## Heroes who die mid-turn

When a hero falls, the rules available to monsters that have not acted yet are drawn again from the living heroes, so the rule shown for a pending monster can change after a death. The draw stays deterministic.

## Behavior prompts and added monsters (decision 71)

A monster may carry a `behavior`: `waitsFor` (a hero in sight, in its room, next to it) and `goesToward` (the strongest hero, the weakest hero, nobody, a marked square, or `guardMarker`: it guards a marked square, stays close to it and only attacks a hero who comes near). With no behavior a monster pursues the nearest hero; guarding is always the quest's choice (decision 73). They are shown as the first lines of its order and are never enforced. A monster the players added in play has a normal order from its first Zargon turn; a wandering monster still attacks at once and has its order from the next turn.
