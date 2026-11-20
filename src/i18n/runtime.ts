/**
 * Starts the language of the app (decision 92). `initI18n` runs once before the screens are loaded:
 * it reads the language chosen on this device, lays its data texts over the engine tables and makes
 * its strings the active ones. Changing the language later reloads the page, so no screen has to
 * redraw its texts and the bundled quests are built once, in the language in use.
 */
import { DexieLanguageStore, MemoryLanguageStore, type LanguageStore } from '../persist/languages';
import { applyDataStrings } from './dataText';
import { setActiveStrings, activeStrings } from './translate';
import { translateQuest } from './questText';

export const languageStore: LanguageStore =
  typeof location !== 'undefined' && new URLSearchParams(location.search).has('nosave')
    ? new MemoryLanguageStore()
    : new DexieLanguageStore();

let started = false;

export async function initI18n(store: LanguageStore = languageStore): Promise<void> {
  if (started) return;
  started = true;
  try {
    const code = await store.getActive();
    const file = code ? await store.load(code) : undefined;
    if (!file) return;
    setActiveStrings(file.strings);
    applyDataStrings(file.strings);
  } catch {
    /* a language that cannot be read: the app starts in English */
  }
}

/** A quest with the texts of the language in use (English changes nothing). */
export function inActiveLanguage<T>(quest: T): T {
  return translateQuest(quest, activeStrings());
}
