# Zargon's turn: monster orders

The app does not know where heroes and monsters stand, and it does not know hero Body Points. So it cannot pick a target itself. Instead, each monster gets an **order** the players apply on the board, using their character sheets for numbers.

## An order

| Part | Example |
|---|---|
| **Target rule** | "The hero who attacked it last" |
| **Tie list** (always shown) | Dwarf › Wizard › Barbarian › Elf |
| **Plan** | "Move in and attack. Already next to a hero: attack and stay." |
| **Special rules** (when they apply) | "Cannot be harmed until it has moved or attacked." "Rolls 4 attack dice." |

How players use it: the monster goes for the first hero that fits the rule **and that it can reach this turn**. If the rule does not decide (two heroes fit, or the rule needs information nobody remembers), use the tie list. If no hero fits the rule within reach, use the tie list on the heroes it can reach. If it can reach nobody: move toward the heroes, or hold the nearest doorway. The page shows one monster at a time in a dialog (decision 34); there is no "Who can it reach?" mode.

## Dead heroes (decision 32)

The app tracks only whether a hero died (`HERO_DIED`), nothing else about wounds. `ordersFor` takes the full team and takes dead heroes out: the tie list is the seeded shuffle of the full team with the dead filtered out (so the relative order does not change after a death). The grudge hero is still drawn from the full team; once he is dead the `grudge` rule is no longer offered (the draw uses the remaining weights). `caster` needs a living Wizard or Elf. When every hero is dead there are no orders.

## Target rules

| Key | Text shown | Needs |
|---|---|---|
| `closest` | The closest hero it can reach | the board |
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
| Goblin | skirmisher | lowestBody 3, lowestDef 3, caster 2, closest 2, lastAttacker 1 |
| Orc | soldier | closest 3, lastAttacker 3, lowestBody 2, highestAtt 1, grudge 1 |
| Abomination | brute | highestAtt 2, closest 2, lastAttacker 2, highestBody 1, grudge 1 |
| Dread warrior | duelist | highestAtt 3, highestBody 2, grudge 2, lastAttacker 1 |
| Skeleton, Zombie, Mummy | relentless | closest 4, lastAttacker 2, lowestDef 1 |
| Gargoyle | brute | highestBody 2, closest 2, lastAttacker 1, grudge 1 |
| Named casters (Grak, Balur, Witch Lord) | caster | spell choice first (below), then like Dread warrior |

Tune weights in `src/engine/zargon/weights.ts` only; keep this table in sync.

## Plans

| Profile | Plan text |
|---|---|
| skirmisher | Next to a hero: attack, then run back out of reach. Otherwise: move in and attack. |
| soldier | Move in and attack. Already next to a hero: attack and stay. |
| brute | Move in and attack. Never falls back. |
| duelist | Move in and attack. No hero in reach: block the nearest doorway. |
| relentless | Move in and attack. Never falls back. |
| caster | Cast a spell if a target is in sight and a spell is left; otherwise as duelist. |

Rule from the rulebook: a monster may move then act, or act then move, but never move part way, act, and move again. "Attack, then run back" is only possible when it starts next to a hero.

## Tie list

A seeded shuffle of the team, drawn each turn per monster. Always shown, even when the rule names one hero.

## Casters

The app does not model spells in detail (decision 31). Each spell listing in the quest is one cast (a spell listed twice, as the Witch Lord of Q14 has fear, can be cast twice). Every caster attacks or casts one spell per turn, so a second cast in the same turn is refused (`spellLimit: onePerTurn` is the explicit form of the same rule).

For a caster with at least one spell left that has not cast this turn, the order shows ONE spell, picked at random among the spells it still has (seeded: a hash of seed, turn and monster id, so the same pick after undo and reload; never the game rng). The players answer "Could it cast it?":
- **Yes**: `SPELL_CAST` records it. The players apply the effect on the board themselves (the app only says "Read the Dread spell card"). Casting was its action, so no plan is shown.
- **No**: `SPELL_FAILED` records that this spell could not be cast this turn. The order then shows the next spell of the same seeded shuffle (the pick is element k of the shuffle of the spells left, k = declined count, so it never repeats). Declined spells are forgotten at the end of the Zargon turn.
- When no spell is left (or all were declined), the order says there is no spell this turn and shows the plan of a duelist, as for a non-caster.

Before any answer, the order shows the spell and the plan as a fallback line ("If it cannot cast: ...").

## Determinism

`rng(seed | turn | monsterId)`: same turn, same order, also after undo and reload. The quest seed is set when the game starts. The seed is kept in the game state. The grudge hero is a pure function of (seed, monster id, team), so nothing else is stored. The draw never uses `state.rng`.

The grudge hero and the tie lists assume the team is fixed for the whole quest. If the team changes, they change too. Deaths do not change the team: they only filter it.

## Heroes who die mid-turn

When a hero falls, the rules available to monsters that have not acted yet are drawn again from the living heroes, so the rule shown for a pending monster can change after a death. The draw stays deterministic.
