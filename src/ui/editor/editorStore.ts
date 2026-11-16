/**
 * The editor store: the quest draft, the selection, the active tool and the undo history.
 * No React in here. Every change to the quest goes through an engine edit operation (`apply`), so
 * the draft is always a quest the schema accepts. A refused change leaves everything untouched and
 * shows the engine's sentence as a toast.
 */
import { createStore, type StoreApi } from 'zustand/vanilla';
import { board } from '../../engine/board/board';
import {
  validateQuestIssues,
  type Cell,
  type DoorKind,
  type EditResult,
  type Issue,
  type MonsterKind,
} from '../../engine/editor';
import type { FurnitureDef, Quest } from '../../engine/quest/schema';
import type { UserQuestStore } from '../../persist/userQuests';
import type { IssueRef } from '../../engine/quest/validate';
import { jumpFor, type Flash } from './problems';

export type Tool =
  'select' | 'rock' | 'doors' | 'blocks' | 'furniture' | 'monsters' | 'traps' | 'markers' | 'start';

export type EditSelection =
  | {
      readonly kind: 'door' | 'furniture' | 'monster' | 'trap' | 'marker' | 'zone';
      readonly id: string;
    }
  | { readonly kind: 'block'; readonly cell: Cell }
  | null;

export interface ToolOpts {
  readonly rockRoom: boolean;
  readonly doorKind: DoorKind;
  readonly blockDouble: boolean;
  readonly furnitureType: FurnitureDef['type'];
  readonly furnitureTurned: boolean;
  readonly monsterType: MonsterKind;
  readonly trapKind: 'pit' | 'fallingBlock' | 'spear' | 'chest';
  readonly markerLabel: string;
  readonly markerVisible: 'editor' | 'players';
  readonly roomIds: boolean;
}

export const DEFAULT_OPTS: ToolOpts = {
  rockRoom: false,
  doorKind: 'normal',
  blockDouble: false,
  furnitureType: 'table',
  furnitureTurned: false,
  monsterType: 'orc',
  trapKind: 'pit',
  markerLabel: 'A',
  markerVisible: 'editor',
  roomIds: false,
};

/** Which part of the board a pick takes: a door (normal or secret), a square, or an area. */
export type PickKind = 'door' | 'secretDoor' | 'cell' | 'room' | 'area';

/** "Click it on the board" mode: the next board click is handed to `onPick` instead of a tool. */
export interface PickRequest {
  readonly kind: PickKind;
  /** Shown above the board and in the inspector, for example "Click a door." */
  readonly hint: string;
  /** A door id, an area id, or a square. */
  onPick(value: string | Cell): void;
}

export type Panel = 'element' | 'notes' | 'problems';

/** A short highlight on the board after a jump from the Problems panel. `id` restarts it. */
export interface BoardFlash extends Flash {
  readonly id: number;
}

export interface EditorToast {
  readonly id: number;
  readonly text: string;
}

export interface EditorState {
  readonly quest: Quest;
  /** The quest as last saved: the draft differs from it when there are unsaved changes. */
  readonly clean: Quest;
  readonly past: readonly Quest[];
  readonly future: readonly Quest[];
  readonly tool: Tool;
  readonly opts: ToolOpts;
  readonly selection: EditSelection;
  /** Inspector tab: the selected element or the note builder. */
  readonly panel: Panel;
  /** The note open in the note builder. */
  readonly noteId: string | null;
  /** Set while the note builder waits for a click on the board. */
  readonly picking: PickRequest | null;
  /** First square of a double block, waiting for the second click. */
  readonly pendingBlock: Cell | null;
  readonly toast: EditorToast | null;
  readonly flash: BoardFlash | null;
  /** Warnings of the last change (for example notes that point at a removed door). */
  readonly warnings: readonly Issue[];
  /** Errors that stopped the last "Save". */
  readonly saveErrors: readonly string[] | null;
  /** False after the draft could not be written (editing goes on). */
  readonly stored: boolean;
  /** Run an engine edit operation. True when it was accepted. */
  apply(fn: (q: Quest) => EditResult): boolean;
  undo(): void;
  redo(): void;
  setTool(tool: Tool): void;
  setOpts(patch: Partial<ToolOpts>): void;
  select(sel: EditSelection): void;
  setPanel(panel: Panel): void;
  setNoteId(id: string | null): void;
  setPicking(req: PickRequest | null): void;
  setPendingBlock(cell: Cell | null): void;
  /** Open the thing a problem names: select it, show its tab, flash it on the board. */
  jump(ref: IssueRef | undefined): void;
  clearFlash(): void;
  say(text: string): void;
  dismissToast(): void;
  dismissWarnings(): void;
  /** Validate, then save. False when errors stop it (they are in `saveErrors`). */
  save(): Promise<boolean>;
  /** Resolves when every pending draft write has finished. */
  flush(): Promise<void>;
}

export type EditorStore = StoreApi<EditorState>;

export interface EditorInit {
  quest: Quest;
  /** The quest as it was saved. Defaults to `quest`. */
  clean?: Quest;
  store: UserQuestStore;
  now?: () => number;
}

const HISTORY_LIMIT = 200;

export function createEditorStore(init: EditorInit): EditorStore {
  const now = init.now ?? (() => Date.now());
  let counter = 0;
  let queue: Promise<void> = Promise.resolve();

  return createStore<EditorState>((set, get) => {
    const persist = (quest: Quest) => {
      const stamp = now();
      queue = queue.then(async () => {
        let ok = true;
        try {
          await init.store.saveDraft(quest, stamp);
        } catch {
          ok = false;
        }
        if (get().stored !== ok) set({ stored: ok });
      });
    };
    const toastOf = (text: string): EditorToast => ({ id: ++counter, text });

    return {
      quest: init.quest,
      clean: init.clean ?? init.quest,
      past: [],
      future: [],
      tool: 'select',
      opts: DEFAULT_OPTS,
      selection: null,
      panel: 'element',
      noteId: null,
      picking: null,
      pendingBlock: null,
      toast: null,
      flash: null,
      warnings: [],
      saveErrors: null,
      stored: true,

      apply(fn) {
        const { quest, past } = get();
        const r = fn(quest);
        if (!r.ok) {
          set({ toast: toastOf(r.error) });
          return false;
        }
        if (r.quest === quest) return true; // nothing changed
        set({
          quest: r.quest,
          past: [...past, quest].slice(-HISTORY_LIMIT),
          future: [],
          warnings: r.warnings,
          saveErrors: null,
          toast: null,
        });
        persist(r.quest);
        return true;
      },

      undo() {
        const { past, future, quest } = get();
        const prev = past[past.length - 1];
        if (!prev) return;
        set({
          quest: prev,
          past: past.slice(0, -1),
          future: [quest, ...future],
          selection: null,
          picking: null,
          pendingBlock: null,
          warnings: [],
          toast: null,
        });
        persist(prev);
      },

      redo() {
        const { past, future, quest } = get();
        const next = future[0];
        if (!next) return;
        set({
          quest: next,
          past: [...past, quest],
          future: future.slice(1),
          selection: null,
          picking: null,
          pendingBlock: null,
          warnings: [],
          toast: null,
        });
        persist(next);
      },

      setTool: (tool) => set({ tool, pendingBlock: null }),
      setOpts: (patch) => set({ opts: { ...get().opts, ...patch } }),
      select: (selection) =>
        set(selection ? { selection, panel: 'element', picking: null } : { selection }),
      setPanel: (panel) =>
        set(
          panel === 'notes' ? { panel, picking: null, selection: null } : { panel, picking: null },
        ),
      setNoteId: (noteId) => set({ noteId, picking: null }),
      setPicking: (picking) => set({ picking }),
      setPendingBlock: (pendingBlock) => set({ pendingBlock }),
      jump(ref) {
        const j = jumpFor(get().quest, ref);
        const hasFlash = j.flash.cells.length > 0 || j.flash.areas.length > 0;
        set({
          panel: j.panel,
          selection: j.selection,
          picking: null,
          pendingBlock: null,
          ...(j.panel === 'notes' ? { noteId: j.noteId } : {}),
          flash: hasFlash ? { ...j.flash, id: ++counter } : null,
        });
      },
      clearFlash: () => get().flash && set({ flash: null }),
      say: (text) => set({ toast: toastOf(text) }),
      dismissToast: () => get().toast && set({ toast: null }),
      dismissWarnings: () => set({ warnings: [] }),

      async save() {
        // Let queued draft writes finish first, or one could land after the draft is removed.
        await queue;
        const { quest } = get();
        const errors = validateQuestIssues(quest, board)
          .filter((i) => i.severity === 'error')
          .map((i) => i.message);
        if (errors.length > 0) {
          set({ saveErrors: errors });
          return false;
        }
        try {
          await init.store.save(quest, now());
          // Keep the draft if the user changed something while we were saving.
          if (get().quest === quest) await init.store.removeDraft(quest.id);
        } catch (e) {
          set({ toast: toastOf((e as Error).message) });
          return false;
        }
        set({ clean: quest, saveErrors: null, toast: toastOf('Saved.') });
        return true;
      },

      flush: () => queue,
    };
  });
}
