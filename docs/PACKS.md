# Quest packs (decision 36, M9)

Status: the manifest, the registry and the two packs `core` and `frozen-horror` are built. Campaign mode, the free team list and the rest of M9 are in the backlog; Frozen Horror itself is M10 (`FROZEN_HORROR.md`).

## What a pack is

The base game is the pack `core`. Every expansion is a pack that depends on it. A pack is a manifest, `src/content/packs/<id>.json`:

```json
{
  "schemaVersion": 1,
  "id": "frozen-horror",
  "name": "Frozen Horror",
  "description": "A sentence in the owner's words.",
  "dependsOn": ["core"],
  "quests": ["fh00-into-the-northlands", "fh01-xanon-pass"],
  "campaignSettings": [
    { "id": "raiment-of-the-frozen-champion", "name": "Raiment of the Frozen Champion", "text": "What it does.", "default": false }
  ]
}
```

- `quests` are quest ids (the `id` of the files in `src/content/quests/`), in **campaign order**. A pack may hold extra quests that the book does not number (Frozen Horror Q0, the online prelude): a quest `number` may be 0.
- `team` lists what the New game popup offers for the pack (decision 38): `heroes` (`{ id, name, as }`, `as` is the core hero it plays as), `mercenaries` and `allies` (`{ id, name }`). A mercenary or an animal of any name can also be typed in.
- `campaignSettings` are the choices made when a campaign starts (decision 61); they are off unless `default` says so.
- Monsters, spells, heroes, mercenaries and the like are **not** in the manifest. They are Core library items tagged with the pack's name as their `expansion` (decision 76, `LIBRARY_LAYERS.md`), so the Library, the expansion switches and the editor already treat them as part of the pack.

## Campaign and one-shot (decision 37)

The New game popup asks One-shot or Campaign. A campaign is kept per pack on this device (`src/persist/campaigns.ts`): finished quests, the flags quests hand on (`flagsOut`, read by later quests as `flagsIn`), the last team, the campaign settings and the campaign seed. A one-shot starts every `flagsIn` flag at its `oneShot` value. See decision 89.

## What the registry checks (`src/engine/pack/registry.ts`, `npm run validate`)

- Pack ids are unique, and a `core` pack exists and depends on nothing.
- Every other pack depends on `core`, directly or through another pack. Dependencies exist and do not form a circle. The registry lists packs dependencies first.
- Every listed quest exists, is listed by one pack only, and every quest file is listed by some pack. A quest file may say `"pack": "..."`; it must agree with the pack that lists it. A quest made on this device (the editor) is in no pack.

## Where things go

| What | Where |
|---|---|
| Pack manifest | `src/content/packs/<id>.json` |
| Quest of a pack | `src/content/quests/<id>.json` (its `id` goes in the manifest) |
| Monsters, spells, heroes, allies of a pack | a Core file `src/content/library/<pack>.json`, each item with `"expansion": "<pack name>"` |
| Book PDFs (never in git) | `C:\Users\Juanan\Documents\Games\Heroquest\01_Rules\Official\` |
| Rendered map pages (never in git) | `reference/maps/` |

## Frozen Horror: what is ready and what is waiting

Ready: the pack exists with no quests, and the "Raiment of the Frozen Champion" campaign setting. Waiting for the book: the encoding of Q0 and Q1 to Q10 needs the maps of the Frozen Horror Quest Pack and of the prelude (put the PDFs in the folder above). The engine and editor work for it does not.
