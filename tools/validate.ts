/**
 * `npm run validate`: board check, then parse + semantic check of every quest file
 * in src/content/quests (none yet is fine).
 */
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { board, roomIds } from '../src/engine/board/board';
import { applyCoreFile, parseCoreFile } from '../src/engine/data/coreFile';
import { parseQuest } from '../src/engine/quest/loader';
import { validateQuest } from '../src/engine/quest/validate';

const rooms = roomIds(board);
if (rooms.length !== 22) {
  console.error(`board: expected 22 rooms, found ${rooms.length}`);
  process.exit(1);
}
console.log(`board: ${board.width} x ${board.height}, ${rooms.length} rooms: ok`);

// The Core library files change what counts as a core ability or spell (decision 76).
const coreDir = resolve('src', 'content', 'library');
if (existsSync(coreDir))
  for (const f of readdirSync(coreDir)
    .filter((x) => x.endsWith('.json'))
    .sort()) {
    const core = parseCoreFile(JSON.parse(readFileSync(resolve(coreDir, f), 'utf8')));
    if (core) applyCoreFile(core);
  }

const dir = resolve('src', 'content', 'quests');
const files = existsSync(dir)
  ? readdirSync(dir)
      .filter((f) => /^q\d\d-.*\.json$/.test(f))
      .sort()
  : [];

let failed = 0;
for (const f of files) {
  try {
    const quest = parseQuest(JSON.parse(readFileSync(resolve(dir, f), 'utf8')));
    const problems = validateQuest(quest, board);
    if (problems.length) {
      failed++;
      console.error(`${f}: ${problems.length} problem(s)`);
      for (const p of problems) console.error(`  - ${p}`);
    } else console.log(`${f}: ok`);
  } catch (e) {
    failed++;
    console.error(`${f}: ${(e as Error).message}`);
  }
}
if (files.length === 0) console.log('quests: none yet');
if (failed) process.exit(1);
