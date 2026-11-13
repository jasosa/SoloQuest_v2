/**
 * `npm run validate`: schema and board checks.
 * M0: checks the board file. Quest files (src/content/quests) are checked once the quest
 * schema exists (M1).
 */
import { readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { board, roomIds } from '../src/engine/board/board';

const rooms = roomIds(board);
if (rooms.length !== 22) {
  console.error(`board: expected 22 rooms, found ${rooms.length}`);
  process.exit(1);
}
console.log(`board: ${board.width} x ${board.height}, ${rooms.length} rooms: ok`);

const dir = resolve('src', 'content', 'quests');
const quests = existsSync(dir) ? readdirSync(dir).filter((f) => /^q\d\d-.*\.json$/.test(f)) : [];
if (quests.length)
  console.log(
    `quests: ${quests.length} file(s) found, quest schema arrives in M1 (not checked yet)`,
  );
else console.log('quests: none yet');
