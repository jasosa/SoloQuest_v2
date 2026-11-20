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
    const id = questId ?? root.quest.id;
    if (done && !before) {
      const stored = campaigns.get(start.id) ?? start;
      if (stored.finished.includes(id)) {
        // A resumed game that had already ended: the campaign lists the quest already. What an Undo of
        // the end must give back is the campaign without this quest and without the flags it handed on.
        const flags = { ...stored.flags };
        for (const f of root.quest.flagsOut ?? []) delete flags[f];
        before = { ...stored, finished: stored.finished.filter((q) => q !== id), flags };
      } else {
        before = stored;
        campaigns.set(finishQuest(stored, { id, flagsOut: root.quest.flagsOut }, state));
      }
    } else if (!done && before) {
      // Only what the end changed goes back: a setting toggled since stays as it is.
      const now = campaigns.get(start.id) ?? before;
      campaigns.set({
        ...now,
        finished: before.finished,
        flags: before.flags,
        fallen: before.fallen,
      });
      before = undefined;
    }
  };
  check();
  return game.subscribe(check);
}
