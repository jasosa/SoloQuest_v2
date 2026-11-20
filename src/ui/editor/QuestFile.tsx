import { useRef, useState } from 'react';
import { useModal } from '../shared/useModal';
import { useStore } from 'zustand';
import { emptyQuest, exportQuest, exportQuestChecked, importQuest } from '../../engine/editor';
import type { Issue } from '../../engine/editor';
import type { Quest } from '../../engine/quest/schema';
import type { EditorStore } from './editorStore';

/** `The Cellar!` becomes `the-cellar`. Never empty. */
export function titleSlug(title: string): string {
  const s = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return s === '' ? 'quest' : s;
}

/** True when the draft is still the blank quest the editor made (nothing to lose). */
export function isBlank(quest: Quest): boolean {
  const blank = emptyQuest({ id: quest.id, number: quest.number, title: quest.title });
  return exportQuest(blank) === exportQuest(quest);
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportDraft(store: EditorStore) {
  const { canon: quest, say } = store.getState();
  const r = exportQuestChecked(quest);
  if (!r.ok) {
    say(
      `Cannot export: ${r.errors.length} ${r.errors.length === 1 ? 'problem' : 'problems'} to fix first. See Problems.`,
    );
    return;
  }
  const name = `${titleSlug(quest.title)}.hqquest.json`;
  download(name, r.text);
  const w = r.warnings.length;
  say(`Exported ${name}.${w > 0 ? ` ${w} ${w === 1 ? 'warning' : 'warnings'} in the file.` : ''}`);
}

type Pending =
  | { kind: 'errors'; errors: readonly string[] }
  | { kind: 'confirm'; quest: Quest; notes: readonly string[]; warnings: Issue[] };

function load(store: EditorStore, quest: Quest, warnings: Issue[]) {
  const cur = store.getState().canon;
  // The draft keeps its own id, so Save writes to the same quest.
  const next: Quest = { ...quest, id: cur.id };
  const ok = store.getState().applyQuest(() => ({ ok: true, quest: next, warnings }));
  if (ok) {
    store.getState().select(null);
    store.getState().say(`Imported ${next.title}. Undo brings the old draft back.`);
  }
}

/** Header button: choose a file, check it, load it as one undo step. */
export function ImportButton({ store }: { store: EditorStore }) {
  const s = useStore(store);
  const [pending, setPending] = useState<Pending | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const r = importQuest(await file.text());
    if (!r.ok) {
      setPending({ kind: 'errors', errors: r.errors });
      return;
    }
    const notes = r.warnings.map((w) => w.message);
    if (isBlank(s.canon)) {
      load(store, r.quest, r.warnings);
      return;
    }
    setPending({ kind: 'confirm', quest: r.quest, notes, warnings: r.warnings });
  };

  const close = () => setPending(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  useModal(sheetRef, { active: pending !== null, onEscape: close, focus: 'first' });

  return (
    <>
      <button className="chip" onClick={() => input.current?.click()}>
        Import
      </button>
      <input
        ref={input}
        type="file"
        hidden
        accept=".json,application/json"
        aria-label="Import file"
        onChange={(e) => {
          void onFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      {pending && (
        <div className="veil ed-sheet-wrap">
          <div
            className="ed-sheet"
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label={
              pending.kind === 'errors' ? 'The file could not be used' : 'Replace the draft'
            }
          >
            {pending.kind === 'errors' ? (
              <>
                <h2>The file could not be used</h2>
                <ul>
                  {pending.errors.slice(0, 12).map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
                {pending.errors.length > 12 && <p>And {pending.errors.length - 12} more.</p>}
                <div className="ed-sheet-actions">
                  <button className="btn" onClick={close}>
                    Close
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2>Replace your draft?</h2>
                <p>
                  The file holds &ldquo;{pending.quest.title}&rdquo;. It will replace the quest you
                  are editing. Undo brings your draft back.
                </p>
                {pending.notes.length > 0 && (
                  <ul>
                    {pending.notes.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                )}
                <div className="ed-sheet-actions">
                  <button
                    className="btn"
                    onClick={() => {
                      load(store, pending.quest, pending.warnings);
                      close();
                    }}
                  >
                    Replace the draft
                  </button>
                  <button className="btn alt" onClick={close}>
                    Keep my draft
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
