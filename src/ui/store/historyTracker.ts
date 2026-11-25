import { questFinished } from '../../engine/pack/campaign';
import { addResult, setRecord, type QuestRecord } from '../../persist/history';
import type { GameStore } from './gameStore';

/**
 * Writes the result of a game into the quest history when it ends, and takes it back when an Undo
 * reopens the quest. A game that was already ended when it was opened is not counted again.
 * Returns the function that stops listening.
 */
export function trackHistory(game: GameStore, questId: string): () => void {
  let counted = game.getState().state.ended !== undefined;
  let mine = false;
  let replaced: QuestRecord | undefined;
  const check = () => {
    const { root, state } = game.getState();
    if (state.ended && !counted) {
      counted = mine = true;
      replaced = addResult(questId, questFinished(root, state) ? 'won' : 'lost', Date.now());
    } else if (!state.ended && counted) {
      counted = false;
      if (mine) setRecord(questId, replaced);
      mine = false;
    }
  };
  return game.subscribe(check);
}
