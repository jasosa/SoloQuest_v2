/**
 * Every Frozen Horror quest against the tile table (decision 88): sizes, limits per quest, tunnels,
 * the ice slide. The test reports every deviation. `KNOWN` lists the ones the owner has to check
 * against the book: a new deviation fails the test, so does one that has been fixed but not removed.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { board } from '../../engine/board/board';
import { parseQuest } from '../../engine/quest/loader';
import { validateQuestIssues } from '../../engine/quest/validate';

const dir = import.meta.dirname;
const files = readdirSync(dir).filter((f) => /^fh\d+.*\.json$/.test(f));

/** Deviations that cannot be judged without the book. */
const KNOWN: readonly string[] = [
  // The ice ledge of quest 5 is drawn 4 x 4 (21..24, 10..13). The tile comes as 5 x 3.
  'fh05-the-deadly-depths.json|Ice ledge comes as 5 x 3, these squares are 4 x 4',
];

describe('the Frozen Horror quests keep to the tile sizes and limits', () => {
  it('has ten quest files', () => {
    expect(files).toHaveLength(10);
  });

  it('reports every deviation', () => {
    const found: string[] = [];
    for (const f of files) {
      const quest = parseQuest(JSON.parse(readFileSync(resolve(dir, f), 'utf8')));
      for (const i of validateQuestIssues(quest, board))
        if (/tile|tunnel|slide/.test(i.message))
          found.push(
            `${f}|${i.message
              .replace(/^Map [^:]*: /, '')
              .replace(/^(board|room) tile \d+ \(\w+\): /, '')}`,
          );
    }
    expect(found.sort()).toEqual([...KNOWN].sort());
  });
});
