/**
 * Starts the language before anything that builds quests (decision 92). Import this module for its
 * effect: it waits (top-level await) until the language in use is read and laid over the tables, so
 * the modules that import it run after. With English nothing is read, so the wait is a few microtasks.
 */
import '../content/core'; // the Core library, so its items are translated too
import { initI18n } from './runtime';

// A store that never answers must not leave the app on a blank screen: English after 2.5 s.
await Promise.race([initI18n(), new Promise<void>((done) => setTimeout(done, 2500))]);
