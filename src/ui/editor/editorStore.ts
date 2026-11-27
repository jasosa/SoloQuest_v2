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
import type { LibraryContent } from '../../engine/editor/library';
import type { BoardTileType, RoomTileType } from '../../engine/data/roomTiles';
import { foreignIdsOf, swapTo } from '../../engine/editor/maps';
import { approveQuest, questStatus, withdrawQuest } from '../../engine/editor/status';
import { ok, withForeignIds } from '../../engine/editor/result';
import { firstMapId, questMaps } from '../../engine/quest/maps';
import type { EnemyDef, FurnitureDef, Quest } from '../../engine/quest/schema';
import type { UserQuestStore } from '../../persist/userQuests';
import type { IssueRef } from '../../engine/quest/validate';
import { jumpFor, type Flash } from './problems';
import {
  commitMonsterDraft,
  defChanges,
  hasAddedDefs,
  isMonsterDirty,
  monsterDraftOf,
  newMonsterDraft,
  onlyAddedDefs,
  removeAddedDefs,
  runOnMonsterDraft,
  type MonsterDraft,
} from './monsterDraft';
import { NO_PICK, mergeTrial, tapRoom, type MergePick } from './mergePick';
import { addAreaMerges } from '../../engine/editor';
import { commitDraft, draftOf, isDirty, patchDraft, type NoteDraft } from './noteDraft';
import type { NotePatch } from '../../engine/editor';
import type { Note } from '../../engine/quest/schema';

export type Tool =
  | 'select'
  | 'rock'
  | 'doors'
  | 'blocks'
  | 'furniture'
  | 'tiles'
  | 'monsters'
  | 'traps'
  | 'markers'
  | 'zones'
  | 'merge'
  | 'start';

export type EditSelection =
  | {
      readonly kind: 'door' | 'furniture' | 'monster' | 'trap' | 'marker' | 'zone';
      readonly id: string;
    }
  | { readonly kind: 'block'; readonly cell: Cell }
  /** A board tile, by its place in the quest's `boardTiles`. */
  | { readonly kind: 'tile'; readonly index: number }
  /** A room tile, by its place in the quest's `roomTiles`. */
  | { readonly kind: 'roomTile'; readonly index: number }
  /** One end of an ice tunnel. */
  | { readonly kind: 'tunnel'; readonly id: string; readonly end: 'a' | 'b' }
  | null;

/** What the Doors tool places: the three door kinds, an ice tunnel, or an exterior door. */
export type DoorTool = DoorKind | 'tunnel' | 'ironEntry' | 'woodenExit';

/** What the Tiles tool places: a board tile or a room tile. */
export type TilePick =
  | { readonly group: 'board'; readonly type: BoardTileType }
  | { readonly group: 'room'; readonly type: RoomTileType };

export interface ToolOpts {
  readonly rockRoom: boolean;
  readonly doorKind: DoorTool;
  /** Design number of the next ice tunnel (1 to 9); a used one gives way to the first free one. */
  readonly tunnelDesign: number;
  readonly tile: TilePick;
  /** Which of the tile's sizes is laid (an index into its footprints). */
  readonly tileVariant: number;
  readonly tileTurned: boolean;
  readonly blockDouble: boolean;
  readonly furnitureType: FurnitureDef['type'];
  readonly furnitureTurned: boolean;
  readonly monsterType: MonsterKind;
  /** A monster is picked in the Monsters tool (the "Placing" row). Nothing is placed until one is. */
  readonly monsterPicked: boolean;
  /** A custom enemy to put on the map instead of a core type (the quest's own or the library's). */
  readonly monsterEnemy: {
    readonly def: EnemyDef;
    readonly fromLibrary: boolean;
    readonly lib: LibraryContent;
  } | null;
  readonly trapKind:
    | 'pit'
    | 'fallingBlock'
    | 'spear'
    | 'stalactite'
    | 'swingingAxe'
    | 'wanderingTrap'
    | 'slipperyIce'
    | 'chest';
  readonly markerLabel: string;
  readonly markerVisible: 'editor' | 'players';
  /** The zone the Zones tool is painting; null starts a new one on the next click. */
  readonly zoneId: string | null;
  readonly roomIds: boolean;
}

export const DEFAULT_OPTS: ToolOpts = {
  rockRoom: false,
  doorKind: 'normal',
  tunnelDesign: 1,
  tile: { group: 'board', type: 'slipperyIce' },
  tileVariant: 0,
  tileTurned: false,
  blockDouble: false,
  furnitureType: 'table',
  furnitureTurned: false,
  monsterType: 'orc',
  monsterPicked: false,
  monsterEnemy: null,
  trapKind: 'pit',
  markerLabel: 'A',
  markerVisible: 'editor',
  zoneId: null,
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

/** The tabs of the editor (the mockup of decision 70). */
export type EditorTabName = 'Quest' | 'Map' | 'Actions' | 'Monsters' | 'Library';

/** A short highlight on the board after a jump from the Problems panel. `id` restarts it. */
export interface BoardFlash extends Flash {
  readonly id: number;
}

export interface EditorToast {
  readonly id: number;
  readonly text: string;
}

export interface EditorState {
  /**
   * The quest with the map on show swapped into its top-level fields (`swapTo`), so every panel
   * and edit works on one map. A quest with one map is the same as `canon`.
   */
  readonly quest: Quest;
  /** The quest in its saved form: map 1 on top. Save, export, play, undo and the draft use this. */
  readonly canon: Quest;
  /** The id of the map on show. */
  readonly mapId: string;
  /** The quest as last saved (canonical): the draft differs from it when there are unsaved changes. */
  readonly clean: Quest;
  /** Undo history, in canonical form. */
  readonly past: readonly Quest[];
  readonly future: readonly Quest[];
  readonly tool: Tool;
  readonly opts: ToolOpts;
  readonly selection: EditSelection;
  /** The editor tab on show. */
  readonly tab: EditorTabName;
  /** Inspector tab: the selected element or the note builder. */
  readonly panel: Panel;
  /** The note open in the note builder. */
  readonly noteId: string | null;
  /** The copy of that action the form edits. Nothing reaches the quest until `saveNote`. */
  readonly noteDraft: NoteDraft | null;
  /** Merge rooms: the room that stays and the room that joins it (decision 106). Cleared with the tool. */
  readonly mergePick: MergePick;
  /** Merge rooms: the sentence of the last refused tap, until the next tap. */
  readonly mergeError: string | null;
  /** Merge rooms: the absorbed room whose list row is picked (its merged room is ringed on the board). */
  readonly mergeRow: string | null;
  /** A refusal of the tool in use (a door on a merged wall), shown in its card until the next tap or tool change. */
  readonly toolError: string | null;
  /** The copy of the picked monster the Monsters tab edits. Nothing reaches the quest until `saveMonster`. */
  readonly monsterDraft: MonsterDraft | null;
  /** The ability of the quest open in its popup (decision 70). */
  readonly abilityId: string | null;
  /** The spell of the quest open in its popup. */
  readonly spellId: string | null;
  /** Set while the note builder waits for a click on the board. */
  readonly picking: PickRequest | null;
  /** The tab the pick started from: it comes back when the pick ends or is cancelled. */
  readonly pickReturn: EditorTabName | null;
  /** First square of a double block, waiting for the second click. */
  readonly pendingBlock: Cell | null;
  /** End A of an ice tunnel, waiting for end B. */
  readonly pendingTunnel: Cell | null;
  readonly toast: EditorToast | null;
  readonly flash: BoardFlash | null;
  /** Warnings of the last change (for example notes that point at a removed door). */
  readonly warnings: readonly Issue[];
  /** Errors that stopped the last "Save". */
  readonly saveErrors: readonly string[] | null;
  /** False after the draft could not be written (editing goes on). */
  readonly stored: boolean;
  /** Run an engine edit operation on the map on show. True when it was accepted. */
  apply(fn: (q: Quest) => EditResult): boolean;
  /** Run an edit operation on the whole quest (maps, links). True when it was accepted. */
  applyQuest(fn: (q: Quest) => EditResult): boolean;
  /** Show another map of a multi-map quest. */
  setMap(id: string): void;
  undo(): void;
  redo(): void;
  setTool(tool: Tool): void;
  setOpts(patch: Partial<ToolOpts>): void;
  select(sel: EditSelection): void;
  setTab(tab: EditorTabName): void;
  setPanel(panel: Panel): void;
  /** Open an action of the quest in the form (a fresh copy), or close the form: edits are dropped. */
  setNoteId(id: string | null): void;
  /** Open a new action in the form. It is added to the quest by `saveNote`. */
  startNewNote(note: Note): void;
  /**
   * Open a new monster in the Monsters tab, made by an engine edit that is not applied. It is added to
   * the quest by `saveMonster`. What the edit makes outside the monster (an enemy copied from the
   * Library) is written at once.
   */
  addMonsterDraft(op: (q: Quest) => EditResult): boolean;
  /**
   * Run an engine edit on the monster draft. What the edit makes outside the monster (a library
   * ability or spell copied into the quest) is written at once. False when the engine refuses.
   */
  editMonster(op: (q: Quest) => EditResult): boolean;
  /** Drop the monster draft and take out the definitions it added (no undo step). */
  dropMonster(): void;
  /** Merge rooms: a tap on a room (null: the corridor or rock, which does nothing). */
  mergeTap(room: string | null): void;
  /** Merge rooms: empty both slots. */
  mergeClear(): void;
  /** Merge rooms: merge the picked pair. False when the engine refuses (the card says why). */
  mergeNow(): boolean;
  /** Merge rooms: pick (or drop) the list row of an absorbed room. */
  setMergeRow(room: string | null): void;
  /** Show or clear the refusal of the tool in use. */
  setToolError(text: string | null): void;
  /** Write the monster draft into the quest as one change. The card stays open on the saved monster. */
  saveMonster(): boolean;
  /** Drop the edits of the monster draft: the card shows the saved monster again (a new monster is dropped). */
  cancelMonster(): void;
  /** Change the draft of the open action. False when the engine refuses (a toast says why). */
  patchNote(patch: NotePatch): boolean;
  /** Write the draft into the quest as one change. The form closes, or stays open on the saved action. */
  saveNote(keepOpen?: boolean): boolean;
  setAbilityId(id: string | null): void;
  setSpellId(id: string | null): void;
  setPicking(req: PickRequest | null): void;
  setPendingBlock(cell: Cell | null): void;
  setPendingTunnel(cell: Cell | null): void;
  /** Open the thing a problem names: select it, show its tab, flash it on the board. */
  jump(ref: IssueRef | undefined, message?: string): void;
  clearFlash(): void;
  say(text: string): void;
  dismissToast(): void;
  dismissWarnings(): void;
  /** Validate, then save. False when errors stop it (they are in `saveErrors`). */
  save(): Promise<boolean>;
  /**
   * Approve (saves the whole working copy, refused with the engine sentence when it has errors) or
   * withdraw (writes the saved quest as not approved, with no validation). The status is not an
   * undo step: it is the same in every step of the history. Resolves to the error text, or null.
   */
  setStatus(next: 'approved' | 'draft'): Promise<string | null>;
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

/** The form state for an action id: the id and a fresh draft, or both empty when it is gone. */
/** The draft of the picked monster, or none when the selection is not a monster. */
/** Every touched definition of a change is a new one. */
const onlyAdded = (c: ReturnType<typeof defChanges>): boolean =>
  (['abilities', 'spells', 'enemies'] as const).every((k) =>
    c.touched[k].every((id) => c.added[k].includes(id)),
  );

const monsterDraftFor = (q: Quest, sel: EditSelection): MonsterDraft | null => {
  const m = sel?.kind === 'monster' ? q.monsters.find((x) => x.id === sel.id) : undefined;
  return m ? monsterDraftOf(m) : null;
};

const openNote = (q: Quest, id: string | null) => {
  const n = id ? q.notes.find((x) => x.id === id) : undefined;
  return { noteId: n ? n.id : null, noteDraft: n ? draftOf(n) : null };
};

/** A quest of the history with the status of the quest on show (the status is not an undo step). */
const keepStatus = (q: Quest | undefined, shown: Quest): Quest | undefined =>
  q === undefined || questStatus(q) === questStatus(shown)
    ? q
    : { ...q, status: questStatus(shown) };

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
    /** Write a quest without an undo step (definitions of a monster draft). */
    const writeSilently = (next: Quest, warnings: readonly Issue[]) => {
      const canon = get().canon;
      const nextCanon = swapTo(next, firstMapId(canon));
      set({ quest: next, canon: nextCanon, warnings, saveErrors: null, toast: null });
      persist(nextCanon);
    };

    // The oriented quest of a canonical one, for the map on show (map 1 when it is gone).
    const orient = (canon: Quest, wanted: string): { quest: Quest; mapId: string } => {
      const target = wanted === firstMapId(canon) || canon.maps?.some((m) => m.id === wanted);
      const mapId = target ? wanted : firstMapId(canon);
      return { quest: swapTo(canon, mapId), mapId };
    };
    const reset = {
      selection: null,
      mergePick: NO_PICK,
      mergeError: null,
      mergeRow: null,
      toolError: null,
      monsterDraft: null,
      picking: null,
      pickReturn: null,
      pendingBlock: null,
      pendingTunnel: null,
      flash: null,
    } as const;

    return {
      quest: init.quest,
      canon: init.quest,
      mapId: firstMapId(init.quest),
      clean: init.clean ?? init.quest,
      past: [],
      future: [],
      tool: 'select',
      opts: DEFAULT_OPTS,
      selection: null,
      tab: 'Map',
      panel: 'element',
      noteId: null,
      noteDraft: null,
      monsterDraft: null,
      mergePick: NO_PICK,
      mergeError: null,
      mergeRow: null,
      toolError: null,
      abilityId: null,
      spellId: null,
      picking: null,
      pickReturn: null,
      pendingBlock: null,
      pendingTunnel: null,
      toast: null,
      flash: null,
      warnings: [],
      saveErrors: null,
      stored: true,

      apply(fn) {
        const { quest, canon, past, mapId, monsterDraft } = get();
        // new ids must not repeat the ids of the other maps
        const r = withForeignIds(foreignIdsOf(quest), () => fn(quest));
        if (!r.ok) {
          set({ toast: toastOf(r.error) });
          return false;
        }
        if (r.quest === quest) return true; // nothing changed
        const nextCanon = swapTo(r.quest, firstMapId(canon));
        // an edit of a definition the monster draft added (in its ability or spell popup) is part of
        // the draft: no undo step of its own, "Save monster" makes the one step
        const silent = monsterDraft !== null && onlyAddedDefs(quest, r.quest, monsterDraft);
        set({
          quest: r.quest,
          canon: nextCanon,
          mapId,
          ...(silent ? {} : { past: [...past, canon].slice(-HISTORY_LIMIT), future: [] }),
          warnings: r.warnings,
          saveErrors: null,
          toast: null,
        });
        persist(nextCanon);
        return true;
      },

      applyQuest(fn) {
        const { canon, past, mapId } = get();
        const r = fn(canon);
        if (!r.ok) {
          set({ toast: toastOf(r.error) });
          return false;
        }
        if (r.quest === canon) return true;
        const view = orient(r.quest, mapId);
        set({
          ...view,
          canon: r.quest,
          past: [...past, canon].slice(-HISTORY_LIMIT),
          future: [],
          warnings: r.warnings,
          saveErrors: null,
          toast: null,
          ...(view.mapId !== mapId ? reset : {}),
        });
        persist(r.quest);
        return true;
      },

      setMap(id) {
        const { canon, mapId } = get();
        if (id === mapId) return;
        get().dropMonster();
        const view = orient(canon, id);
        set({ ...view, ...reset, tool: 'select', warnings: [], toast: null });
      },

      undo() {
        get().dropMonster();
        const { past, future, canon, mapId } = get();
        const prev = keepStatus(past[past.length - 1], canon);
        if (!prev) return;
        set({
          ...orient(prev, mapId),
          ...openNote(orient(prev, mapId).quest, get().noteId),
          canon: prev,
          past: past.slice(0, -1),
          future: [canon, ...future],
          selection: null,
          monsterDraft: null,
          mergePick: NO_PICK,
          mergeError: null,
          mergeRow: null,
          picking: null,
          pendingBlock: null,
          pendingTunnel: null,
          warnings: [],
          toast: null,
        });
        persist(prev);
      },

      redo() {
        get().dropMonster();
        const { past, future, canon, mapId } = get();
        const next = keepStatus(future[0], canon);
        if (!next) return;
        set({
          ...orient(next, mapId),
          ...openNote(orient(next, mapId).quest, get().noteId),
          canon: next,
          past: [...past, canon],
          future: future.slice(1),
          selection: null,
          monsterDraft: null,
          mergePick: NO_PICK,
          mergeError: null,
          mergeRow: null,
          picking: null,
          pendingBlock: null,
          pendingTunnel: null,
          warnings: [],
          toast: null,
        });
        persist(next);
      },

      // picking a tool (even the one already on) clears the selection and any half-done pick (decision 104)
      setTool(tool) {
        get().dropMonster();
        set({
          tool,
          opts: { ...get().opts, monsterPicked: false }, // a tool change drops the monster pick
          panel: 'element', // a tool chip puts the tool's options back after the Problems view (decision 105)
          selection: null,
          monsterDraft: null,
          pendingBlock: null,
          pendingTunnel: null,
          mergePick: NO_PICK,
          mergeError: null,
          mergeRow: null,
          toolError: null,
        });
      },
      setOpts: (patch) => set({ opts: { ...get().opts, ...patch } }),
      select(selection) {
        get().dropMonster();
        set({
          monsterDraft: monsterDraftFor(get().quest, selection),
          ...(selection ? { selection, panel: 'element', picking: null } : { selection }),
        });
      },
      // a draft belongs to the tab it was opened in: changing tab drops it
      setTab(tab) {
        get().dropMonster();
        set({
          tab,
          panel: 'element',
          picking: null,
          noteId: null,
          noteDraft: null,
          monsterDraft: tab === 'Monsters' ? monsterDraftFor(get().quest, get().selection) : null,
        });
      },
      mergeTap(room) {
        if (room === null) return;
        const r = tapRoom(get().quest, get().mergePick, room);
        // a tap that changes nothing (a merged-away room) says nothing and leaves everything as it was
        if (r.pick === get().mergePick && r.error === null) return;
        set({ mergePick: r.pick, mergeError: r.error, mergeRow: null });
      },
      mergeClear: () => set({ mergePick: NO_PICK, mergeError: null }),
      mergeNow() {
        const { quest, mergePick } = get();
        if (mergeTrial(quest, mergePick).state !== 'ready' || !mergePick.a) return false;
        const { a, joins } = mergePick;
        // all of them in one undo step, or none (an empty list is never sent)
        if (joins.length === 0 || !get().apply((q) => addAreaMerges(q, a, joins))) return false;
        set({ mergePick: NO_PICK, mergeError: null });
        return true;
      },
      setMergeRow: (mergeRow) => set({ mergeRow }),
      setToolError: (toolError) => set({ toolError }),
      dropMonster() {
        const { monsterDraft, quest } = get();
        if (!monsterDraft) return;
        // take out the definitions only this draft added; the undo history is untouched
        const cleaned = removeAddedDefs(quest, monsterDraft);
        if (cleaned) {
          const canon = get().canon;
          const nextCanon = swapTo(cleaned, firstMapId(canon));
          set({ quest: cleaned, canon: nextCanon, abilityId: null, spellId: null });
          persist(nextCanon);
        }
        set({ monsterDraft: null });
      },
      addMonsterDraft(op) {
        get().dropMonster();
        const { quest } = get();
        const r = withForeignIds(foreignIdsOf(quest), () => op(quest));
        if (!r.ok) {
          set({ toast: toastOf(r.error) });
          return false;
        }
        const made = r.quest.monsters.at(-1);
        if (!made) return false;
        const outside = { ...r.quest, monsters: quest.monsters };
        let draft = newMonsterDraft(made);
        if (
          outside.abilityDefs !== quest.abilityDefs ||
          outside.spellDefs !== quest.spellDefs ||
          outside.enemyDefs !== quest.enemyDefs
        ) {
          const c = defChanges(quest, outside);
          if (!c.other && onlyAdded(c)) {
            const res = ok(outside, r.warnings);
            if (!res.ok) {
              set({ toast: toastOf(res.error) });
              return false;
            }
            draft = { ...draft, added: c.added, base: get().canon };
            writeSilently(res.quest, res.warnings);
          } else if (!get().apply(() => ok(outside, r.warnings))) return false;
        }
        set({ selection: null, monsterDraft: draft, picking: null });
        return true;
      },
      editMonster(op) {
        const { quest, monsterDraft } = get();
        if (!monsterDraft) return false;
        const r = withForeignIds(foreignIdsOf(quest), () =>
          runOnMonsterDraft(quest, monsterDraft, op),
        );
        if (!r.ok) {
          set({ toast: toastOf(r.error) });
          return false;
        }
        let draft = r.draft;
        const outside = r.quest;
        if (outside) {
          const res = ok(outside, []);
          if (!res.ok) {
            set({ toast: toastOf(res.error) });
            return false;
          }
          if (r.onlyNew) {
            // new definitions are written at once and stay part of the draft
            draft = { ...draft, base: draft.base ?? get().canon };
            writeSilently(res.quest, res.warnings);
          } else if (!get().apply(() => res)) return false;
        }
        set({ monsterDraft: draft });
        return true;
      },
      saveMonster() {
        const { monsterDraft } = get();
        if (!monsterDraft) return false;
        if (isMonsterDirty(get().quest, monsterDraft) || hasAddedDefs(monsterDraft)) {
          if (!get().apply((q) => commitMonsterDraft(q, monsterDraft))) return false;
          // one undo step: back to the quest before the draft added its definitions
          const { base } = monsterDraft;
          if (base) set({ past: [...get().past.slice(0, -1), base] });
        }
        const saved = get().quest.monsters.find((m) => m.id === monsterDraft.monster.id);
        set({
          selection: saved ? { kind: 'monster', id: saved.id } : null,
          monsterDraft: saved ? monsterDraftOf(saved) : null,
        });
        return true;
      },
      cancelMonster() {
        get().dropMonster();
        set({ monsterDraft: monsterDraftFor(get().quest, get().selection) });
      },
      setPanel: (panel) => {
        if (panel === 'notes') get().dropMonster();
        set(
          // the actions list is the Actions tab now, not a panel beside the map
          panel === 'notes'
            ? {
                panel: 'element',
                picking: null,
                selection: null,
                monsterDraft: null,
                tab: 'Actions',
              }
            : { panel, picking: null },
        );
      },
      setNoteId(noteId) {
        // an action of another map opens that map, so its places and elements are the ones shown
        const note = noteId ? get().canon.notes.find((n) => n.id === noteId) : undefined;
        if (note?.map && note.map !== get().mapId) get().setMap(note.map);
        set({ ...openNote(get().quest, noteId), picking: null });
      },
      startNewNote(note) {
        set({ noteId: note.id, noteDraft: { note, isNew: true }, picking: null });
      },
      patchNote(patch) {
        const { quest, noteDraft } = get();
        if (!noteDraft) return false;
        const r = patchDraft(quest, noteDraft, patch);
        if (!r.ok) {
          set({ toast: toastOf(r.error) });
          return false;
        }
        set({ noteDraft: r.draft });
        return true;
      },
      saveNote(keepOpen = false) {
        const { noteDraft } = get();
        if (!noteDraft) return false;
        // nothing changed: close the form without an undo step
        if (isDirty(get().quest, noteDraft) && !get().apply((q) => commitDraft(q, noteDraft)))
          return false;
        set(
          keepOpen ? openNote(get().quest, noteDraft.note.id) : { noteId: null, noteDraft: null },
        );
        return true;
      },
      setAbilityId: (abilityId) => set({ abilityId }),
      setSpellId: (spellId) => set({ spellId }),
      // picking needs the board, so the Map tab comes back while a square is chosen
      // and the tab it came from comes back when the pick ends, so the Actions tab stays the Actions tab
      setPicking(picking) {
        const cur = get();
        if (picking)
          set({
            picking,
            tab: 'Map',
            pickReturn: cur.picking ? cur.pickReturn : cur.tab,
          });
        else
          set({
            picking: null,
            pickReturn: null,
            ...(cur.picking && cur.pickReturn ? { tab: cur.pickReturn } : {}),
          });
      },
      setPendingBlock: (pendingBlock) => set({ pendingBlock }),
      setPendingTunnel: (pendingTunnel) => set({ pendingTunnel }),
      jump(ref, message) {
        // an issue of another map ("Map Name: ...") opens that map first
        const named = message?.match(/^Map (.+?): /)?.[1];
        if (named) {
          const target = questMaps(get().canon).find((m) => (m.name ?? m.id) === named);
          if (target) get().setMap(target.id);
        }
        get().dropMonster();
        const j = jumpFor(get().quest, ref);
        const noteMap = j.noteId
          ? get().canon.notes.find((n) => n.id === j.noteId)?.map
          : undefined;
        if (noteMap && noteMap !== get().mapId) get().setMap(noteMap);
        const hasFlash = j.flash.cells.length > 0 || j.flash.areas.length > 0;
        set({
          // a problem of an element picks Select and selects it; one of the quest itself opens the Quest tab
          tab:
            j.panel === 'notes'
              ? 'Actions'
              : j.panel === 'element' && !j.selection
                ? 'Quest'
                : 'Map',
          panel: j.panel === 'notes' ? 'element' : j.panel,
          ...(j.selection ? { tool: 'select' as const } : {}),
          selection: j.selection,
          monsterDraft: null,
          picking: null,
          pendingBlock: null,
          pendingTunnel: null,

          ...(j.panel === 'notes' ? openNote(get().quest, j.noteId) : {}),
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
        const quest = get().canon;
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
          if (get().canon === quest) await init.store.removeDraft(quest.id);
        } catch (e) {
          set({ toast: toastOf((e as Error).message) });
          return false;
        }
        set({ clean: quest, saveErrors: null, toast: toastOf('Saved.') });
        return true;
      },

      async setStatus(next) {
        await queue;
        const { canon, clean, past, future, quest } = get();
        const wasClean = canon === clean;
        let saved: Quest;
        if (next === 'approved') {
          const r = approveQuest(canon);
          if (!r.ok) return r.error;
          saved = r.quest;
        } else {
          // the stored quest is written as it is; only its status changes
          let stored: Quest | undefined;
          try {
            stored = await init.store.load(canon.id);
          } catch {
            stored = undefined;
          }
          saved = withdrawQuest(stored ?? clean);
        }
        try {
          await init.store.save(saved, now());
          if (next === 'approved' && get().canon === canon) await init.store.removeDraft(canon.id);
        } catch (e) {
          return (e as Error).message;
        }
        // the working copy takes the status after the write; shared objects stay shared
        const memo = new Map<Quest, Quest>();
        const as = (q: Quest): Quest => {
          let m = memo.get(q);
          if (!m) {
            m = questStatus(q) === next ? q : { ...q, status: next };
            memo.set(q, m);
          }
          return m;
        };
        const nextCanon = as(canon);
        const nextClean = next === 'approved' ? nextCanon : wasClean ? nextCanon : as(clean);
        set({
          canon: nextCanon,
          clean: nextClean,
          quest: as(quest),
          past: past.map(as),
          future: future.map(as),
        });
        // a working copy with unsaved edits keeps its draft, now with the new status
        if (!(next === 'approved' || wasClean)) persist(nextCanon);
        return null;
      },

      flush: () => queue,
    };
  });
}
