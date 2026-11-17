/**
 * Loads the Core library files (`src/content/library/*.json`, decision 76) when the app starts.
 * Importing this module applies them once, in file name order. The files are made by "Export
 * Core" in the Designer.
 */
import { applyCoreFile, parseCoreFile } from '../engine/data/coreFile';
import { readPending } from './corePending';

const files = import.meta.glob('./library/*.json', { eager: true, import: 'default' }) as Record<
  string,
  unknown
>;

let done = false;
/** Apply the Core files. Safe to call more than once. Returns how many items they hold. */
export function loadCore(data: Record<string, unknown> = files): number {
  if (done && data === files) return 0;
  if (data === files) done = true;
  let n = 0;
  for (const name of Object.keys(data).sort()) {
    const file = parseCoreFile(data[name]);
    if (!file) continue;
    applyCoreFile(file);
    n += file.items.length;
  }
  return n;
}

loadCore();
// What the owner took out of Core on this device and has not exported yet.
applyCoreFile(readPending());
