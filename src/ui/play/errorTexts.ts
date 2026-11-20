/**
 * Player-facing text for a refused event. The engine message is for developers and tests; the
 * players read this (decision 92: every text goes through `t`). A code without a text here shows
 * the engine message.
 */
import type { EventErrorCode } from '../../engine/game/errors';
import { t } from '../../i18n/t';

export function errorText(code: EventErrorCode, message: string): string {
  switch (code) {
    case 'LAYOUT_ROCK':
      return t('play.errors.layoutRock', 'That is solid rock. There is nothing to show.');
    case 'LAYOUT_KNOWN':
      return t('play.errors.layoutKnown', 'That part of the map is already drawn.');
    case 'ALREADY_SEARCHED':
      return t('play.errors.alreadySearched', 'That was already searched.');
    case 'MONSTERS_IN_ROOM':
      return t('play.errors.monstersInRoom', 'A monster is in the way. Slay it first.');
    case 'ROOM_NOT_REVEALED':
      return t('play.errors.roomNotRevealed', 'That room is not on the map yet.');
    case 'ALREADY_OPEN':
      return t('play.errors.alreadyOpen', 'That door is already open.');
    case 'ALREADY_DEAD':
      return t('play.errors.alreadyDead', 'That hero has already fallen.');
    case 'MONSTER_DEAD':
      return t('play.errors.monsterDead', 'That monster is already slain.');
    case 'QUEST_ENDED':
      return t('play.errors.questEnded', 'The quest has ended.');
    case 'NOT_A_LOOK_SQUARE':
      return t('play.errors.notALookSquare', 'Nothing new can be seen from that square.');
    case 'SPELL_USED':
      return t('play.errors.spellUsed', 'It has used that spell already.');
    case 'SPELL_LIMIT':
      return t('play.errors.spellLimit', 'It cannot cast that spell again.');
    case 'TRAP_GONE':
      return t('play.errors.trapGone', 'That trap is already sprung or disarmed.');
    case 'MONSTER_INACTIVE':
      return t('play.errors.monsterInactive', 'That monster is not acting now.');
    default:
      return message;
  }
}
