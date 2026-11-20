import type { Quest } from '../../engine/quest/schema';
import { CLASSIC_THEME, type Theme } from './theme';

/**
 * The quest pack ("box") of the quest that is open, so a texture pack made for one box (`box` in its
 * theme.json) dresses only the quests of that box (decisions 85 and 98). A pack is never applied by
 * itself: the player chooses it in the Textures dialog.
 */

export const FROZEN_HORROR = 'frozen-horror';

/**
 * The box a quest dresses. `pack` says so; a quest made in the editor that has no pack but uses Frozen
 * Horror tiles, tunnels or doors is a Frozen Horror quest too.
 */
export function boxOfQuest(
  quest: Pick<Quest, 'pack' | 'roomTiles' | 'boardTiles' | 'tunnels' | 'edgeDoors'>,
): string | undefined {
  if (quest.pack) return quest.pack;
  const uses =
    quest.roomTiles.length +
      quest.boardTiles.length +
      quest.tunnels.length +
      quest.edgeDoors.length >
    0;
  return uses ? FROZEN_HORROR : undefined;
}

const listeners = new Set<() => void>();
let version = 0;
let questBox: string | undefined;

/** The screen that shows a quest says which box it is (undefined: none open, or a core quest). */
export function setQuestBox(box: string | undefined): void {
  if (box === questBox) return;
  questBox = box;
  version += 1;
  listeners.forEach((l) => l());
}

export const getQuestBox = (): string | undefined => questBox;
export const getQuestBoxVersion = (): number => version;
export function subscribeQuestBox(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/**
 * The theme a board draws with. A pack made for a box dresses only the quests of that box: in any other
 * quest the built-in look is drawn. A pack with no `box` dresses every quest.
 */
export function themeForBox(app: Theme, box: string | undefined = questBox): Theme {
  return app.box !== undefined && app.box !== box ? CLASSIC_THEME : app;
}
