import { restorePack } from './theme/activate';
import { setActiveTheme } from './theme/activeTheme';
import { TexturesDialog } from './theme/TexturesDialog';
import { DexieThemeStore, MemoryThemeStore, type ThemeStore } from '../persist/themes';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { board } from '../engine/board/board';
import { buildLevel } from '../engine/board/level';
import type { Quest } from '../engine/quest/schema';
import { HEROES, type Hero } from '../engine/data/heroes';
import type { TeamInput } from '../engine/data/team';
import type { GameEvent } from '../engine/game/events';
import type { Level } from '../engine/board/level';
import {
  DexieReferenceStore,
  MemoryReferenceStore,
  type ReferenceStore,
} from '../persist/reference';
import { DexieSaveStore, MemorySaveStore, type SaveExtra, type SaveStore } from '../persist/saves';
import { LocalCampaignStore, MemoryCampaignStore, type CampaignStore } from '../persist/campaigns';
import { newCampaign, startFlagsFor, type Campaign } from '../engine/pack/campaign';
import { trackCampaign } from './store/campaignTracker';
import { packs } from './packs';
import { toStored } from '../engine/data/team';
import { BoardView } from './board/BoardView';
import { knownFor, parseState } from './board/boardStates';
import { PlayScreen } from './play/PlayScreen';
import { devTestLevel, levelOfId, levelOfSlot } from './quests';
import { SelectScreen, type StartChoice } from './select/SelectScreen';
import { EditorScreen } from './editor/EditorScreen';
import { EditorStart } from './editor/EditorStart';
import { DesignerScreen, type QuestUpdater } from './designer/DesignerScreen';
import { LibraryProvider } from './designer/LibraryContext';
import { DexieLibraryStore, MemoryLibraryStore, type LibraryStore } from '../persist/library';
import { createEditorStore, type EditorStore } from './editor/editorStore';
import {
  DexieUserQuestStore,
  MemoryUserQuestStore,
  type UserQuestStore,
} from '../persist/userQuests';
import { createGameStore, type GameStore } from './store/gameStore';
import { openSaved, SAVED_GAME_FAILED } from './store/openSaved';
import './shared/tokens.css';
import './shared/controls.css';
import './app.css';
import './play/play.css';
import './select/select.css';
import './editor/editor.css';

/** A new random seed. Math.random is fine here: it is outside the engine. */
const freshSeed = () => Math.floor(Math.random() * 2 ** 31);

function openGame(
  saves: SaveStore,
  level: Level,
  seed: number,
  team: readonly TeamInput[],
  events: readonly GameEvent[] = [],
  fresh = false,
  extra: SaveExtra = {},
): GameStore {
  return createGameStore({ level, seed, team, events, saves, fresh, ...extra });
}

/** `?quest=1` or `?quest=103` (a bundled quest by slot) or `?quest=fh03-the-rescue` (by id). `?quest=test` (development only) loads asynchronously. */
function levelFromParams(params: URLSearchParams): Level | undefined {
  const raw = params.get('quest');
  const n = raw === null || raw === '' ? NaN : Number(raw);
  if (Number.isInteger(n)) return levelOfSlot(n);
  return raw ? levelOfId(raw) : undefined;
}

/**
 * Jump straight into a game from the URL, for e2e tests and screenshots:
 * `?quest=1&team=dwarf,elf` plus optional `seed=7`, `open=d1,look@13:18,d5` (doors and looks done at the start, in order),
 * `look=12:18` (squares looked from), `select=door:d3`, `nosave=1` (no IndexedDB), `resume=1`.
 * In development `?quest=test` plays the engine test fixture, `?quest=test-maps` the two-map one.
 */
function startFromUrl(
  params: URLSearchParams,
  saves: SaveStore,
  level: Level | undefined = levelFromParams(params),
): GameStore | 'resume' | 'dev' | null {
  if (!level)
    return ['test', 'frozen', 'test-maps'].includes(params.get('quest') ?? '') &&
      import.meta.env.DEV
      ? 'dev'
      : null;
  if (params.has('resume')) return 'resume';
  const team = (params.get('team') ?? 'dwarf')
    .split(',')
    .filter((h): h is Hero => (HEROES as readonly string[]).includes(h));
  const events: GameEvent[] = [];
  // `open` is an ordered list: door ids, or `look@x:y` for a look from a corridor square.
  for (const item of (params.get('open') ?? '').split(',').filter(Boolean)) {
    if (item.startsWith('look@')) {
      const [x, y] = item.slice(5).split(':').map(Number);
      if (x !== undefined && y !== undefined) events.push({ type: 'LOOK_FROM', cell: [x, y] });
    } else events.push({ type: 'OPEN_DOOR', door: item });
  }
  for (const at of (params.get('look') ?? '').split(',').filter(Boolean)) {
    const [x, y] = at.split(':').map(Number);
    if (x !== undefined && y !== undefined) events.push({ type: 'LOOK_FROM', cell: [x, y] });
  }
  const seed = params.has('seed') ? Number(params.get('seed')) : freshSeed();
  // A game opened by the URL is a one-shot: carried flags take their one-shot values.
  const store = openGame(saves, level, seed, team.length ? team : ['dwarf'], events, true, {
    startFlags: startFlagsFor(level.quest, undefined),
  });
  void store.getState().save();
  return store;
}

export function App() {
  const params = useMemo(() => new URLSearchParams(location.search), []);

  // Development only: `?theme=test` loads flat test pictures (never bundled in production).
  useEffect(() => {
    const which = params.get('theme');
    if (!import.meta.env.DEV || (which !== 'test' && which !== 'board')) return;
    void import('./theme/testTheme').then((m) =>
      setActiveTheme(which === 'board' ? m.TEST_BOARD_THEME : m.TEST_THEME),
    );
  }, [params]);

  // Debug board for map checks: `?state=fog|partial|full&labels=1`.
  if (params.has('state'))
    return (
      <div className="app">
        <header>
          <span className="qn">Board</span>
          <h1>SoloQuest</h1>
        </header>
        <main className="map">
          <BoardView
            board={board}
            known={knownFor(board, parseState(params.get('state')))}
            labels={params.has('labels')}
          />
        </main>
      </div>
    );

  return <Game params={params} />;
}

function Game({ params }: { params: URLSearchParams }) {
  const saves = useMemo<SaveStore>(
    () => (params.has('nosave') ? new MemorySaveStore() : new DexieSaveStore()),
    [params],
  );
  const [game, setGame] = useState<GameStore | null | 'resume' | 'dev'>(() =>
    startFromUrl(params, saves),
  );

  const [notice, setNotice] = useState<string | undefined>();

  // The quest editor: its own screens, quests kept in their own database.
  const userStore = useMemo<UserQuestStore>(
    () => (params.has('nosave') ? new MemoryUserQuestStore() : new DexieUserQuestStore()),
    [params],
  );
  const themeStore = useMemo<ThemeStore>(
    () => (params.has('nosave') ? new MemoryThemeStore() : new DexieThemeStore()),
    [params],
  );
  const [textures, setTextures] = useState(false);
  /** The name of the texture pack in use (null: the built-in look), shown on the quest select screen. */
  const [textureName, setTextureName] = useState<string | null>(null);
  const readTextureName = useCallback(async (): Promise<string | null> => {
    const id = await themeStore.getActive();
    if (!id) return null;
    return (await themeStore.list()).find((p) => p.id === id)?.name ?? null;
  }, [themeStore]);
  // The texture pack chosen last time is used from the start.
  useEffect(() => {
    let live = true;
    void (async () => {
      await restorePack(themeStore);
      const name = await readTextureName();
      if (live) setTextureName(name);
    })();
    return () => {
      live = false;
    };
  }, [themeStore, readTextureName]);
  const referenceStore = useMemo<ReferenceStore>(
    () => (params.has('nosave') ? new MemoryReferenceStore() : new DexieReferenceStore()),
    [params],
  );
  const libraryStore = useMemo<LibraryStore>(
    () => (params.has('nosave') ? new MemoryLibraryStore() : new DexieLibraryStore()),
    [params],
  );
  const [designer, setDesigner] = useState(false);
  // The quests made here, for the "Used in" panel of the Designer.
  const questSource = useCallback(async () => {
    const out: { title: string; quest: Quest }[] = [];
    for (const r of await userStore.list()) {
      const quest = (await userStore.loadDraft(r.id))?.quest ?? (await userStore.load(r.id));
      if (quest) out.push({ title: r.title, quest });
    }
    return out;
  }, [userStore]);
  const [playtest, setPlaytest] = useState<{ game: GameStore; editor: EditorStore } | null>(null);
  const [editor, setEditor] = useState<'start' | EditorStore | null>(() =>
    params.has('editor') ? 'start' : null,
  );
  // The Designer's "Update in all quests": every saved quest and draft, and the open quest through
  // its editor (so its own autosave does not overwrite the change).
  const updateQuests = useCallback<QuestUpdater>(
    async (fn) => {
      const open = typeof editor === 'object' && editor !== null ? editor : null;
      const openId = open?.getState().quest.id;
      const changed = new Set<string>();
      for (const r of await userStore.list()) {
        if (r.id === openId) continue;
        const saved = await userStore.load(r.id);
        const next = saved ? fn(saved) : undefined;
        if (next) {
          await userStore.save(next, Date.now());
          changed.add(r.id);
        }
        const draft = await userStore.loadDraft(r.id);
        const nextDraft = draft ? fn(draft.quest) : undefined;
        if (nextDraft) {
          await userStore.saveDraft(nextDraft, Date.now());
          changed.add(r.id);
        }
      }
      if (open && openId) {
        const ok = open.getState().apply((q) => {
          const next = fn(q);
          return next ? { ok: true, quest: next, warnings: [] } : { ok: false, error: 'unchanged' };
        });
        if (ok) changed.add(openId);
      }
      return changed.size;
    },
    [editor, userStore],
  );

  // Development only: the engine test fixture is loaded on demand, never bundled in production.
  useEffect(() => {
    if (game !== 'dev') return;
    let live = true;
    void devTestLevel(params.get('quest') ?? 'test').then((level) => {
      if (!live) return;
      const next = level ? startFromUrl(params, saves, level) : null;
      setGame(next === 'dev' ? null : next);
    });
    return () => {
      live = false;
    };
  }, [game, params, saves]);

  useEffect(() => {
    if (game !== 'resume') return;
    const level = levelFromParams(params);
    if (!level) return;
    let live = true;
    void openSaved(saves, level).then((r) => {
      if (!live) return;
      if (r.ok) setGame(r.store);
      else {
        setNotice(r.message);
        setGame(null);
      }
    });
    return () => {
      live = false;
    };
  }, [game, params, saves]);

  // Campaigns are kept per pack on this device (decision 37).
  const campaigns = useMemo<CampaignStore>(
    () => (params.has('nosave') ? new MemoryCampaignStore() : new LocalCampaignStore()),
    [params],
  );
  /** Stops the listener that writes a finished quest into the campaign. */
  const stopTracking = useRef<(() => void) | null>(null);
  const leave = () => {
    stopTracking.current?.();
    stopTracking.current = null;
    setGame(null);
  };
  const track = (store: GameStore, campaign: Campaign, questId: string) => {
    stopTracking.current?.();
    stopTracking.current = trackCampaign(store, campaigns, campaign, questId);
  };

  const start = (choice: StartChoice) => {
    stopTracking.current?.();
    stopTracking.current = null;
    if (choice.kind === 'resume') {
      const { seed, team, events, startFlags, campaign: wasCampaign } = choice.resumed;
      try {
        const store = openGame(saves, choice.level, seed, team, events, false, {
          pack: choice.pack,
          startFlags,
          campaign: wasCampaign,
        });
        const c = choice.pack ? campaigns.get(choice.pack) : undefined;
        if (wasCampaign && c) track(store, c, choice.questId);
        setGame(store);
      } catch {
        setNotice(SAVED_GAME_FAILED);
      }
    } else {
      const manifest = choice.pack ? packs.byId.get(choice.pack)?.manifest : undefined;
      let campaign: Campaign | undefined;
      if (choice.mode === 'campaign' && manifest) {
        // A new campaign gets its seed now; the team of this quest is what the next one starts from.
        const c = campaigns.get(manifest.id) ?? newCampaign(manifest, freshSeed());
        campaign = { ...c, team: choice.team.map(toStored), fallen: [] };
        campaigns.set(campaign);
      }
      const store = openGame(saves, choice.level, freshSeed(), choice.team, [], true, {
        pack: choice.pack,
        startFlags: startFlagsFor(choice.level.quest, campaign),
        campaign: campaign !== undefined,
      });
      void store.getState().save(); // a new game replaces the old save at once
      if (campaign) track(store, campaign, choice.questId);
      setGame(store);
    }
  };

  // Play the draft in the real play screen: a temporary game that writes no save.
  const playtestQuest = (quest: Quest) => {
    if (typeof editor !== 'object' || editor === null) return;
    try {
      const level = buildLevel(quest);
      const store = openGame(new MemorySaveStore(), level, freshSeed(), HEROES, [], true, {
        startFlags: startFlagsFor(level.quest, undefined),
      });
      setPlaytest({ game: store, editor });
    } catch (e) {
      editor.getState().say(`Cannot playtest yet: ${(e as Error).message}`);
    }
  };

  if (playtest)
    return (
      <PlayScreen
        store={playtest.game}
        onLeave={() => setPlaytest(null)}
        playtest={{ onBack: () => setPlaytest(null) }}
      />
    );
  if (designer)
    return (
      <DesignerScreen
        store={libraryStore}
        quests={questSource}
        updateQuests={updateQuests}
        onBack={() => setDesigner(false)}
      />
    );
  if (editor === 'start')
    return (
      <EditorStart
        store={userStore}
        onDesigner={() => setDesigner(true)}
        onBack={() => setEditor(null)}
        onOpen={(quest, clean) => setEditor(createEditorStore({ quest, clean, store: userStore }))}
      />
    );
  if (editor)
    return (
      <LibraryProvider store={libraryStore}>
        <EditorScreen
          store={editor}
          onBack={() => setEditor('start')}
          reference={referenceStore}
          onPlaytest={playtestQuest}
          library={libraryStore}
          quests={questSource}
          updateQuests={updateQuests}
        />
      </LibraryProvider>
    );
  if (game === 'resume' || game === 'dev') return <div className="app" />;
  if (game)
    return (
      <PlayScreen
        store={game}
        campaigns={campaigns}
        onLeave={leave}
        initialSelect={params.get('select')}
      />
    );
  return (
    <>
      <SelectScreen
        saves={saves}
        campaigns={campaigns}
        onStart={start}
        notice={notice}
        onEditor={() => setEditor('start')}
        onTextures={() => setTextures(true)}
        textureName={textureName}
        userStore={userStore}
      />
      {textures && (
        <TexturesDialog
          store={themeStore}
          onClose={() => {
            setTextures(false);
            void readTextureName().then(setTextureName);
          }}
        />
      )}
    </>
  );
}
