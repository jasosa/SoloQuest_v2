/**
 * Starts the language of the app (decision 92). `initI18n` runs once before the screens are loaded:
 * it reads the language chosen on this device, lays its data texts over the engine tables and makes
 * its strings the active ones. Changing the language later reloads the page, so no screen has to
 * redraw its texts and the bundled quests are built once, in the language in use.
 */
import { DexieLanguageStore, MemoryLanguageStore, type LanguageStore } from '../persist/languages';
import { applyDataStrings, dataStrings } from './dataText';
import { effectiveStrings } from './file';
import { setActiveStrings, activeStrings } from './translate';
import { translateQuest } from './questText';

export const languageStore: LanguageStore =
  typeof location !== 'undefined' && new URLSearchParams(location.search).has('nosave')
    ? new MemoryLanguageStore()
    : new DexieLanguageStore();

let started = false;
/** The English data texts, taken before a language is laid over the tables. */
let englishData: Record<string, string> | undefined;

/** The English texts of the data tables and the Core library (never translated). */
export function englishDataStrings(): Record<string, string> {
  return englishData ?? dataStrings();
}

export async function initI18n(store: LanguageStore = languageStore): Promise<void> {
  if (started) return;
  started = true;
  try {
    const edited = await store.englishEdited();
    const mine = edited ? await store.load('en') : undefined;
    const update = edited ? await store.load('en-core') : undefined;
    const code = await store.getActive();
    const file = code ? await store.load(code) : undefined;
    const strings = effectiveStrings(update?.strings, mine?.strings, file?.strings);
    if (Object.keys(strings).length === 0) return;
    englishData = dataStrings();
    setActiveStrings(strings);
    applyDataStrings(strings);
  } catch {
    /* a language that cannot be read: the app starts in English */
  }
}

/** A quest with the texts of the language in use (English changes nothing). */
export function inActiveLanguage<T>(quest: T): T {
  return translateQuest(quest, activeStrings());
}
