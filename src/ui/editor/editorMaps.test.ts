import { describe, expect, it } from 'vitest';
import { addMap, addMonster, emptyQuest, swapTo } from '../../engine/editor';
import { testMapsQuest } from '../../engine/quest/testMaps';
import { MemoryUserQuestStore } from '../../persist/userQuests';
import { createEditorStore } from './editorStore';

const make = () =>
  createEditorStore({ quest: testMapsQuest(), store: new MemoryUserQuestStore(), now: () => 5 });

describe('editor store with two maps', () => {
  it('shows map 1 first and switches the quest on top with setMap', () => {
    const s = make();
    expect(s.getState().mapId).toBe('one');
    expect(s.getState().quest.monsters.map((m) => m.id)).toEqual(['m1']);
    s.getState().setMap('two');
    expect(s.getState().mapId).toBe('two');
    expect(s.getState().quest.monsters.map((m) => m.id)).toEqual(['m2']);
    expect(s.getState().canon).toEqual(testMapsQuest());
  });

  it('an edit on map 2 goes to map 2, keeps the canonical form, new ids skip the other map', () => {
    const s = make();
    s.getState().setMap('two');
    expect(s.getState().apply((q) => addMonster(q, 'orc', [6, 1]))).toBe(true);
    const canon = s.getState().canon;
    expect(canon.mapId).toBe('one');
    expect(canon.monsters.map((m) => m.id)).toEqual(['m1']);
    expect(canon.maps?.[0]?.monsters.map((m) => m.id)).toEqual(['m2', 'm3']);
    expect(s.getState().canon).not.toBe(s.getState().clean);
  });

  it('undo and redo work across a map switch and keep the map on show', () => {
    const s = make();
    s.getState().setMap('two');
    s.getState().apply((q) => addMonster(q, 'orc', [6, 1]));
    s.getState().setMap('one');
    s.getState().undo();
    expect(s.getState().mapId).toBe('one');
    expect(s.getState().canon).toEqual(testMapsQuest());
    s.getState().setMap('two');
    s.getState().redo();
    expect(s.getState().quest.monsters.map((m) => m.id)).toEqual(['m2', 'm3']);
  });

  it('a map change is one undo step; deleting the map on show falls back to map 1', () => {
    const s = createEditorStore({
      quest: emptyQuest({ id: 'u', number: 1, title: 'T' }),
      store: new MemoryUserQuestStore(),
      now: () => 5,
    });
    expect(s.getState().applyQuest((q) => addMap(q, { name: 'Below' }))).toBe(true);
    s.getState().setMap('map2');
    expect(s.getState().quest.mapId).toBe('map2');
    expect(
      s.getState().applyQuest((q) => ({ ok: true, quest: swapTo(q, 'map1'), warnings: [] })),
    ).toBe(true);
    s.getState().undo();
    expect(s.getState().canon.maps).toBeUndefined();
    expect(s.getState().mapId).toBe('map1');
  });

  it('a draft of a double quest is saved in canonical form', async () => {
    const mem = new MemoryUserQuestStore();
    const s = createEditorStore({
      quest: testMapsQuest({ id: 'user-maps' }),
      store: mem,
      now: () => 5,
    });
    s.getState().setMap('two');
    s.getState().apply((q) => addMonster(q, 'orc', [6, 1]));
    await s.getState().flush();
    const draft = await mem.loadDraft('user-maps');
    expect(draft?.quest.mapId).toBe('one');
    expect(draft?.quest.maps?.[0]?.monsters.length).toBe(2);
  });
});
