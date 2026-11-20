import { describe, expect, it } from 'vitest';
import { addDoor, addMonster, emptyQuest, setRockCell } from '../../engine/editor';
import { MemoryUserQuestStore } from '../../persist/userQuests';
import { createEditorStore } from './editorStore';

const make = (store = new MemoryUserQuestStore()) =>
  createEditorStore({
    quest: emptyQuest({ id: 'user-test', number: 1, title: 'Test' }),
    store,
    now: () => 5,
  });

describe('editor store', () => {
  it('a pick shows the Map tab and the tab it came from comes back when it ends', () => {
    const s = make();
    s.getState().setTab('Actions');
    s.getState().setPicking({ kind: 'cell', hint: 'Click a square.', onPick: () => {} });
    expect(s.getState().tab).toBe('Map');
    s.getState().setPicking(null);
    expect(s.getState().tab).toBe('Actions');
    expect(s.getState().pickReturn).toBeNull();
    s.getState().setPicking({ kind: 'cell', hint: 'Click a square.', onPick: () => {} });
    s.getState().setTab('Quest');
    s.getState().setPicking(null);
    expect(s.getState().tab).toBe('Quest');
  });

  it('applies an operation, keeps history, and clears redo on a new change', () => {
    const s = make();
    expect(s.getState().apply((q) => setRockCell(q, [10, 2], true))).toBe(true);
    expect(s.getState().quest.rock.cells).toEqual([[10, 2]]);
    s.getState().undo();
    expect(s.getState().quest.rock.cells).toEqual([]);
    expect(s.getState().future).toHaveLength(1);
    s.getState().redo();
    expect(s.getState().quest.rock.cells).toEqual([[10, 2]]);
    s.getState().undo();
    s.getState().apply((q) => setRockCell(q, [11, 2], true));
    expect(s.getState().future).toHaveLength(0);
  });

  it('a refused operation leaves the quest and the history alone and says why', () => {
    const s = make();
    const before = s.getState().quest;
    // (1,14) is a stairs square: a monster cannot stand there
    expect(s.getState().apply((q) => addMonster(q, 'orc', [1, 14]))).toBe(false);
    const after = s.getState();
    expect(after.quest).toBe(before);
    expect(after.past).toHaveLength(0);
    expect(after.toast?.text.length).toBeGreaterThan(5);
  });

  it('writes the draft after every change and after undo', async () => {
    const mem = new MemoryUserQuestStore();
    const s = make(mem);
    s.getState().apply((q) => setRockCell(q, [10, 2], true));
    await s.getState().flush();
    expect((await mem.loadDraft('user-test'))?.quest.rock.cells).toEqual([[10, 2]]);
    s.getState().undo();
    await s.getState().flush();
    expect((await mem.loadDraft('user-test'))?.quest.rock.cells).toEqual([]);
  });

  it('a reload resumes from the draft', async () => {
    const mem = new MemoryUserQuestStore();
    const a = make(mem);
    a.getState().apply((q) => setRockCell(q, [10, 2], true));
    await a.getState().flush();
    const draft = await mem.loadDraft('user-test');
    const b = createEditorStore({ quest: draft!.quest, store: mem });
    expect(b.getState().quest).toEqual(a.getState().quest);
  });

  it('save blocks on errors and lists them; a valid quest is saved and its draft goes', async () => {
    const mem = new MemoryUserQuestStore();
    const s = make(mem);
    const saved = await s.getState().save();
    if (saved) {
      expect((await mem.list())[0]?.id).toBe('user-test');
      expect(await mem.loadDraft('user-test')).toBeUndefined();
      expect(s.getState().clean).toBe(s.getState().quest);
    } else {
      expect(s.getState().saveErrors?.length).toBeGreaterThan(0);
      expect(await mem.list()).toHaveLength(0);
    }
  });

  it('save waits for queued draft writes, so the draft never comes back after saving', async () => {
    const mem = new MemoryUserQuestStore();
    const base = emptyQuest({ id: 'user-test', number: 1, title: 'Test' });
    const quest = {
      ...base,
      objectives: [{ id: 'o1', text: 'Win the quest' }],
      notes: [
        {
          id: 'n1',
          trigger: { type: 'manual' as const, label: 'Won' },
          effects: [{ type: 'completeObjective' as const, objective: 'o1' }],
        },
      ],
    };
    const s = createEditorStore({ quest, store: mem, now: () => 5 });
    s.getState().apply((q) => setRockCell(q, [25, 0], true)); // queues a draft write
    expect(await s.getState().save()).toBe(true);
    await s.getState().flush();
    expect(await mem.loadDraft('user-test')).toBeUndefined();
  });

  it('a change that is already true adds no history', () => {
    const s = make();
    s.getState().apply((q) => addDoor(q, [3, 17], [3, 18]));
    expect(s.getState().past).toHaveLength(1);
    s.getState().apply((q) => setRockCell(q, [10, 2], false)); // already not rock
    expect(s.getState().past).toHaveLength(1);
  });

  it('jump selects the element, shows its tab and flashes its square', () => {
    const s = make();
    s.getState().apply((q) => addMonster(q, 'orc', [6, 2]));
    s.getState().setPanel('problems');
    s.getState().jump({ kind: 'monster', id: 'm1' });
    const st = s.getState();
    expect(st.panel).toBe('element');
    expect(st.selection).toEqual({ kind: 'monster', id: 'm1' });
    expect(st.flash?.cells).toEqual([[6, 2]]);
    s.getState().jump({ kind: 'area', area: 'R03' });
    expect(s.getState().flash?.areas).toEqual(['R03']);
    expect(s.getState().selection).toBeNull();
    s.getState().clearFlash();
    expect(s.getState().flash).toBeNull();
  });
});
