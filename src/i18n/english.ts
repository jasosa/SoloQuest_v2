/**
 * The English file, built from the app itself (decision 92): the interface catalogue (`en.json`),
 * the texts of the data tables and the Core library, and the texts of the quests it is given.
 * It is never stored and never edited: a user makes a copy.
 */
import { dataStrings } from './dataText';
import ui from './en.json';
import { questStrings } from './questText';

export const interfaceStrings: Readonly<Record<string, string>> = ui;

/** English for the interface, the library, and each quest in `quests` (raw files or parsed quests). */
export function englishStrings(quests: readonly unknown[]): Record<string, string> {
  const out: Record<string, string> = { ...ui, ...dataStrings() };
  for (const q of quests) Object.assign(out, questStrings(q));
  return out;
}
