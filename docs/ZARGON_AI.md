# Zargon's turn: monster orders

The app does not know where heroes and monsters stand, and it does not know hero Body Points. So it cannot pick a target itself. Instead, each monster gets an **order** the players apply on the board, using their character sheets for numbers.

## An order

| Part | Example |
|---|---|
| **Target rule** | "The hero who attacked it last" |
| **Tie list** (always shown) | Dwarf › Wizard › Barbarian › Elf |
| **Plan** | "Move in and attack. Already next to a hero: attack and stay." |
| **Special rules** (when they apply) | "Cannot be harmed until it has moved or attacked." "Rolls 4 attack dice." |

How players use it: the monster goes for the first hero that fits the rule **and that it can reach this turn**. If the rule does not decide (two heroes fit, or the rule needs information nobody remembers), use the tie list. If no hero fits the rule within reach, use the tie list on the heroes it can reach. If it can reach nobody: move toward the heroes, or hold the nearest doorway.

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

Each spell listing in the quest is one cast (a spell listed twice, as the Witch Lord of Q14 has fear, can be cast twice). Every caster attacks or casts one spell per turn, so a second cast in the same turn is refused (`spellLimit: onePerTurn` is the explicit form of the same rule). Suggestion order:
1. escape (Balur) when it has 1 Body Point left;
2. summon (orcs / undead) when 3 or more heroes are in sight;
3. fear on the hero with most attack dice next to it;
4. sleep on the hero with most attack dice in sight;
5. ball of flame / firestorm on the Wizard or Elf in sight;
6. tempest, command: on the hero in sight who is closest to the quest objective.

"Next to it" for fear is a heuristic (fear is a good opener against a hero who is already in melee), not a rule. A spell that does not fit the team (summon with fewer than 3 heroes, ball of flame or firestorm with no Wizard or Elf) is not dropped: it moves to the end of the list, with a condition that says so.
The app shows the suggested spell and a short paraphrased effect; players read the Dread spell card.

## Determinism

`rng(seed | turn | monsterId)`: same turn, same order, also after undo and reload. The quest seed is set when the game starts. The seed is kept in the game state. The grudge hero is a pure function of (seed, monster id, team), so nothing else is stored. The draw never uses `state.rng`.

The grudge hero and the tie lists assume the team is fixed for the whole quest. If the team changes, they change too.

## "Who can it reach?" mode

Optional toggle. Players tap the heroes each monster can reach (and "already next to that hero"). The app then:
- names the hero when only one is in reach, or when the rule is `grudge`, `caster` or `closest` (tie list order among reachable heroes);
- otherwise shows the rule restricted to the reachable heroes plus the filtered tie list.
