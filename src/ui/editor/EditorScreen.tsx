import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import type { ReferenceStore } from '../../persist/reference';
import { useStore } from 'zustand';
import { board } from '../../engine/board/board';
import { lettersMissingNotes, validateQuestIssues } from '../../engine/editor';
import { useFitMode } from '../FitToScreen';
import { EditorBoard } from './EditorBoard';
import type { Quest } from '../../engine/quest/schema';
import type { EditorStore, EditorTabName, Tool } from './editorStore';
import { EDITOR_TABS, TopBar } from '../shared/Frame';
import { DesignerBody, type QuestSource, type QuestUpdater } from '../designer/DesignerScreen';
import type { LibraryStore } from '../../persist/library';
import { ActionsTab, QuestTab } from './QuestTabs';
import { MonstersTab } from './MonstersTab';
import { MapChips } from './MapsPanel';
import { RightToolOptions, ViewOptions } from './ToolOptions';
import { countLabel } from './problems';
import { AbilityDialog } from './AbilityDialog';
import { ActionDialog } from './ActionDialog';
import { SpellDialog } from './SpellDialog';
import { Inspector, selectionHeading } from './Inspector';
import { ProblemsPanel } from './ProblemsPanel';
import { AlignDialog, ReferencePanel, useReference } from './ReferenceImage';
import { ImportButton, exportDraft } from './QuestFile';
import { deleteSelection, rotateSelection } from './selectionActions';
import { anyModalOpen } from '../shared/useModal';
import { FullMessage, ToastBox, toastMs } from '../shared/Toast';
import { ThemeScope } from '../theme/activeTheme';
import { boxOfQuest, setQuestBox } from '../theme/questBox';
import { useEditorTextures } from '../theme/editorTextures';
import { CLASSIC_THEME } from '../theme/theme';
import { t } from '../../i18n/t';

const TOOLS: readonly { tool: Tool; label: string; key: string }[] = [
  { tool: 'select', label: 'Select', key: 's' },
  { tool: 'rock', label: 'Rock', key: 'k' },
  { tool: 'doors', label: 'Doors', key: 'd' },
  { tool: 'blocks', label: 'Blocks', key: 'b' },
  { tool: 'furniture', label: 'Furniture', key: 'f' },
  { tool: 'tiles', label: 'Tiles', key: 'i' },
  { tool: 'monsters', label: 'Monsters', key: 'm' },
  { tool: 'traps', label: 'Traps', key: 't' },
  { tool: 'markers', label: 'Markers', key: 'l' },
  { tool: 'zones', label: 'Zones', key: 'z' },
  { tool: 'merge', label: t('editor.EditorScreen.mergeRooms', 'Merge rooms'), key: 'g' },
  { tool: 'start', label: 'Start', key: 'h' },
];

export interface EditorScreenProps {
  store: EditorStore;
  onBack(): void;
  /** Where the reference image is kept on this device. Without it the image lives in memory only. */
  reference?: ReferenceStore;
  /** Play the draft in the real play screen. Nothing is saved. */
  onPlaytest?(quest: Quest): void;
  /** The Designer library and the quests it looks at, for the Designer tab. */
  library: LibraryStore;
  quests?: QuestSource;
  /** Change every quest made here (the Designer's "Update in all quests"). */
  updateQuests?: QuestUpdater;
}

export function EditorScreen({
  store,
  onBack,
  reference,
  onPlaytest,
  library,
  quests,
  updateQuests,
}: EditorScreenProps) {
  useFitMode('width');
  const s = useStore(store);
  const { quest, tool, toast, warnings, saveErrors, tab } = s;
  // The map uses the texture pack in use unless the person turned that off (View > Textures).
  const mapTextures = useEditorTextures();
  // a pack made for one box dresses only the quests of that box
  const questBox = boxOfQuest(quest);
  useLayoutEffect(() => {
    setQuestBox(questBox);
    return () => setQuestBox(undefined);
  }, [questBox]);
  /** A message too long for its toast, shown whole. */
  const [fullMessage, setFullMessage] = useState<string | null>(null);
  const ref = useReference(quest.id, reference);
  const dropFile = async (file: File | undefined) => {
    if (!file) return;
    const problem = await ref.load(file);
    if (problem) store.getState().say(problem);
  };
  const issues = useMemo(() => validateQuestIssues(s.canon, board), [s.canon]);
  const errors = issues.filter((i) => i.severity === 'error').length;
  const dirty = s.canon !== s.clean;
  const problemsOpen = tab === 'Map' && s.panel === 'problems';
  // with Select and an element picked the card is titled by the element: its kind, then its id
  const heading =
    !problemsOpen && tool === 'select' && s.selection ? selectionHeading(quest, s.selection) : null;

  // Toasts go away on their own.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => store.getState().dismissToast(), toastMs(toast.text, 4000));
    return () => clearTimeout(t);
  }, [toast, store]);

  // Shortcuts (documented in DESIGN.md). Ignored while typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('input, textarea, select')) return;
      if (anyModalOpen()) return; // a dialog is open: Esc, Delete and the letters belong to it
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
        else if (st.tool === 'monsters' && st.opts.monsterPicked)
          st.setOpts({ monsterPicked: false });
        else st.select(null);
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // only on the board (or with nothing focused): on a button Backspace must not delete the selection
        const onBoard = el === document.body || Boolean(el.closest('#editor-board'));
        // the selection is deleted with Select only (decision 104)
        if (st.selection && onBoard && st.tool === 'select') {
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
    <div className="app editor fr">
      <TopBar
        tabs={EDITOR_TABS}
        active={tab}
        badges={{ Actions: lettersMissingNotes(quest).length }}
        onTab={(t) => s.setTab(t as EditorTabName)}
        title={quest.title}
        onBack={onBack}
        hint={
          <>
            <span className="ed-status">
              {dirty
                ? t('editor.EditorScreen.unsavedChanges', 'Unsaved changes')
                : t('editor.EditorScreen.saved', 'Saved')}
            </span>
            {!s.stored && (
              <span className="ed-status ed-nostore" role="alert">
                {t(
                  'editor.EditorScreen.thisDeviceCannotKeep',
                  'This device cannot keep a draft. Save the quest, or Export it, before you leave.',
                )}
              </span>
            )}
          </>
        }
        actions={
          <div
            className="ed-actions"
            role="toolbar"
            aria-label={t('editor.EditorScreen.quest', 'Quest')}
          >
            <button
              className="chip ed-issues"
              aria-pressed={problemsOpen}
              onClick={() => {
                // opens the Problems list in the right card; a second tap closes it (decision 105)
                if (problemsOpen) {
                  s.setPanel('element');
                  return;
                }
                s.select(null);
                s.setTab('Map');
                s.setPanel('problems');
              }}
              data-errors={errors}
            >
              {countLabel(issues)}
            </button>
            <button className="chip" disabled={s.past.length === 0} onClick={() => s.undo()}>
              {t('editor.EditorScreen.undo', 'Undo')}
            </button>
            <button className="chip" disabled={s.future.length === 0} onClick={() => s.redo()}>
              {t('editor.EditorScreen.redo', 'Redo')}
            </button>
            {onPlaytest && (
              <button
                className="chip"
                data-testid="playtest"
                disabled={errors > 0}
                title={
                  errors > 0
                    ? t('editor.EditorScreen.fixTheProblemsFirst', 'Fix the problems first')
                    : t('editor.EditorScreen.playThisQuestTo', 'Play this quest to try it')
                }
                onClick={() => onPlaytest(s.canon)}
              >
                {t('editor.EditorScreen.playtest', 'Playtest')}
              </button>
            )}
            <button className="chip main" onClick={() => void s.save()}>
              {t('editor.EditorScreen.save', 'Save')}
            </button>
          </div>
        }
      >
        <ImportButton store={store} />
        <button className="chip" data-testid="export" onClick={() => exportDraft(store)}>
          {t('editor.EditorScreen.export', 'Export')}
        </button>
      </TopBar>

      {tab === 'Quest' && <QuestTab store={store} />}
      {tab === 'Actions' && <ActionsTab store={store} />}
      {tab === 'Monsters' && <MonstersTab store={store} />}
      {tab === 'Library' && (
        <DesignerBody store={library} quests={quests} updateQuests={updateQuests} />
      )}
      {tab === 'Map' && (
        <div className="ed-body">
          <nav className="ed-tools fr-panel" aria-label={t('editor.EditorScreen.tools', 'Tools')}>
            <h2 className="fr-hd">{t('editor.EditorScreen.tools', 'Tools')}</h2>
            <MapChips store={store} />
            <div className="ed-chips">
              {TOOLS.map((tv) => (
                <button
                  key={tv.tool}
                  className="chip"
                  aria-pressed={tool === tv.tool}
                  title={t('editor.EditorScreen.shortcut', 'Shortcut {v1}', {
                    v1: tv.key.toUpperCase(),
                  })}
                  onClick={() => s.setTool(tv.tool)}
                >
                  {tv.label}
                </button>
              ))}
            </div>
            <ViewOptions store={store} />
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
            <ThemeScope theme={mapTextures ? undefined : CLASSIC_THEME}>
              <EditorBoard store={store} reference={ref} />
            </ThemeScope>
            {warnings.length > 0 && (
              <div className="ed-warnings" role="status">
                <button className="link" onClick={() => s.dismissWarnings()}>
                  {t('editor.EditorScreen.dismiss', 'Dismiss')}
                </button>
                <ul>
                  {warnings.map((w, i) => (
                    <li key={i}>{w.message}</li>
                  ))}
                </ul>
              </div>
            )}
          </main>

          <aside
            className="ed-inspector fr-panel"
            aria-label={t('editor.EditorScreen.inspector', 'Inspector')}
          >
            {heading && <div className="lbl ed-kind">{heading.label}</div>}
            <h2 className="fr-hd" data-testid={heading ? 'selection-id' : undefined}>
              {problemsOpen
                ? t('editor.EditorScreen.problems', 'Problems')
                : heading
                  ? heading.title
                  : TOOLS.find((x) => x.tool === tool)?.label}
            </h2>
            {problemsOpen ? (
              <ProblemsPanel store={store} issues={issues} />
            ) : (
              <>
                <RightToolOptions store={store} />
                <Inspector store={store} saveErrors={saveErrors} />
              </>
            )}
          </aside>
        </div>
      )}

      <ActionDialog store={store} />
      <AbilityDialog store={store} />
      <SpellDialog store={store} />

      {ref.aligning && ref.state && <AlignDialog api={ref} say={s.say} />}

      {toast && (
        <ToastBox
          key={toast.id}
          text={toast.text}
          onMore={(text) => {
            setFullMessage(text);
            s.dismissToast();
          }}
        />
      )}
      {fullMessage && <FullMessage text={fullMessage} onClose={() => setFullMessage(null)} />}
    </div>
  );
}
