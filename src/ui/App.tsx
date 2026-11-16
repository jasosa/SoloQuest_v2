import { useEffect, useMemo, useState } from 'react';
import { board } from '../engine/board/board';
import { buildLevel } from '../engine/board/level';
import type { Quest } from '../engine/quest/schema';
import { HEROES, type Hero } from '../engine/data/heroes';
import type { GameEvent } from '../engine/game/events';
import type { Level } from '../engine/board/level';
import {
  DexieReferenceStore,
  MemoryReferenceStore,
  type ReferenceStore,
} from '../persist/reference';
import { DexieSaveStore, MemorySaveStore, type SaveStore } from '../persist/saves';
import { BoardView } from './board/BoardView';
import { knownFor, parseState } from './board/boardStates';
import { PlayScreen } from './play/PlayScreen';
import { devTestLevel, levelOfNumber } from './quests';
import { SelectScreen, type StartChoice } from './select/SelectScreen';
import { EditorScreen } from './editor/EditorScreen';
import { EditorStart } from './editor/EditorStart';
import { DesignerScreen } from './designer/DesignerScreen';
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
  team: readonly Hero[],
  events: readonly GameEvent[] = [],
  fresh = false,
): GameStore {
  return createGameStore({ level, seed, team, events, saves, fresh });
}

/** `?quest=1` (a bundled quest). `?quest=test` (development only) loads asynchronously. */
function levelFromParams(params: URLSearchParams): Level | undefined {
  const n = Number(params.get('quest'));
  return n ? levelOfNumber(n) : undefined;
}

/**
 * Jump straight into a game from the URL, for e2e tests and screenshots:
 * `?quest=1&team=dwarf,elf` plus optional `seed=7`, `open=d1,look@13:18,d5` (doors and looks done at the start, in order),
 * `look=12:18` (squares looked from), `select=door:d3`, `nosave=1` (no IndexedDB), `resume=1`.
 * In development `?quest=test` plays the engine test fixture.
 */
function startFromUrl(
  params: URLSearchParams,
  saves: SaveStore,
  level: Level | undefined = levelFromParams(params),
): GameStore | 'resume' | 'dev' | null {
  if (!level) return params.get('quest') === 'test' && import.meta.env.DEV ? 'dev' : null;
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
  const store = openGame(saves, level, seed, team.length ? team : ['dwarf'], events, true);
  void store.getState().save();
  return store;
}

export function App() {
  const params = useMemo(() => new URLSearchParams(location.search), []);

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
  const referenceStore = useMemo<ReferenceStore>(
    () => (params.has('nosave') ? new MemoryReferenceStore() : new DexieReferenceStore()),
    [params],
  );
  const libraryStore = useMemo<LibraryStore>(
    () => (params.has('nosave') ? new MemoryLibraryStore() : new DexieLibraryStore()),
    [params],
  );
  const [designer, setDesigner] = useState(false);
  const [playtest, setPlaytest] = useState<{ game: GameStore; editor: EditorStore } | null>(null);
  const [editor, setEditor] = useState<'start' | EditorStore | null>(() =>
    params.has('editor') ? 'start' : null,
  );

  // Development only: the engine test fixture is loaded on demand, never bundled in production.
  useEffect(() => {
    if (game !== 'dev') return;
    let live = true;
    void devTestLevel().then((level) => {
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

  const start = (choice: StartChoice) => {
    if (choice.kind === 'resume') {
      const { seed, team, events } = choice.resumed;
      try {
        setGame(openGame(saves, choice.level, seed, team, events));
      } catch {
        setNotice(SAVED_GAME_FAILED);
      }
    } else {
      const store = openGame(saves, choice.level, freshSeed(), choice.team, [], true);
      void store.getState().save(); // a new game replaces the old save at once
      setGame(store);
    }
  };

  // Play the draft in the real play screen: a temporary game that writes no save.
  const playtestQuest = (quest: Quest) => {
    if (typeof editor !== 'object' || editor === null) return;
    try {
      const store = openGame(
        new MemorySaveStore(),
        buildLevel(quest),
        freshSeed(),
        HEROES,
        [],
        true,
      );
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
  if (designer) return <DesignerScreen store={libraryStore} onBack={() => setDesigner(false)} />;
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
        />
      </LibraryProvider>
    );
  if (game === 'resume' || game === 'dev') return <div className="app" />;
  if (game)
    return (
      <PlayScreen store={game} onLeave={() => setGame(null)} initialSelect={params.get('select')} />
    );
  return (
    <SelectScreen
      saves={saves}
      onStart={start}
      notice={notice}
      onEditor={() => setEditor('start')}
    />
  );
}
