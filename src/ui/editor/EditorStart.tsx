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
import { setOverride } from '../../persist/questOverrides';
import { useFitMode } from '../FitToScreen';
import { Dialog, Fld } from '../shared/Frame';
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

/** What the person is told when this device refuses to store a quest. */
const STORE_ERROR =
  'This device could not store it (the browser storage is full or blocked). Export the quest to a file to keep it, or free some space and try again.';

export function EditorStart({ store, onOpen, onBack, onDesigner }: EditorStartProps) {
  useFitMode('width');
  const [rows, setRows] = useState<Row[]>([]);
  const [title, setTitle] = useState('');
  const [number, setNumber] = useState('1');
  const [confirm, setConfirm] = useState<string | null>(null);
  const [problems, setProblems] = useState<readonly string[]>([]);
  /** Set when this device could not store or delete a quest (storage full or blocked). */
  const [storeError, setStoreError] = useState<string | null>(null);
  const [notes, setNotes] = useState<readonly Issue[]>([]);
  const [imported, setImported] = useState<Quest | null>(null);
  const [copyOf, setCopyOf] = useState('');
  const [popup, setPopup] = useState<'new' | 'open' | null>(null);

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
    try {
      await store.save(quest, Date.now());
    } catch {
      setPopup(null);
      setStoreError(STORE_ERROR);
      return;
    }
    setStoreError(null);
    onOpen(quest, quest);
  };

  const remove = async (id: string) => {
    try {
      await store.remove(id);
      setStoreError(null);
    } catch {
      setStoreError(STORE_ERROR);
    }
    setConfirm(null);
    await refresh();
  };

  /** Save an imported quest and show what the import said. */
  const take = async (text: string): Promise<Quest | undefined> => {
    const r = importQuest(text, { takenIds: rows.map((x) => x.id) });
    if (!r.ok) {
      setProblems(r.errors);
      setNotes([]);
      setImported(null);
      return undefined;
    }
    try {
      await store.save(r.quest, Date.now());
    } catch {
      setProblems([]);
      setNotes([]);
      setImported(null);
      setStoreError(STORE_ERROR);
      return undefined;
    }
    setStoreError(null);
    setProblems([]);
    setNotes(r.warnings);
    setImported(r.quest);
    await refresh();
    return r.quest;
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    await take(await file.text());
  };

  const bundled = questEntries.filter((q) => q.level);

  return (
    <div
      className="app fr editor-start"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        void onFile(e.dataTransfer.files[0]);
      }}
    >
      <div className="fr-start">
        <div>
          <h1>Quest editor</h1>
          <h2>Recent quests</h2>
          {rows.length === 0 && (
            <p className="fr-help">No quest yet. Make a new one, or import a file.</p>
          )}
          <ul className="fr-recent">
            {rows.map((r) => (
              <li key={r.id} data-quest={r.id}>
                <button
                  className="fr-open"
                  aria-label={`Open ${r.title}`}
                  onClick={() => void open(r.id)}
                >
                  <span className="fr-qnum">Quest {r.number}</span>
                  <span className="fr-qtitle">{r.title}</span>
                </button>
                <span className="fr-qnote">
                  {r.draft ? 'Unsaved draft' : 'Saved'} ·{' '}
                  {new Date(r.updatedAt).toLocaleDateString()}
                </span>
                {confirm === r.id ? (
                  <>
                    <span>Delete it?</span>
                    <button className="btn" onClick={() => void remove(r.id)}>
                      Yes, delete
                    </button>
                    <button className="btn alt" onClick={() => setConfirm(null)}>
                      No
                    </button>
                  </>
                ) : (
                  <button className="link" onClick={() => setConfirm(r.id)}>
                    Delete
                  </button>
                )}
              </li>
            ))}
          </ul>
          <p className="fr-help" style={{ marginTop: 20 }}>
            You can also drop a quest file here to open it.
          </p>
          <input
            type="file"
            hidden
            accept=".json,application/json"
            aria-label="Import file"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />

          {storeError && (
            <section role="alert" className="es-problems" data-testid="store-error">
              <h2>The quest could not be stored</h2>
              <p>{storeError}</p>
            </section>
          )}
          {problems.length > 0 && (
            <section role="alert" className="es-problems">
              <h2>The file could not be used</h2>
              <ul>
                {problems.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </section>
          )}
          {imported && (
            <section className="es-imported" role="status">
              <h2>Imported</h2>
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
        </div>

        <div className="fr-cards">
          <button className="fr-card" onClick={() => setPopup('new')}>
            <b>NEW QUEST</b>
            <span>Start an empty quest with its stairs and map.</span>
          </button>
          <button className="fr-card" onClick={() => setPopup('open')}>
            <b>OPEN QUEST</b>
            <span>Load a quest from a file, or one of the 14 bundled quests.</span>
          </button>
          {onDesigner && (
            <button className="fr-card" onClick={onDesigner}>
              <b>LIBRARY</b>
              <span>
                Abilities, spells, enemies, heroes and companions. Made once, used in any quest.
              </span>
            </button>
          )}
          <div className="fr-card off" aria-disabled="true">
            <b>PACKAGER (later)</b>
            <span>Arrange quests and export a custom campaign.</span>
          </div>
          <button className="link" onClick={onBack} style={{ justifySelf: 'start' }}>
            Back
          </button>
        </div>
      </div>
      <div className="fr-foot">
        <span>Editor 0.1</span>
        <span>Quest format 1</span>
        <span style={{ marginLeft: 'auto' }}>Works offline</span>
      </div>

      {popup === 'new' && (
        <Dialog
          title="New quest"
          onClose={() => setPopup(null)}
          foot={
            <>
              <button className="btn alt" onClick={() => setPopup(null)}>
                Cancel
              </button>
              <button className="btn" onClick={() => void create()}>
                Create the quest
              </button>
            </>
          }
        >
          <Fld label="Title">
            <input
              className="fr-in"
              aria-label="Title"
              value={title}
              maxLength={80}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Fld>
          <Fld label="Number">
            <input
              className="fr-in"
              aria-label="Number"
              type="number"
              min={1}
              max={99}
              value={number}
              onChange={(e) => setNumber(e.target.value)}
            />
          </Fld>
        </Dialog>
      )}
      {popup === 'open' && (
        <Dialog
          title="Open quest"
          onClose={() => setPopup(null)}
          foot={
            <button className="btn alt" onClick={() => setPopup(null)}>
              Close
            </button>
          }
        >
          <label className="btn alt es-file" style={{ width: '100%' }}>
            Choose a .hqquest.json file
            <input
              type="file"
              accept=".json,application/json"
              aria-label="Import file in the dialog"
              onChange={(e) => {
                setPopup(null);
                void onFile(e.target.files?.[0]);
              }}
            />
          </label>
          {bundled.length > 0 && (
            <>
              <Fld label="Copy a bundled quest">
                <select
                  className="fr-sel"
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
              </Fld>
              <button
                className="btn alt"
                disabled={copyOf === ''}
                onClick={() => {
                  const q = bundled.find((b) => String(b.number) === copyOf)?.level?.quest;
                  if (q) {
                    setPopup(null);
                    void take(exportQuest(q));
                  }
                }}
              >
                Make a copy
              </button>
              <button
                className="btn"
                disabled={copyOf === ''}
                onClick={() => {
                  const q = bundled.find((b) => String(b.number) === copyOf)?.level?.quest;
                  if (!q) return;
                  setPopup(null);
                  void take(exportQuest(q)).then((made) => {
                    // The quest list plays this copy from now on (Use original resets it).
                    if (made) setOverride(q.number, made.id);
                    if (made) onOpen(made, made);
                  });
                }}
              >
                Edit it now
              </button>
              <p className="fr-help">
                A bundled quest is edited as your own copy. Edit it now makes the quest list play
                your copy. The original stays as it is.
              </p>
            </>
          )}
        </Dialog>
      )}
    </div>
  );
}
