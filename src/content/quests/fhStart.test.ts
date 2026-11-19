import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseQuest } from '../../engine/quest/loader';

const dir = import.meta.dirname;
const files = readdirSync(dir).filter((f) => /^fh\d\d-.*\.json$/.test(f));

describe('the start message (when there is one) of every Frozen Horror quest', () => {
  it('finds the ten quest files (quests 0 to 8 and the double quest 9 and 10)', () => {
    expect(files).toHaveLength(10);
  });

  for (const f of files)
    it(`${f}: does not explain the ice tunnels`, () => {
      const quest = parseQuest(JSON.parse(readFileSync(resolve(dir, f), 'utf8')));
      const start = quest.notes.filter((n) => n.trigger.type === 'questStart');
      const text = JSON.stringify(start.map((n) => n.effects));
      expect(text).not.toMatch(/tunnel/i);
    });
});
