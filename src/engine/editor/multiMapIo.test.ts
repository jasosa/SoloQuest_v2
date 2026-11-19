import { describe, expect, it } from 'vitest';
import { testMapsQuest } from '../quest/testMaps';
import { exportQuest, exportQuestChecked, importQuest } from './io';

describe('a multi-map quest in the editor files', () => {
  const quest = testMapsQuest();

  it('exports every map field and links, in a stable place', () => {
    const data = JSON.parse(exportQuest(quest)) as Record<string, unknown>;
    expect(data.maps).toEqual(JSON.parse(JSON.stringify(quest.maps)));
    expect(data.links).toEqual(JSON.parse(JSON.stringify(quest.links)));
    expect(data.mapId).toBe('one');
    expect(data.mapName).toBe('The Upper Hall');
    const keys = Object.keys(data);
    expect(keys.indexOf('mapId')).toBeLessThan(keys.indexOf('start'));
    expect(keys.indexOf('zones')).toBeLessThan(keys.indexOf('maps'));
    expect(keys.indexOf('maps')).toBeLessThan(keys.indexOf('notes'));
    // the note map and the crossMap effect are kept
    const notes = data.notes as { id: string; map?: string }[];
    expect(notes.find((n) => n.id === 'ask2')?.map).toBe('two');
  });

  it('imports what it exported, unchanged', () => {
    const checked = exportQuestChecked(quest);
    expect(checked.ok).toBe(true);
    if (!checked.ok) return;
    const back = importQuest(checked.text);
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(back.quest).toEqual(quest);
    expect(exportQuest(back.quest)).toBe(checked.text);
  });

  it('refuses a quest with a broken link, with a readable error', () => {
    const bad = JSON.parse(exportQuest(quest)) as Record<string, unknown>;
    bad.links = [{ id: 'l1', a: { map: 'one', cell: [1, 15] }, b: { map: 'zzz', cell: [1, 1] } }];
    const r = importQuest(JSON.stringify(bad));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join('\n')).toMatch(/unknown map zzz/);
  });
});
