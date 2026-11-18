# Frozen Horror quest pack: what the app needs

Analysis of the Frozen Horror Quest Pack (10 quests, Barbarian quest pack) plus its free prelude, Online Quest 2 "Into the Northlands". The app stays rules-agnostic: no spell effects, no potions, no items, no hero stats, and it follows the guiding principle (track as little as possible, enforce the minimum). Decisions behind this doc: `DECISIONS.md` #36 to #63. All text here is paraphrased (decision 8).

Built into `IMPLEMENTATION_PLAN.md` (milestones M9 pack layer and M10 Frozen Horror) and `ZARGON_AI.md` (targets, profiles, weights, spell flow).

---

## 1. Pack overview

| # | Quest | Type | Start / end | New things the app needs |
|---|---|---|---|---|
| 0 | Into the Northlands (online prelude) | Solo, any hero + wolf ally | Ice cave entrance tile / same, through the throne door | Animal ally; caged Warbear behind a sight-blocking cage; throne becomes a door; 3 tunnel designs. See §8 |
| 1 | Xanon Pass | Solo (Barbarian) | Iron door / wooden exit | Edge doors; Crossbowman that never moves and gives up (note B question) |
| 2 | Trial by Ice | Solo | Ice cave entrance tile (start and end) | Tile start; ice tunnels; named Dread warrior Krag |
| 3 | The Rescue | Solo | Stairway | NPC Gothar spawns when the Dread warriors die; monsters ignore Gothar; chest trap |
| 4 | The Glacial Gate | Group | Iron door / wooden exit | Caged Gremlin (note B question); ice ledge room; chest trap on all heroes in the room |
| 5 | The Deadly Depths | Group | Iron door / wooden exit | Doors that vanish when all heroes are in (B); door hidden until then (C); Frozen Crypt monsters wake on door; ice tunnels; caster Vilor |
| 6 | The Frosted Path | Group | Iron door / wooden exit | Ice vault; ice ledge (refers to Q4 rule) |
| 7 | The Halls of Kelvinos | Group | Iron door / wooden exit | Named monster Kelvinos; Living Fog room |
| 8 | The Search for the Scepter | Group | Iron door / wooden exit | Scepter to destroy (note G question, hidden explosion); 3 tunnel pairs; ice ledge; flag "Scepter destroyed" |
| 9–10 | The Heart of Ice | Group, double quest | Iron door / end when Frozen Horror dies | Two maps; Crystal Key and locked door; Gremlin treasure room merges two rooms; Frozen Horror 2x2 caster |

Wandering monsters: Q0 1 Ice Gremlin, Q1 2 Skeletons, Q2 2 Goblins, Q3 2 Orcs, Q4 2 Abominations, Q5 2 Mummies, Q6 2 Dread warriors, Q7 2 Yeti, Q8 3 Ice Gremlins, Q9–10 2 Polar Warbears.

Ignored (players handle it): potions and alchemist shop, Mind Points and shock, artifacts, spell scrolls, new treasure cards, passing and selling items, mercenary costs, Living Fog attack roll, ice ledge / ice vault / icy river rolls, Magic Ice and other blocks placed by spells, who is hugged by a Yeti, who was robbed by a Gremlin.

---

## 2. Pack layer (#36 to #40, #61)

- Base game = pack `core`. Frozen Horror depends on it (uses core monsters and core Dread spells).
- Manifest: quests and campaign order (Q0 prelude first); quest team rules as warnings (solo Barbarian only, solo any hero); monsters; mercenary types; animal ally types (wolf); terrain kinds; room tiles; trap kinds; spells with situation tags; rule texts (paraphrased) that notes can reference (e.g. ice ledge rule used by Q4 E, Q6 G, Q8 F).
- Setup: pack → campaign or one-shot → quest → team as a free list (heroes incl. alternate Barbarian, mercenaries, animal allies with an owner hero). The quest's team rule shows as a warning, never a block (#38).
- Campaign keeps: finished quests, carried flags, team, campaign-setting draws. One-shot: Scepter counts as destroyed.
- Campaign setting "Raiment of the Frozen Champion" (off by default, #61): 4 artifacts hidden with the strongest monster of 4 quests drawn at campaign start (kill notes). When on, the Gremlin and Yeti cards show the matching artifact warnings.
- Wandering monsters: list of `{ type, count }` (#40).

---

## 3. Board

**Edge doors (#54).** Door on a cell side with `outside: true`, kind `ironEntry` or `woodenExit`, arrow drawn outside.
- Iron door visible at start; heroes start outside; first tap opens and looks in from the inner cell.
- Wooden exit revealed by sight like any door; the end dialog (decision 26) says "Heroes left through this door".
- `start`: stairway | iron door | tile (ice cave entrance, which also holds the end action in Q0 and Q2).

**Room tiles (#55).** `roomTiles: [{ type, areaId, rot, cells? }]`.
- Look + rule: Ice Vault, Living Fog, Cage, Scepter, Seat of Power, Frozen Crypt, Gremlin treasure room.
- Special cells: Chasm / ice ledge crevasse, Frozen Crypt monster squares.
- Merge: `areaOverrides: [{ merge: [areaA, areaB], as }]` (Q10 K Gremlin treasure room). Wall between them removed for reveal and sight.
- Sight-blocking pieces until a flag (#56, exception to decision 16): Q0 cage.

**Large monsters (#55).** Placement `size` (2x2) and anchor. Visible if any cell is revealed. Editor checks the footprint. Special rule text: the Frozen Horror can squeeze through 1-square corridors.

**Terrain (#57, #60).** Icy river, ice ledge, chasm, ice vault: no effect on sight. Rule reminder on first reveal when Rule hints are on; always on tap.

**Ice tunnels (#58).** Paired markers with a design id (1, 2, 3...) drawn on the map. Note question "Did someone use it?" reveals the area at the other end. Tunnel rule (incl. landing on an occupied square pushes that figure to an adjacent square) shown with Rule hints and on tap.

---

## 4. Traps and hazards (#41 to #44)

| Kind | In the book | App |
|---|---|---|
| Stalactite | Detectable; first hero only; 1 BP; monsters don't spring it | "?"; once |
| Swinging axe | Detectable; 2 dice, no defend; hits every hero until disarmed | "?"; persistent after springing |
| Wandering monster trap | Undetectable; hero stops; quest wandering monsters attack; once | "?"; disarm always fails and springs |
| Slippery ice | Undetectable; roll per step, fall ends turn; jumpable once placed | "?"; disarm fails and springs; then visible terrain |
| Ice slide | Undetectable; hero slides to the end, roll for 1 BP; monsters can't enter; one way | "?" on the first square; disarm fails and springs; good jump reveals the whole slide; sprung = slide + reveal at the end |
| Chest traps | Note text | Decision 25 (hidden, "Search for traps" on the chest) |
| Decoys (optional) | n/a | Jump: passes, marker stays. Step or disarm: "nothing here", marker gone |

Several heroes can share the exit square of a slide; nobody stops in the middle.

---

## 5. Monsters and Zargon AI (#39, #46 to #52, #59)

Targets, profiles, weights, states, spell flow and tag questions: `ZARGON_AI.md`. Pack-specific data below.

**Stats (from the pack's charts and the prelude)**

| Monster | Move | Att | Def | Body | Mind | Profile |
|---|---|---|---|---|---|---|
| Frozen Horror | 8 | 5 | 4 | 6 | 4 | caster + large (2x2, attacks diagonally) |
| Ice Gremlin | 10 | 2 | 3 | 3 | 3 | thief (card text, "Escaped" button) |
| Polar Warbear | 6 | 4 / 4 | 3 | 6 | 2 | brute, 2 attacks |
| Yeti | 8 | 3 | 3 | 5 | 2 | grappler (card text; brute in solo quests while the setting is on) |
| Crossbowman | 6 | 3 | 3 | 2 | 2 | shooter |
| Halberdier | 6 | 3 | 3 | 2 | 2 | soldier, attacks diagonally |
| Scout | 9 | 2 | 3 | 2 | 2 | skirmisher |
| Swordsman | 5 | 4 | 5 | 2 | 2 | duelist |
| Krag (Q2) | 7 | 5 | 5 | 4 | 3 | duelist |
| Vilor (Q5) | 8 | 4 | 3 | 4 | 5 | caster: Chill, Ice Storm, Lightning Bolt, Sleep, Tempest |
| Kelvinos (Q7) | 5 | 4 | 4 | 4 | 0 | duelist |
| Jracksfot Rimebreath (Q0) | 8 | 3 | 3 | 4 | 4 | caster: Tempest |
| Wolf mummy (Q0 B) | as Mummy | | | | | relentless (name override) |
| Gothar (Q3, NPC) | 6 | 1 | 2 | 2 | 4 | NPC chip (decision 27), never a target |
| Snowdasher, wolf (Q0, animal ally) | 10 | 3 | 2 | 5 | 1 | team member, attacks diagonally; stats not tracked |

Named monsters carry their stats and spells in the quest data (decision 21). The generic monsters, their special rules (as Library abilities) and the six Frozen Horror spells are in `src/content/library/frozen-horror.json`, box "Frozen Horror".

Frozen Horror spells: Chill, Ice Storm, Ice Wall, Mind Freeze, Skate, Soothe + 6 random from core Dread spells (no Escape), changeable in setup (#47).

Quest overrides: Q0 C Warbear starts `passive` in the cage; Q1 B Crossbowman never moves and shoots every Zargon turn; Q3 excludes Gothar as a target; Q9–10 Gremlin "Escaped" asks "Was it the Crystal Key?".

Special rule texts (from the prelude's clarifications): multi-attack monsters, the hero may see the first attack before deciding to defend; Frozen Horror squeezes through 1-square corridors.

**Frozen Horror Dread spells** (tags from the owner's photo of the cards; tags only, no card text). Core spell tags: `ZARGON_AI.md`.

| Spell | Tags | Warning shown |
|---|---|---|
| Soothe | `selfHurt`, `allyHurt` | Can heal itself or another monster |
| Mind Freeze | `strongInSight` | |
| Ice Storm | `heroesGrouped` | Area spell, also hits monsters in the area |
| Skate | `noneInReach`, `selfNearDeath` | |
| Ice Wall | `canBlockPath` | |
| Chill | `heroAdjacent` | Hurts heroes and monsters next to it, not diagonally |

---

## 6. Notes (#53)

A note can have: public text → question on its letter → hidden text + effects.

| Note | Question | Effects |
|---|---|---|
| Q1 B | Did the Barbarian attack the Crossbowman from next to it? | Crossbowman `surrendered`; text: crossbow gained |
| Q4 B | Do the heroes free the Gremlin? | Steal text; Gremlin `freed` |
| Q5 B | Are all heroes in this room? | Remove both B doors; set flag → door C appears (hidden until flag) |
| Q5 C | (door opened) | Crypt monsters wake (dormant → active, decision 28), act next Zargon turn |
| Q3 E | (Dread warriors dead) | Spawn Gothar next to the Barbarian; escort objective to the stairway |
| Q8 G | Did a hero destroy the scepter (adjacent attack, at least one skull)? | Hidden: explosion 2 BP to all in the room; flag Scepter destroyed; objective done |
| Q9 A / Q10 G | Are all heroes on the stairway? | Clear board, switch map, reveal arrival room |
| Q9 F | (door tapped) | Key not found: door doesn't open (stuck, like decision 29). Found: "Is the hero with the key next to it?" |
| Q10 M | (treasure search, chest trap) | Flag key found |
| Q10 K | (reveal) | Conditional text if the key was stolen |
| Q4 E, Q6 G, Q8 F | (reveal) | Ice ledge rule reference |
| Q7 D, Q9 B | (reveal) | Living Fog rule reference |
| Q0 notes | see §8 | |

New effects: `removeDoor`, door `hiddenUntil: flag`, `removeMonster(reason)`, `excludeTarget`, `replaceFurnitureWithDoor(open)`, clear a sight blocker, `crossMap`.

---

## 7. Double quest Q9–10 (#45)

- `maps: [q9, q10]`, links stair A ↔ stair G, `activeMap`, one entry in the quest list. Letters unique across maps (A–F, G–M).
- Crossing is one event (undo and autosave work). Turn counter continues.
- Reset on crossing: fog, opened doors (found secret doors stay found).
- Kept: kills, monster damage, searches, traps, fired notes, flags, dead team members. Wandering monsters without a square on the old map disappear.
- End: Frozen Horror killed, wherever the heroes are.
- Editor: one tab per map, link tool, validation that every link has both ends.

---

## 8. Q0 prelude: Into the Northlands (#36, #38, #51, #56, #58)

Free online quest (Online Quest 2), solo for any hero. The hero gets the wolf Snowdasher as an animal ally (players use any spare figure or token for her). Uses Frozen Horror components: Ice Gremlins, Yeti, Polar Warbear, ice tunnels, slippery ice, stalactite traps, Gremlin treasure room tile, ice cave entrance tile.

**Team.** Warning "solo, any hero" (#38). The quest adds the wolf ally to the team list under the hero.

**Map.** Start on the ice cave entrance tile (left side). 3 ice tunnel pairs, each with its own design (#58). Several stalactites, 2 slippery ice squares, a pit-like square near F (to confirm in the import pass).

| Note | Trigger / question | Effects |
|---|---|---|
| Quest start | | Paraphrased intro; ally Snowdasher joins; tunnel rule (same design = linked) |
| A | treasure search | Text: tool kit and 2 healing potions |
| B | reveal | Wolf mummy; extra text if Snowdasher is in the team and alive (she howls) |
| C | "Was the lever pulled from the marked square?" | Cage removed (sight and squares open); Warbear stays `passive`; buttons "It left" / "A hero attacked it". Treasure search: longsword text |
| D | treasure search | Text: bracers and a healing potion |
| E | reveal | Gremlin treasure room: heroes get back items stolen in this quest (text only). Treasure search: helmet, potion, gold text |
| F | door | Flavor: intense cold from this door |
| G | reveal | Jracksfot Rimebreath on a frozen throne (caster, Tempest) and an active Yeti. Treasure search: gold + Armband of Ice (Frozen Horror artifact card) |
| G (kill) | Jracksfot killed | Throne becomes an open door to the cave entrance |
| End | on the cave tile | End dialog: "The hero left through the cave"; conclusion text, extra line if Snowdasher is in the team and alive |

**Playtest rules from the prelude, as app features.**
- No Yeti hug in solo quests: setting, on by default (#59).
- Free movement hint when no monster is active: part of the Rule hints setting (#60).
- Animal allies (#38).
- Clarifications in special rule texts (§5).

**Raiment of the Frozen Champion** (4 artifact cards printed in the prelude): campaign setting (#61). Artifact text is never in the app; kill notes only name the card.

---

## 9. Open items

- Check each spell's card wording against its tags and warnings before release.
- Q0 map: confirm the dark square near F (pit or other) during the import pass.
