/**
 * "Show room" (decision 66): a free tool that draws the floor and walls of one room, or of the
 * corridor squares in sight of one square, with nothing on them. Furniture, monsters, traps and
 * doors stay hidden until they are seen the normal way. Rock shows nothing and says so.
 */
import { areaAt, cellsOf, type Cell } from '../board/board';
import { cellKey, keyOf, sightMap, type Level } from '../board/level';
import { lineOfSight } from '../board/los';
import { EventError } from './errors';
import type { Prompt } from './prompts';
import { draftOf, type GameState } from './state';

export function showLayout(
  level: Level,
  state: GameState,
  cell: Cell,
): { state: GameState; prompts: Prompt[] } {
  const [x, y] = cell;
  const area = areaAt(level.board, x, y);
  if (!Number.isInteger(x) || !Number.isInteger(y) || area === undefined)
    throw new EventError('BAD_CELL', `Cell ${x},${y} is outside the board`);
  if (level.rock.has(cellKey(x, y)))
    throw new EventError('LAYOUT_ROCK', 'That is solid rock. There is nothing to show.');

  const found: string[] = [];
  if (area === 'C') {
    const map = sightMap(level, state.openDoors, state.placedBlocks, state.sightBlockers);
    for (let cy = 0; cy < level.board.height; cy++)
      for (let cx = 0; cx < level.board.width; cx++)
        if (
          areaAt(level.board, cx, cy) === 'C' &&
          !level.rock.has(cellKey(cx, cy)) &&
          lineOfSight(map, cell, [cx, cy])
        )
          found.push(cellKey(cx, cy));
  } else {
    for (const c of cellsOf(level.board, area)) if (!level.rock.has(keyOf(c))) found.push(keyOf(c));
  }
  const fresh = found.filter((k) => !state.layoutCells.has(k) && !state.seenCells.has(k));
  if (fresh.length === 0)
    throw new EventError('LAYOUT_KNOWN', 'That part of the map is already drawn.');
  const d = draftOf(state);
  for (const k of fresh) d.layoutCells.add(k);
  return { state: d, prompts: [{ kind: 'layoutShown', cells: fresh }] };
}
