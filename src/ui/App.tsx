import { board } from '../engine/board/board';
import { BoardView } from './board/BoardView';
import { knownFor, parseState } from './board/boardStates';
import './shared/tokens.css';
import './app.css';

export function App() {
  const params = new URLSearchParams(location.search);
  const state = parseState(params.get('state'));
  return (
    <div className="app">
      <header>
        <span className="qn">Board</span>
        <h1>SoloQuest</h1>
      </header>
      <main className="map">
        <BoardView board={board} known={knownFor(board, state)} labels={params.has('labels')} />
      </main>
    </div>
  );
}
