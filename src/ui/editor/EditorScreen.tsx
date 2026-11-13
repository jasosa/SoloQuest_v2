import { useEffect, useMemo } from 'react';
import { useStore } from 'zustand';
import { board } from '../../engine/board/board';
import {
  removeBlock,
  removeDoor,
  removeFurniture,
  removeMarker,
  removeMonster,
  removeTrap,
  renameQuest,
  rotateFurniture,
  setDoorKind,
  setSummary,
  validateQuestIssues,
  type DoorKind,
  type Issue,
  type MonsterKind,
} from '../../engine/editor';
import { FURNITURE_TYPES, MONSTER_TYPES } from '../../engine/quest/schema';
import { MONSTER_NAMES } from '../../engine/data/monsters';
import { FURNITURE_NAMES } from '../board/furnitureNames';
import { EditorBoard } from './EditorBoard';
import type { EditorStore, EditSelection, Tool } from './editorStore';

const TOOLS: readonly { tool: Tool; label: string; key: string }[] = [
  { tool: 'select', label: 'Select', key: 's' },
  { tool: 'rock', label: 'Rock', key: 'k' },
  { tool: 'doors', label: 'Doors', key: 'd' },
  { tool: 'blocks', label: 'Blocks', key: 'b' },
  { tool: 'furniture', label: 'Furniture', key: 'f' },
  { tool: 'monsters', label: 'Monsters', key: 'm' },
  { tool: 'traps', label: 'Traps', key: 't' },
  { tool: 'markers', label: 'Markers', key: 'l' },
  { tool: 'start', label: 'Start', key: 'h' },
];

const DOOR_KINDS: readonly { kind: DoorKind; label: string }[] = [
  { kind: 'normal', label: 'Normal' },
  { kind: 'secret', label: 'Secret' },
  { kind: 'false', label: 'False' },
];

const TRAP_KINDS = [
  { kind: 'pit', label: 'Pit' },
  { kind: 'fallingBlock', label: 'Falling block' },
  { kind: 'spear', label: 'Spear' },
  { kind: 'chest', label: 'Chest' },
] as const;

const SELECTION_NAMES: Record<NonNullable<EditSelection>['kind'], string> = {
  door: 'Door',
  block: 'Block',
  furniture: 'Furniture',
  monster: 'Monster',
  trap: 'Trap',
  marker: 'Marker',
};

export interface EditorScreenProps {
  store: EditorStore;
  onBack(): void;
}

export function EditorScreen({ store, onBack }: EditorScreenProps) {
  const s = useStore(store);
  const { quest, tool, toast, warnings, saveErrors } = s;
  const issues = useMemo(() => validateQuestIssues(quest, board), [quest]);
  const errors = issues.filter((i) => i.severity === 'error').length;
  const warns = issues.length - errors;
  const dirty = quest !== s.clean;

  // Toasts go away on their own.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => store.getState().dismissToast(), 4000);
    return () => clearTimeout(t);
  }, [toast, store]);

  // Shortcuts (documented in DESIGN.md). Ignored while typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('input, textarea, select')) return;
      const st = store.getState();
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) st.redo();
        else st.undo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        st.redo();
        return;
      }
      if (mod || e.altKey) return;
      if (e.key === 'Escape') {
        st.setPendingBlock(null);
        st.select(null);
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (st.selection) {
          e.preventDefault();
          deleteSelection(store);
        }
        return;
      }
      if (e.key.toLowerCase() === 'r') {
        rotate(store);
        return;
      }
      const t = TOOLS.find((x) => x.key === e.key.toLowerCase());
      if (t) st.setTool(t.tool);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [store]);

  return (
    <div className="app editor">
      <header>
        <span className="qn">Editor</span>
        <h1>{quest.title}</h1>
        <span className="ed-status">{dirty ? 'Unsaved changes' : 'Saved'}</span>
        <button
          className="link ed-issues"
          onClick={() => s.select(null)}
          aria-label="Problems"
          data-errors={errors}
        >
          {errors > 0
            ? `${errors} problem${errors === 1 ? '' : 's'}`
            : warns > 0
              ? `${warns} warning${warns === 1 ? '' : 's'}`
              : 'No problems'}
        </button>
        <button className="link" disabled={s.past.length === 0} onClick={() => s.undo()}>
          Undo
        </button>
        <button className="link" disabled={s.future.length === 0} onClick={() => s.redo()}>
          Redo
        </button>
        <button className="link" onClick={() => void s.save()}>
          Save
        </button>
        <button className="link" onClick={onBack}>
          Back
        </button>
      </header>

      <div className="ed-body">
        <nav className="ed-tools" aria-label="Tools">
          <div className="ed-chips">
            {TOOLS.map((t) => (
              <button
                key={t.tool}
                className="chip"
                aria-pressed={tool === t.tool}
                title={`Shortcut ${t.key.toUpperCase()}`}
                onClick={() => s.setTool(t.tool)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <ToolOptions store={store} />
        </nav>

        <main className="ed-board">
          <EditorBoard store={store} />
          {warnings.length > 0 && (
            <div className="ed-warnings" role="status">
              <button className="link" onClick={() => s.dismissWarnings()}>
                Dismiss
              </button>
              <ul>
                {warnings.map((w, i) => (
                  <li key={i}>{w.message}</li>
                ))}
              </ul>
            </div>
          )}
        </main>

        <aside className="ed-inspector" aria-label="Inspector">
          <Inspector store={store} issues={issues} saveErrors={saveErrors} />
        </aside>
      </div>

      {toast && (
        <div className="toast" role="status" key={toast.id}>
          {toast.text}
        </div>
      )}
    </div>
  );
}

function rotate(store: EditorStore) {
  const st = store.getState();
  if (st.selection?.kind === 'furniture') {
    const id = st.selection.id;
    st.apply((q) => rotateFurniture(q, id));
  } else if (st.tool === 'furniture') st.setOpts({ furnitureTurned: !st.opts.furnitureTurned });
}

function deleteSelection(store: EditorStore) {
  const st = store.getState();
  const sel = st.selection;
  if (!sel) return;
  const ok = st.apply((q) => {
    switch (sel.kind) {
      case 'door':
        return removeDoor(q, sel.id);
      case 'block':
        return removeBlock(q, sel.cell);
      case 'furniture':
        return removeFurniture(q, sel.id);
      case 'monster':
        return removeMonster(q, sel.id);
      case 'trap':
        return removeTrap(q, sel.id);
      case 'marker':
        return removeMarker(q, sel.id);
    }
  });
  if (ok) st.select(null);
}

function ToolOptions({ store }: { store: EditorStore }) {
  const { tool, opts } = useStore(store);
  const set = store.getState().setOpts;
  const chip = (label: string, on: boolean, onClick: () => void) => (
    <button key={label} className="chip" aria-pressed={on} onClick={onClick}>
      {label}
    </button>
  );
  return (
    <div className="ed-options">
      {tool === 'rock' && (
        <>
          <div className="lbl">Rock</div>
          {chip('Whole room', opts.rockRoom, () => set({ rockRoom: !opts.rockRoom }))}
        </>
      )}
      {tool === 'doors' && (
        <>
          <div className="lbl">Door kind</div>
          <div className="ed-chips">
            {DOOR_KINDS.map((d) =>
              chip(d.label, opts.doorKind === d.kind, () => set({ doorKind: d.kind })),
            )}
          </div>
        </>
      )}
      {tool === 'blocks' && (
        <>
          <div className="lbl">Block</div>
          <div className="ed-chips">
            {chip('Single', !opts.blockDouble, () => set({ blockDouble: false }))}
            {chip('Double', opts.blockDouble, () => set({ blockDouble: true }))}
          </div>
        </>
      )}
      {tool === 'furniture' && (
        <>
          <div className="lbl">Furniture</div>
          <div className="ed-chips ed-small">
            {FURNITURE_TYPES.map((t) =>
              chip(FURNITURE_NAMES[t], opts.furnitureType === t, () => set({ furnitureType: t })),
            )}
          </div>
          <button
            className="btn alt"
            onClick={() => set({ furnitureTurned: !opts.furnitureTurned })}
            aria-pressed={opts.furnitureTurned}
          >
            Turn (R)
          </button>
        </>
      )}
      {tool === 'monsters' && (
        <>
          <div className="lbl">Monster</div>
          <div className="ed-chips ed-small">
            {MONSTER_TYPES.map((t: MonsterKind) =>
              chip(MONSTER_NAMES[t], opts.monsterType === t, () => set({ monsterType: t })),
            )}
          </div>
        </>
      )}
      {tool === 'traps' && (
        <>
          <div className="lbl">Trap</div>
          <div className="ed-chips ed-small">
            {TRAP_KINDS.map((t) =>
              chip(t.label, opts.trapKind === t.kind, () => set({ trapKind: t.kind })),
            )}
          </div>
          {opts.trapKind === 'chest' && <p className="ed-note">Click a chest.</p>}
        </>
      )}
      {tool === 'markers' && (
        <>
          <div className="lbl">Marker</div>
          <label className="ed-field">
            Label
            <input
              value={opts.markerLabel}
              maxLength={40}
              onChange={(e) => set({ markerLabel: e.target.value })}
            />
          </label>
          <div className="ed-chips">
            {chip('Zargon sees', opts.markerVisible === 'zargon', () =>
              set({ markerVisible: 'zargon' }),
            )}
            {chip('Players see', opts.markerVisible === 'players', () =>
              set({ markerVisible: 'players' }),
            )}
          </div>
        </>
      )}
      {tool === 'start' && <p className="ed-note">Click a room to make it the start.</p>}
      <div className="lbl ed-gap">View</div>
      {chip('Room ids', opts.roomIds, () => set({ roomIds: !opts.roomIds }))}
    </div>
  );
}

function Inspector({
  store,
  issues,
  saveErrors,
}: {
  store: EditorStore;
  issues: readonly Issue[];
  saveErrors: readonly string[] | null;
}) {
  const { quest, selection } = useStore(store);
  const st = store.getState();

  const door = selection?.kind === 'door' ? findDoor(quest, selection.id) : undefined;
  const furniture =
    selection?.kind === 'furniture'
      ? quest.furniture.find((f) => f.id === selection.id)
      : undefined;

  const jump = (i: Issue) => {
    const ref = i.ref;
    if (!ref) return;
    if (
      ref.kind === 'door' ||
      ref.kind === 'furniture' ||
      ref.kind === 'monster' ||
      ref.kind === 'trap' ||
      ref.kind === 'marker'
    ) {
      if (ref.id) st.select({ kind: ref.kind, id: ref.id });
    } else if (ref.kind === 'block' && ref.cell) st.select({ kind: 'block', cell: ref.cell });
  };

  return (
    <>
      <section>
        <div className="lbl">Quest</div>
        <label className="ed-field">
          Title
          <input
            key={quest.title}
            defaultValue={quest.title}
            maxLength={80}
            onBlur={(e) => {
              if (e.target.value !== quest.title) st.apply((q) => renameQuest(q, e.target.value));
            }}
          />
        </label>
        <p className="ed-note">Number {quest.number}</p>
        <label className="ed-field">
          Summary
          <textarea
            key={quest.intro.summary}
            defaultValue={quest.intro.summary}
            rows={4}
            onBlur={(e) => {
              if (e.target.value !== quest.intro.summary)
                st.apply((q) => setSummary(q, e.target.value));
            }}
          />
        </label>
      </section>

      {saveErrors && (
        <section className="ed-save-errors" role="alert">
          <div className="lbl">Cannot save yet</div>
          <ul>
            {saveErrors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </section>
      )}

      {selection ? (
        <section>
          <div className="lbl">{SELECTION_NAMES[selection.kind]}</div>
          <p className="ed-id" data-testid="selection-id">
            {selection.kind === 'block'
              ? `Square ${selection.cell[0]}, ${selection.cell[1]}`
              : selection.id}
            {furniture ? ` · ${FURNITURE_NAMES[furniture.type]}` : ''}
          </p>
          {door && (
            <div className="ed-chips">
              {DOOR_KINDS.map((d) => (
                <button
                  key={d.kind}
                  className="chip"
                  aria-pressed={door.kind === d.kind}
                  onClick={() => {
                    st.apply((q) => setDoorKind(q, door.id, d.kind));
                    // the id changes with the kind: select the door at the same edge again
                    const q = store.getState().quest;
                    const moved = [...q.doors, ...q.secretDoors, ...q.falseDoors].find(
                      (x) =>
                        x.a[0] === door.a[0] &&
                        x.a[1] === door.a[1] &&
                        x.b[0] === door.b[0] &&
                        x.b[1] === door.b[1],
                    );
                    if (moved) st.select({ kind: 'door', id: moved.id });
                  }}
                >
                  {d.label}
                </button>
              ))}
            </div>
          )}
          {furniture && (
            <button className="btn alt" onClick={() => rotate(store)}>
              Rotate
            </button>
          )}
          <button className="btn" onClick={() => deleteSelection(store)}>
            Delete
          </button>
        </section>
      ) : (
        <section>
          <div className="lbl">Problems</div>
          {issues.length === 0 ? (
            <p className="ed-note">No problems.</p>
          ) : (
            <ul className="ed-issues-list">
              {issues.map((i, n) => (
                <li key={n} className={i.severity}>
                  <button onClick={() => jump(i)}>
                    <b>{i.severity === 'error' ? 'Problem' : 'Warning'}</b> {i.message}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  );
}

function findDoor(quest: ReturnType<EditorStore['getState']>['quest'], id: string) {
  const all: { door: (typeof quest.doors)[number]; kind: DoorKind }[] = [
    ...quest.doors.map((door) => ({ door, kind: 'normal' as const })),
    ...quest.secretDoors.map((door) => ({ door, kind: 'secret' as const })),
    ...quest.falseDoors.map((door) => ({ door, kind: 'false' as const })),
  ];
  const f = all.find((x) => x.door.id === id);
  return f ? { ...f.door, kind: f.kind } : undefined;
}
