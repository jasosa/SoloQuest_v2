/**
 * The texts that live in the engine's data tables and in the Core library (decision 92): trap
 * kinds, spells, abilities, monster and hero names, room and board tiles, the Zargon rule and plan
 * lines. Each text is an entry with a key (`data:trapKinds.pit.lines.0`, `library:ability:stone.text`)
 * and a getter and setter on the live table. `applyDataStrings` lays a translation over the tables
 * and gives back a function that puts the English back (tests use it; the app applies one language
 * at startup and reloads to change it).
 */
import { CORE_ABILITIES } from '../engine/data/abilities';
import { CORE_EXTRA } from '../engine/data/coreFile';
import { HERO_NAMES } from '../engine/data/heroes';
import { MONSTER_NAMES } from '../engine/data/monsters';
import { BOARD_TILES, ROOM_TILES } from '../engine/data/roomTiles';
import { CORE_SPELLS, SPELL_TAG_QUESTIONS, SPELL_TIMING_TEXT } from '../engine/data/spells';
import { TRAP_KINDS_DATA } from '../engine/data/trapKinds';
import { PLAN_TEXT, RULE_TEXT } from '../engine/zargon/texts';
import type { Strings } from './translate';

interface Entry {
  readonly key: string;
  get(): string | undefined;
  set(text: string): void;
}

type Bag = Record<string, unknown>;

/** Entries for a string field and a string list of one object. */
function fields(prefix: string, obj: Bag, names: readonly string[], out: Entry[]): void {
  for (const f of names) {
    const v = obj[f];
    if (typeof v === 'string')
      out.push({ key: `${prefix}.${f}`, get: () => obj[f] as string, set: (t) => (obj[f] = t) });
    else if (Array.isArray(v))
      v.forEach((line, i) => {
        if (typeof line === 'string')
          out.push({
            key: `${prefix}.${f}.${i}`,
            get: () => (obj[f] as string[])[i],
            set: (t) => ((obj[f] as string[])[i] = t),
          });
      });
  }
}

/** A table of one text per id (`Record<id, string>`). */
function table(prefix: string, rec: Record<string, string>, out: Entry[]): void {
  for (const id of Object.keys(rec))
    out.push({ key: `${prefix}.${id}`, get: () => rec[id], set: (t) => (rec[id] = t) });
}

function entries(): Entry[] {
  const out: Entry[] = [];
  for (const [id, def] of Object.entries(TRAP_KINDS_DATA))
    fields(`data:trapKinds.${id}`, def as unknown as Bag, ['name', 'title', 'lines'], out);
  table('data:spellTags', SPELL_TAG_QUESTIONS as Record<string, string>, out);
  table('data:spellTiming', SPELL_TIMING_TEXT as Record<string, string>, out);
  table('data:monsters', MONSTER_NAMES as Record<string, string>, out);
  table('data:heroes', HERO_NAMES as Record<string, string>, out);
  table('data:zargonRules', RULE_TEXT as Record<string, string>, out);
  table('data:zargonPlans', PLAN_TEXT as Record<string, string>, out);
  for (const [id, def] of Object.entries(ROOM_TILES))
    fields(`data:roomTiles.${id}`, def as unknown as Bag, ['name', 'rule'], out);
  for (const [id, def] of Object.entries(BOARD_TILES))
    fields(`data:boardTiles.${id}`, def as unknown as Bag, ['name', 'rule'], out);
  for (const s of CORE_SPELLS)
    fields(
      `library:spell:${s.id}`,
      s as unknown as Bag,
      ['name', 'text', 'question', 'warning'],
      out,
    );
  for (const a of CORE_ABILITIES)
    fields(`library:ability:${a.id}`, a as unknown as Bag, ['name', 'text'], out);
  for (const kind of ['enemy', 'hero', 'companion'] as const)
    for (const it of CORE_EXTRA[kind])
      fields(`library:${kind}:${it.data.id}`, it.data as Bag, ['name', 'text', 'traits'], out);
  return out;
}

/** The English text of every data text, by key. Read after the Core library files are applied. */
export function dataStrings(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const e of entries()) {
    const v = e.get();
    if (v) out[e.key] = v;
  }
  return out;
}

/** Lays the translated data texts over the tables. Returns a function that restores the English. */
export function applyDataStrings(strings: Strings): () => void {
  const undo: (() => void)[] = [];
  for (const e of entries()) {
    const own = strings[e.key];
    const before = e.get();
    if (own === undefined || own === '' || before === undefined) continue;
    e.set(own);
    undo.push(() => e.set(before));
  }
  return () => undo.reverse().forEach((u) => u());
}
