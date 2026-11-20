/**
 * Starts the language before anything that builds quests (decision 92). Import this module for its
 * effect: it waits (top-level await) until the language in use is read and laid over the tables, so
 * the modules that import it run after. With English nothing is read, so the wait is a few microtasks.
 */
import '../content/core'; // the Core library, so its items are translated too
import { initI18n } from './runtime';

await initI18n();
