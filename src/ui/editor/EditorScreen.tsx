import { useEffect, useMemo } from 'react';
import type { ReferenceStore } from '../../persist/reference';
import { useStore } from 'zustand';
import { board } from '../../engine/board/board';
import { validateQuestIssues, type MonsterKind } from '../../engine/editor';
import { FURNITURE_TYPES, MONSTER_TYPES } from '../../engine/quest/schema';
import { MONSTER_NAMES } from '../../engine/data/monsters';
import { FURNITURE_NAMES } from '../board/furnitureNames';
import { EditorBoard } from './EditorBoard';
import type { Quest } from '../../engine/quest/schema';
import type { EditorStore, Tool } from './editorStore';
import { countLabel } from './problems';
import { ActionDialog } from './ActionDialog';
import { DOOR_KINDS, Inspector } from './Inspector';
import { AlignDialog, ReferencePanel, useReference } from './ReferenceImage';
import { ImportButton, exportDraft } from './QuestFile';
import { deleteSelection, rotateSelection } from './selectionActions';

const TOOLS: readonly { tool: Tool; label: string; key: string }[] = [
  { tool: 'select', label: 'Select', key: 's' },
  { tool: 'rock', label: 'Rock', key: 'k' },
  { tool: 'doors', label: 'Doors', key: 'd' },
  { tool: 'blocks', label: 'Blocks', key: 'b' },
  { tool: 'furniture', label: 'Furniture', key: 'f' },
  { tool: 'monsters', label: 'Monsters', key: 'm' },
  { tool: 'traps', label: 'Traps', key: 't' },
  { tool: 'markers', label: 'Markers', key: 'l' },
  { tool: 'zones', label: 'Zones', key: 'z' },
  { tool: 'start', label: 'Start', key: 'h' },
];

const TRAP_KINDS = [
  { kind: 'pit', label: 'Pit' },
  { kind: 'fallingBlock', label: 'Falling block' },
  { kind: 'spear', label: 'Spear' },
  { kind: 'chest', label: 'Chest' },
] as const;

export interface EditorScreenProps {
  store: EditorStore;
  onBack(): void;
  /** Where the reference image is kept on this device. Without it the image lives in memory only. */
  reference?: ReferenceStore;
  /** Play the draft in the real play screen. Nothing is saved. */
  onPlaytest?(quest: Quest): void;
}

export function EditorScreen({ store, onBack, reference, onPlaytest }: EditorScreenProps) {
  const s = useStore(store);
  const { quest, tool, toast, warnings, saveErrors } = s;
  const ref = useReference(quest.id, reference);
  const dropFile = async (file: File | undefined) => {
    if (!file) return;
    const problem = await ref.load(file);
    if (problem) store.getState().say(problem);
  };
  const issues = useMemo(() => validateQuestIssues(quest, board), [quest]);
  const errors = issues.filter((i) => i.severity === 'error').length;
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
        if (st.picking) st.setPicking(null);
        else st.select(null);
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
        rotateSelection(store);
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
          onClick={() => {
            s.select(null);
            s.setPanel('problems');
          }}
          aria-label="Problems"
          data-errors={errors}
        >
          {countLabel(issues)}
        </button>
        {onPlaytest && (
          <button
            className="link"
            data-testid="playtest"
            disabled={errors > 0}
            title={errors > 0 ? 'Fix the problems first' : 'Play this quest to try it'}
            onClick={() => onPlaytest(quest)}
          >
            Playtest
          </button>
        )}
        <button className="link" disabled={s.past.length === 0} onClick={() => s.undo()}>
          Undo
        </button>
        <button className="link" disabled={s.future.length === 0} onClick={() => s.redo()}>
          Redo
        </button>
        <ImportButton store={store} />
        <button className="link" data-testid="export" onClick={() => exportDraft(store)}>
          Export
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
          <ReferencePanel api={ref} say={s.say} />
        </nav>

        <main
          className="ed-board"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void dropFile(e.dataTransfer.files[0]);
          }}
        >
          <EditorBoard store={store} reference={ref} />
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

      <ActionDialog store={store} />

      {ref.aligning && ref.state && <AlignDialog api={ref} say={s.say} />}

      {toast && (
        <div className="toast" role="status" key={toast.id}>
          {toast.text}
        </div>
      )}
    </div>
  );
}

function ToolOptions({ store }: { store: EditorStore }) {
  const { tool, opts, quest } = useStore(store);
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
      {tool === 'zones' && (
        <>
          <div className="lbl">Zone</div>
          <p className="ed-note">Click squares to add them to the zone, or to take them out.</p>
          <div className="ed-chips" data-testid="zone-chips">
            {quest.zones.map((z) => chip(z.id, opts.zoneId === z.id, () => set({ zoneId: z.id })))}
            {chip('New zone', opts.zoneId === null, () => set({ zoneId: null }))}
          </div>
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
            {chip('Editor only', opts.markerVisible === 'editor', () =>
              set({ markerVisible: 'editor' }),
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
