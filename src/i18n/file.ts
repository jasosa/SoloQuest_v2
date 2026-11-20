/**
 * The translation file (decision 92): JSON with a header and a map of key to text. The app supplies
 * the English one; users copy it and change the texts. Keys that are missing fall back to English.
 */
import { z } from 'zod';
import { placeholdersOf } from './translate';

export const LANGUAGE_FORMAT = 'soloquest-language';
export const LANGUAGE_EXTENSION = '.sqlang.json';
/** A file bigger than this is refused before it is read. */
export const LANGUAGE_MAX_BYTES = 5 * 1024 * 1024;
export const MAX_STRINGS = 60_000;
export const MAX_TEXT_LENGTH = 4000;

export const ENGLISH_CODE = 'en';

const CODE = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;

export const LanguageFileSchema = z.object({
  format: z.literal(LANGUAGE_FORMAT, {
    error: 'This is not a SoloQuest translation file.',
  }),
  version: z.literal(1, { error: 'This translation file has a version this app does not know.' }),
  language: z.object({
    name: z.string().trim().min(1, 'The language needs a name.').max(60),
    code: z.string().regex(CODE, 'The language code looks like "es" or "pt-BR".'),
  }),
  author: z.string().max(120).optional(),
  /** The version of the English file this one was made from (see `baseOf`). */
  base: z.string().max(40),
  strings: z.record(z.string().min(1).max(300), z.string().max(MAX_TEXT_LENGTH)),
});

export type LanguageFile = z.infer<typeof LanguageFileSchema>;

export type ParsedLanguage =
  | { readonly ok: true; readonly file: LanguageFile }
  | { readonly ok: false; readonly message: string };

/** Reads the text of a translation file. Never throws: the message is for the player. */
export function parseLanguageFile(text: string): ParsedLanguage {
  if (text.length > LANGUAGE_MAX_BYTES)
    return { ok: false, message: 'This file is too big for a translation (5 MB at most).' };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, message: 'This file is not a translation file: it is not valid JSON.' };
  }
  const r = LanguageFileSchema.safeParse(raw);
  if (!r.success) {
    const issue = r.error.issues[0];
    const where = issue && issue.path.length ? ` (${issue.path.slice(0, 3).join(' > ')})` : '';
    return { ok: false, message: `${issue?.message ?? 'The file is not valid.'}${where}` };
  }
  if (Object.keys(r.data.strings).length > MAX_STRINGS)
    return { ok: false, message: 'This translation has too many texts.' };
  if (r.data.language.code === ENGLISH_CODE)
    return {
      ok: false,
      message: 'The English file is supplied by the app. Change the language code to add a copy.',
    };
  return { ok: true, file: r.data };
}

/** A short version name for an English text set: it changes when a key or a text changes. */
export function baseOf(english: Readonly<Record<string, string>>): string {
  let h = 2166136261;
  for (const k of Object.keys(english).sort()) {
    for (const c of `${k}\u0000${english[k]}\u0001`) {
      h ^= c.codePointAt(0)!;
      h = Math.imul(h, 16777619) >>> 0;
    }
  }
  return `en-${h.toString(16).padStart(8, '0')}`;
}

export function languageToText(file: LanguageFile): string {
  const sorted: Record<string, string> = {};
  for (const k of Object.keys(file.strings).sort()) sorted[k] = file.strings[k]!;
  return JSON.stringify({ ...file, strings: sorted }, null, 2) + '\n';
}

/** A new language made from English: every key present, holding the English text to change. */
export function copyOfEnglish(
  english: Readonly<Record<string, string>>,
  name: string,
  code: string,
  author?: string,
): LanguageFile {
  return {
    format: LANGUAGE_FORMAT,
    version: 1,
    language: { name: name.trim(), code },
    ...(author ? { author } : {}),
    base: baseOf(english),
    strings: { ...english },
  };
}

/** Keys of a language that English does not have, and keys of English it lacks or leaves empty. */
export function compare(
  english: Readonly<Record<string, string>>,
  strings: Readonly<Record<string, string>>,
): { extra: string[]; missing: string[]; sameAsEnglish: string[] } {
  const extra = Object.keys(strings).filter((k) => !(k in english));
  const missing = Object.keys(english).filter((k) => !strings[k]);
  const sameAsEnglish = Object.keys(english).filter(
    (k) => strings[k] !== undefined && strings[k] === english[k],
  );
  return { extra, missing, sameAsEnglish };
}

/** A translation must keep the `{names}` of the English text (they are filled in at play time). */
export function placeholderProblem(english: string, text: string): string | undefined {
  if (!text) return undefined;
  const need = placeholdersOf(english);
  const have = placeholdersOf(text);
  const lost = need.filter((n) => !have.includes(n));
  const added = have.filter((n) => !need.includes(n));
  if (lost.length) return `Missing ${lost.map((n) => `{${n}}`).join(', ')}`;
  if (added.length) return `Unknown ${added.map((n) => `{${n}}`).join(', ')}`;
  return undefined;
}

/** The area of a key: where it is shown, for filters and progress. */
export function areaOf(key: string): string {
  if (key.startsWith('quest:')) return key.split(':')[1] ?? 'quest';
  if (key.startsWith('data:') || key.startsWith('library:')) return 'library';
  return 'interface';
}
