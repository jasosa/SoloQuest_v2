import { useEffect, useMemo, useState } from 'react';
import { board } from '../engine/board/board';
import { HEROES, type Hero } from '../engine/data/heroes';
import type { GameEvent } from '../engine/game/events';
import type { Level } from '../engine/board/level';
import { DexieSaveStore, MemorySaveStore, type SaveStore } from '../persist/saves';
import { BoardView } from './board/BoardView';
import { knownFor, parseState } from './board/boardStates';
import { PlayScreen } from './play/PlayScreen';
import { levelOfNumber } from './quests';
import { SelectScreen, type StartChoice } from './select/SelectScreen';
import { createGameStore, type GameStore } from './store/gameStore';
import { openSaved, SAVED_GAME_FAILED } from './store/openSaved';
import './shared/tokens.css';
import './shared/controls.css';
import './app.css';
import './play/play.css';
import './select/select.css';

/** A new random seed. Math.random is fine here: it is outside the engine. */
const freshSeed = () => Math.floor(Math.random() * 2 ** 31);

function openGame(
  saves: SaveStore,
  level: Level,
  seed: number,
  team: readonly Hero[],
  events: readonly GameEvent[] = [],
): GameStore {
  return createGameStore({ level, seed, team, events, saves });
}

/**
 * Jump straight into a game from the URL, for e2e tests and screenshots:
 * `?quest=1&team=dwarf,elf` plus optional `seed=7`, `open=d1,d2` (doors opened at the start),
 * `look=12:18` (squares looked from), `select=door:d3`, `nosave=1` (no IndexedDB), `resume=1`.
 */
function startFromUrl(params: URLSearchParams, saves: SaveStore): GameStore | 'resume' | null {
  const n = Number(params.get('quest'));
  const level = n ? levelOfNumber(n) : undefined;
  if (!level) return null;
  if (params.has('resume')) return 'resume';
  const team = (params.get('team') ?? 'dwarf')
    .split(',')
    .filter((h): h is Hero => (HEROES as readonly string[]).includes(h));
  const events: GameEvent[] = [];
  for (const door of (params.get('open') ?? '').split(',').filter(Boolean))
    events.push({ type: 'OPEN_DOOR', door });
  for (const at of (params.get('look') ?? '').split(',').filter(Boolean)) {
    const [x, y] = at.split(':').map(Number);
    if (x !== undefined && y !== undefined) events.push({ type: 'LOOK_FROM', cell: [x, y] });
  }
  const seed = params.has('seed') ? Number(params.get('seed')) : freshSeed();
  const store = openGame(saves, level, seed, team.length ? team : ['dwarf'], events);
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
  const [game, setGame] = useState<GameStore | null | 'resume'>(() => startFromUrl(params, saves));

  const [notice, setNotice] = useState<string | undefined>();

  useEffect(() => {
    if (game !== 'resume') return;
    const level = levelOfNumber(Number(params.get('quest')));
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
      const store = openGame(saves, choice.level, freshSeed(), choice.team);
      void store.getState().save(); // a new game replaces the old save at once
      setGame(store);
    }
  };

  if (game === 'resume') return <div className="app" />;
  if (game)
    return (
      <PlayScreen store={game} onLeave={() => setGame(null)} initialSelect={params.get('select')} />
    );
  return <SelectScreen saves={saves} onStart={start} notice={notice} />;
}
