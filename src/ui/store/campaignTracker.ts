import type { CampaignStore } from '../../persist/campaigns';
import { finishQuest, questFinished, type Campaign } from '../../engine/pack/campaign';
import type { GameStore } from './gameStore';

/**
 * Keeps a campaign up to date while a game is played (decision 37): when the quest ends as finished,
 * the campaign lists it and keeps its carried flags; an Undo that takes the end back restores the
 * campaign as it was. Returns the function that stops listening.
 */
export function trackCampaign(
  game: GameStore,
  campaigns: CampaignStore,
  start: Campaign,
  questId?: string,
): () => void {
  let before: Campaign | undefined;
  const check = () => {
    const { root, state } = game.getState();
    const done = questFinished(root, state);
    if (done && !before) {
      before = campaigns.get(start.pack) ?? start;
      campaigns.set(
        finishQuest(before, { id: questId ?? root.quest.id, flagsOut: root.quest.flagsOut }, state),
      );
    } else if (!done && before) {
      campaigns.set(before);
      before = undefined;
    }
  };
  check();
  return game.subscribe(check);
}
