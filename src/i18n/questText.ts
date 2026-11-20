/**
 * Which fields of a quest are text (decision 92). A quest file is not rewritten to be translated:
 * every text has a key made from where it lives, `quest:<quest id>:<path>`. In the path an item of
 * a list is named by its `id` when it has one (`notes.n-B.effects.0.text`), else by its position.
 * A translation is an overlay laid over the parsed quest when it is loaded, so the engine never
 * sees a difference. Ids, enum values, squares and flags are never text.
 */
import type { Strings } from './translate';

/** An effect, or an effect inside a choice option, at any depth. */
const E = String.raw`effects\.\*(?:\.options\.\*\.effects\.\*)*`;
/** Board fields live at the top of a quest and inside each extra map. */
const B = String.raw`(?:maps\.\*\.)?`;

/**
 * The text fields, as patterns over the shape of a path (`*` stands for an id or a position).
 * Add a line here when the schema gets a new text field: the quest test fails until you do.
 */
export const QUEST_TEXT_PATTERNS: readonly RegExp[] = [
  /^title$/,
  /^intro\.(?:summary|userText)$/,
  /^mapName$/,
  /^maps\.\*\.name$/,
  /^rewards$/,
  /^endText$/,
  /^leave$/,
  /^wandering\.text$/,
  /^rules\.fallingBlock$/,
  new RegExp(String.raw`^${B}notes\.\*\.trigger\.(?:label|hint)$`),
  new RegExp(String.raw`^${B}notes\.\*\.${E}\.(?:text|title)$`),
  new RegExp(String.raw`^${B}notes\.\*\.${E}\.options\.\*\.label$`),
  new RegExp(String.raw`^${B}monsters\.\*\.name$`),
  new RegExp(String.raw`^${B}monsters\.\*\.traits\.\*$`),
  new RegExp(String.raw`^${B}traps\.\*\.effect$`),
  /^enemyDefs\.\*\.(?:name|traits\.\*)$/,
  /^abilityDefs\.\*\.(?:name|text)$/,
  /^spellDefs\.\*\.(?:name|text|question|warning)$/,
  /^spellDefs\.\*\.situations\.\*\.question$/,
  /^npcs\.\*\.(?:name|text)$/,
  /^objectives\.\*\.(?:text|confirm)$/,
  /^endings\.\*\.(?:label|text)$/,
];

/**
 * String fields that hold words but are not text to translate: names of boxes. Everything else that
 * looks like prose and is not in `QUEST_TEXT_PATTERNS` fails the coverage test.
 */
export const QUEST_TEXT_EXCLUDED: readonly RegExp[] = [/\.expansion$/];

const isText = (shape: string) => QUEST_TEXT_PATTERNS.some((p) => p.test(shape));

type Json = unknown;

/** The segment of a list item: its id when it has one and the ids of the list are unique. */
function segments(list: readonly Json[]): string[] {
  const ids = list.map((x) =>
    x && typeof x === 'object' && typeof (x as { id?: unknown }).id === 'string'
      ? (x as { id: string }).id
      : undefined,
  );
  const unique = ids.every((v) => v !== undefined) && new Set(ids).size === ids.length;
  return list.map((_, i) => (unique ? ids[i]! : String(i)));
}

function walk(
  value: Json,
  key: string[],
  shape: string[],
  visit: (key: string, shape: string, text: string) => string | undefined,
): Json {
  if (typeof value === 'string') {
    const shapePath = shape.join('.');
    if (!isText(shapePath)) return value;
    return visit(key.join('.'), shapePath, value) ?? value;
  }
  if (Array.isArray(value)) {
    const segs = segments(value);
    let changed = false;
    const out = value.map((v, i) => {
      const r = walk(v, [...key, segs[i]!], [...shape, '*'], visit);
      if (r !== v) changed = true;
      return r;
    });
    return changed ? out : value;
  }
  if (value && typeof value === 'object') {
    let changed = false;
    const out: Record<string, Json> = {};
    for (const [k, v] of Object.entries(value as Record<string, Json>)) {
      const r = walk(v, [...key, k], [...shape, k], visit);
      if (r !== v) changed = true;
      out[k] = r;
    }
    return changed ? out : value;
  }
  return value;
}

/** The id of a quest object (a raw file or a parsed quest). */
export function questIdOf(quest: unknown): string | undefined {
  const id = (quest as { id?: unknown } | null)?.id;
  return typeof id === 'string' ? id : undefined;
}

/** The English text of every translatable field of a quest, by key. */
export function questStrings(quest: unknown): Record<string, string> {
  const id = questIdOf(quest);
  const out: Record<string, string> = {};
  if (!id) return out;
  walk(quest, [], [], (key, _shape, text) => {
    if (text !== '') out[`quest:${id}:${key}`] = text;
    return undefined;
  });
  return out;
}

/**
 * The quest with the translated texts laid over it. A key that is missing (or empty) keeps the
 * English text; a key that the quest does not have is ignored. The same object when nothing changes.
 */
export function translateQuest<T>(quest: T, strings: Strings): T {
  const id = questIdOf(quest);
  if (!id) return quest;
  const prefix = `quest:${id}:`;
  if (!Object.keys(strings).some((k) => k.startsWith(prefix))) return quest;
  return walk(quest, [], [], (key) => {
    const own = strings[prefix + key];
    return own !== undefined && own !== '' ? own : undefined;
  }) as T;
}

/** Every string of a quest that is not a text field and still looks like prose (for tests and the editor). */
export function uncoveredProse(quest: unknown): string[] {
  const out: string[] = [];
  const scan = (v: Json, shape: string[]) => {
    if (typeof v === 'string') {
      const s = shape.join('.');
      if (!isText(s) && /\s/.test(v.trim()) && !QUEST_TEXT_EXCLUDED.some((p) => p.test(s)))
        out.push(`${s}: ${v.slice(0, 40)}`);
    } else if (Array.isArray(v)) v.forEach((x) => scan(x, [...shape, '*']));
    else if (v && typeof v === 'object')
      for (const [k, x] of Object.entries(v)) scan(x, [...shape, k]);
  };
  scan(quest, []);
  return out;
}
