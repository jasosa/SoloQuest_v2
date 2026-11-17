import { MONSTER_NAMES } from '../../engine/data/monsters';
import { resolveMonster } from '../../engine/data/enemies';
import type { MonsterDef, Quest } from '../../engine/quest/schema';
import { MONSTER_LETTER } from '../play/monsterCodes';

/** The name the editor shows for a monster: its own, its enemy's, or its type's. */
export function shownName(quest: Pick<Quest, 'enemyDefs'>, m: MonsterDef): string {
  return resolveMonster(m, quest.enemyDefs).name ?? MONSTER_NAMES[m.type];
}

/** The picture on its token: its own or its enemy's, if any. */
export function shownImage(quest: Pick<Quest, 'enemyDefs'>, m: MonsterDef): string | undefined {
  return resolveMonster(m, quest.enemyDefs).image;
}

/** The letter on its token: its own, its enemy's, or its type's. */
export function shownLetter(quest: Pick<Quest, 'enemyDefs'>, m: MonsterDef): string {
  return resolveMonster(m, quest.enemyDefs).letter ?? MONSTER_LETTER[m.type];
}
