/**
 * The play store: a thin wrapper around the pure reducer. No React in here.
 *
 * - `dispatch(event)` runs the reducer, keeps the event list, autosaves after every event.
 * - `undo()` drops the last event (engine `undo`) and autosaves.
 * - The reducer's prompts become `fx` (what to animate) and `toast` (a short message).
 *
 * The save store is injected, so tests run with a MemorySaveStore and the clock is a parameter.
 */
import { createStore, type StoreApi } from 'zustand/vanilla';
import { packOfQuest } from '../packs';
import { activeLevel, keyOf, type CellKey, type Level } from '../../engine/board/level';
import { normalizeTeam, type TeamInput, type TeamMember } from '../../engine/data/team';
import type { GameEvent } from '../../engine/game/events';
import {
  EventError,
  startGame,
  reduce,
  replay,
  undo as engineUndo,
  type Reduced,
} from '../../engine/game/reducer';
import { monstersInPlay } from '../../engine/game/view';
import type { GameState } from '../../engine/game/state';
import { autosave, type SaveStore } from '../../persist/saves';
import type { Prompt } from '../../engine/game/prompts';
import type { EventErrorCode } from '../../engine/game/errors';
import { monsterCodes } from '../play/monsterCodes';
import { promptToasts } from '../play/promptToasts';
import { newRuleHints } from '../../engine/game/ruleHints';
import { newTiles, putTilesText } from '../../engine/game/tiles';
import { getQuestSettings } from '../settings';

/** What the board animates after an event: an ink reveal from `origin`, new tokens stamping in. */
export interface Fx {
  /** Changes with every event, so animations restart. */
  readonly id: number;
  readonly origin: readonly [number, number];
  /** Squares that just became known (including the floor under newly seen blocks). */
  readonly cells: ReadonlySet<CellKey>;
  /** Monsters seen for the first time by this event, in quest order. */
  readonly freshMonsters: readonly string[];
}

export interface Toast {
  readonly id: number;
  readonly text: string;
  /** Show an "Undo" button in the toast. */
  readonly undo: boolean;
}

export interface GameStoreState {
  /** The level of the map the heroes are on (it changes when they cross to another map). */
  readonly level: Level;
  /** The level the quest was built as: in a multi-map quest it holds all the maps. */
  readonly root: Level;
  readonly seed: number;
  readonly team: readonly TeamMember[];
  readonly events: readonly GameEvent[];
  readonly state: GameState;
  readonly fx: Fx | null;
  readonly toast: Toast | null;
  /** Prompts of the last accepted event (search and trap results), for the result sheet. */
  readonly prompts: readonly Prompt[];
  /** Counts up with every accepted event, undo and the start of a game: new prompts to show. */
  readonly promptsSeq: number;
  /** Why the last event was refused, if it was. */
  readonly error: { readonly code: EventErrorCode; readonly message: string } | null;
  /** False after an autosave failed (play goes on, the game is just not saved). */
  readonly saved: boolean;
  /** Returns false when the event was refused (the reason shows as a toast). */
  dispatch(event: GameEvent): boolean;
  undo(): void;
  dismissToast(): void;
  /** Write the current log now. */
  save(): Promise<void>;
  /** Resolves when every pending autosave has finished. */
  flush(): Promise<void>;
}

export interface GameStoreInit {
  level: Level;
  seed: number;
  team: readonly TeamInput[];
  /** A log to replay (resume). Throws if it does not replay on this quest. */
  events?: readonly GameEvent[];
  /** A new game: the notes that fire at the start of the quest are shown once. A resumed game
   *  is not fresh, so they are not replayed. */
  fresh?: boolean;
  saves: SaveStore;
  /** Played as part of the pack's campaign (decision 37). Kept in the save. */
  campaign?: boolean | undefined;
  /** The flags the quest begins with (a campaign carries them in, decision 37). Kept in the save. */
  startFlags?: Readonly<Record<string, boolean>> | undefined;
  /** The pack of the quest, kept in the save. Defaults to the pack that lists the quest. */
  pack?: string | undefined;
  now?: () => number;
}

export type GameStore = StoreApi<GameStoreState>;

export function createGameStore(init: GameStoreInit): GameStore {
  const { level: root, seed, saves } = init;
  const startFlags = init.startFlags ?? {};
  const team = normalizeTeam(init.team);
  const pack = init.pack ?? packOfQuest(root.quest.id);
  const now = init.now ?? (() => Date.now());
  const events0 = init.events ?? [];
  const start = init.fresh ? startGame(root, seed, startFlags) : undefined;
  const state0 = events0.length
    ? replay(root, seed, events0, startFlags)
    : (start ?? startGame(root, seed, startFlags)).state;
  let counter = 0;
  let queue: Promise<void> = Promise.resolve();

  return createStore<GameStoreState>((set, get) => {
    const persist = (events: readonly GameEvent[]) => {
      const stamp = now();
      queue = queue.then(async () => {
        const ok = await autosave(saves, root.quest.id, seed, team, events, stamp, {
          pack,
          startFlags,
          campaign: init.campaign,
        });
        if (get().saved !== ok) set({ saved: ok });
      });
    };
    const toastOf = (text: string, undo = false): Toast => ({ id: ++counter, text, undo });

    return {
      level: activeLevel(root, state0),
      root,
      seed,
      team,
      events: events0,
      state: state0,
      fx: null,
      toast: null,
      prompts: start?.prompts ?? [],
      promptsSeq: start ? 1 : 0,
      error: null,
      saved: true,

      dispatch(event) {
        const before = get().state;
        let reduced: Reduced;
        try {
          reduced = reduce(root, before, event);
        } catch (e) {
          if (e instanceof EventError) {
            set({ toast: toastOf(e.message), error: { code: e.code, message: e.message } });
            return false;
          }
          throw e;
        }
        const { state, prompts } = reduced;
        const level = activeLevel(root, state);
        const events = [...get().events, event];

        let fx: Fx | null = null;
        let toast: Toast | null = null;
        const shown = new Set(monstersInPlay(activeLevel(root, before), before).map((m) => m.id));
        const freshMonsters = monstersInPlay(level, state)
          .filter((m) => !shown.has(m.id) && level.quest.monsters.some((q) => q.id === m.id))
          .map((m) => m.id);
        for (const p of prompts) {
          if (p.kind === 'revealed') {
            const cells = new Set(p.cells);
            for (const b of level.blocks)
              if (state.seenBlocks.has(b.id) && !before.seenBlocks.has(b.id))
                for (const c of b.cells) cells.add(keyOf(c));
            fx = { id: ++counter, origin: p.origin, cells, freshMonsters };
          } else if (p.kind === 'nothingNew') toast = toastOf('Nothing new here.');
        }
        // A monster that woke or was placed by a note stamps in even with no reveal.
        if (!fx && freshMonsters.length > 0)
          fx = { id: ++counter, origin: [0, 0], cells: new Set(), freshMonsters };
        const lines = promptToasts(prompts);
        if (lines.length > 0) toast = toastOf(lines.join(' '));
        if (event.type === 'MONSTER_KILL')
          toast = toastOf(
            `${monsterCodes(level, state.seenMonsters, state.wanderers).get(event.monster) ?? 'Monster'} slain.`,
            true,
          );
        if (event.type === 'MONSTER_LEAVE')
          toast = toastOf(
            `${monsterCodes(level, state.seenMonsters, state.wanderers).get(event.monster) ?? 'Monster'} ${event.reason === 'freed' ? 'was freed' : event.reason}. Not a kill.`,
            true,
          );
        // The real Zargon page (orders per monster) is milestone M5. For now the button only
        // ends the turn; notes that fire on a turn come back as prompts and show as sheets.
        if (event.type === 'ZARGON_TURN_END')
          toast = toastOf([`Heroes' turn ${state.turn}.`, ...lines].join(' '), true);

        // Rule hints (decision 60): a reminder the first time a terrain or a room tile comes into view.
        const hints = getQuestSettings(level.quest.id).ruleHints
          ? newRuleHints(level, before, state)
          : [];
        // A tile to put on the board is not a hint: it is always said, so the board matches the app.
        const tiles = newTiles(level, before, state);
        if (tiles.length > 0 || hints.length > 0)
          toast = toastOf(
            [
              ...(tiles.length > 0 ? [putTilesText(tiles)] : []),
              ...hints.map((h) => `${h.name}: ${h.lines[0]}`),
            ].join(' '),
          );

        set({
          level,
          events,
          state,
          fx,
          toast,
          prompts,
          promptsSeq: get().promptsSeq + 1,
          error: null,
        });
        persist(events);
        return true;
      },

      undo() {
        const { events } = get();
        if (events.length === 0) return;
        const r = engineUndo(root, seed, events, startFlags);
        set({
          level: activeLevel(root, r.state),
          events: r.events,
          state: r.state,
          fx: null,
          toast: null,
          prompts: [],
          promptsSeq: get().promptsSeq + 1,
          error: null,
        });
        persist(r.events);
      },

      dismissToast() {
        if (get().toast) set({ toast: null });
      },

      async save() {
        persist(get().events);
        await queue;
      },

      flush: () => queue,
    };
  });
}
