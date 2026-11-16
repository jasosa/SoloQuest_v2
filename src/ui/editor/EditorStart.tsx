import { useCallback, useEffect, useState } from 'react';
import {
  emptyQuest,
  exportQuest,
  importQuest,
  newUserQuestId,
  type Issue,
} from '../../engine/editor';
import type { Quest } from '../../engine/quest/schema';
import type { UserQuestStore, UserQuestSummary } from '../../persist/userQuests';
import { questEntries } from '../quests';

export interface EditorStartProps {
  store: UserQuestStore;
  /** `clean` is the saved quest when the opened quest is a draft with unsaved changes. */
  onOpen(quest: Quest, clean: Quest): void;
  onBack(): void;
  /** Open the Designer (the library of abilities, spells, enemies, heroes, companions). */
  onDesigner?(): void;
}

interface Row extends UserQuestSummary {
  draft: boolean;
}

export function EditorStart({ store, onOpen, onBack, onDesigner }: EditorStartProps) {
  const [rows, setRows] = useState<Row[]>([]);
  const [title, setTitle] = useState('');
  const [number, setNumber] = useState('1');
  const [confirm, setConfirm] = useState<string | null>(null);
  const [problems, setProblems] = useState<readonly string[]>([]);
  const [notes, setNotes] = useState<readonly Issue[]>([]);
  const [imported, setImported] = useState<Quest | null>(null);
  const [copyOf, setCopyOf] = useState('');

  const refresh = useCallback(async () => {
    const list = await store.list();
    const withDraft = await Promise.all(
      list.map(async (r) => ({ ...r, draft: (await store.loadDraft(r.id)) !== undefined })),
    );
    setRows(withDraft);
  }, [store]);

  useEffect(() => {
    // The list comes from storage, so it is loaded after the first paint.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const open = async (id: string) => {
    const draft = await store.loadDraft(id);
    const saved = await store.load(id);
    const quest = draft?.quest ?? saved;
    if (quest) onOpen(quest, saved ?? quest);
  };

  const create = async () => {
    const n = Math.max(1, Math.min(99, Math.floor(Number(number)) || 1));
    const name = title.trim() === '' ? 'New quest' : title.trim();
    const taken = rows.map((r) => r.id);
    const quest = emptyQuest({ id: newUserQuestId(name, taken), number: n, title: name });
    await store.save(quest, Date.now());
    onOpen(quest, quest);
  };

  const remove = async (id: string) => {
    await store.remove(id);
    setConfirm(null);
    await refresh();
  };

  /** Save an imported quest and show what the import said. */
  const take = async (text: string) => {
    const r = importQuest(text, { takenIds: rows.map((x) => x.id) });
    if (!r.ok) {
      setProblems(r.errors);
      setNotes([]);
      setImported(null);
      return;
    }
    await store.save(r.quest, Date.now());
    setProblems([]);
    setNotes(r.warnings);
    setImported(r.quest);
    await refresh();
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    await take(await file.text());
  };

  const bundled = questEntries.filter((q) => q.level);

  return (
    <div className="app editor-start">
      <header>
        <span className="qn">Editor</span>
        <h1>Your quests</h1>
        {onDesigner && (
          <button className="btn alt" onClick={onDesigner} style={{ marginLeft: 'auto' }}>
            Designer
          </button>
        )}
        <button
          className="link"
          onClick={onBack}
          style={onDesigner ? undefined : { marginLeft: 'auto' }}
        >
          Back
        </button>
      </header>

      <div className="pick es-list">
        {rows.length === 0 && (
          <p className="es-empty">No quest yet. Make a new one, or import a file.</p>
        )}
        <ul>
          {rows.map((r) => (
            <li key={r.id} data-quest={r.id}>
              <div>
                <b>{r.title}</b> <span className="es-meta">Quest {r.number}</span>
                {r.draft && <span className="es-tag">Unsaved draft</span>}
                <div className="es-meta">{new Date(r.updatedAt).toLocaleString()}</div>
              </div>
              {confirm === r.id ? (
                <div className="es-actions">
                  <span>Delete it?</span>
                  <button className="btn" onClick={() => void remove(r.id)}>
                    Yes, delete
                  </button>
                  <button className="btn alt" onClick={() => setConfirm(null)}>
                    No
                  </button>
                </div>
              ) : (
                <div className="es-actions">
                  <button className="btn" onClick={() => void open(r.id)}>
                    Open
                  </button>
                  <button className="btn alt" onClick={() => setConfirm(r.id)}>
                    Delete
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      <aside className="side">
        <section>
          <div className="lbl">New quest</div>
          <label className="ed-field">
            Title
            <input value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="ed-field">
            Number
            <input
              type="number"
              min={1}
              max={99}
              value={number}
              onChange={(e) => setNumber(e.target.value)}
            />
          </label>
          <button className="btn" onClick={() => void create()}>
            Create the quest
          </button>
        </section>

        <section>
          <div className="lbl">Import a file</div>
          <label className="btn alt es-file">
            Choose a .hqquest.json file
            <input
              type="file"
              accept=".json,application/json"
              aria-label="Import file"
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
          </label>
        </section>

        {bundled.length > 0 && (
          <section>
            <div className="lbl">Copy a bundled quest</div>
            <select
              className="es-select"
              aria-label="Bundled quest"
              value={copyOf}
              onChange={(e) => setCopyOf(e.target.value)}
            >
              <option value="">Choose a quest</option>
              {bundled.map((q) => (
                <option key={q.number} value={q.number}>
                  Quest {q.number}: {q.level?.quest.title}
                </option>
              ))}
            </select>
            <button
              className="btn alt"
              disabled={copyOf === ''}
              onClick={() => {
                const q = bundled.find((b) => String(b.number) === copyOf)?.level?.quest;
                if (q) void take(exportQuest(q));
              }}
            >
              Make a copy
            </button>
          </section>
        )}

        {problems.length > 0 && (
          <section role="alert" className="es-problems">
            <div className="lbl">The file could not be used</div>
            <ul>
              {problems.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </section>
        )}
        {imported && (
          <section className="es-imported" role="status">
            <div className="lbl">Imported</div>
            <p>{imported.title} is in your list.</p>
            {notes.length > 0 && (
              <ul>
                {notes.map((n, i) => (
                  <li key={i}>{n.message}</li>
                ))}
              </ul>
            )}
            <button className="btn" onClick={() => onOpen(imported, imported)}>
              Open it
            </button>
          </section>
        )}
      </aside>
    </div>
  );
}
