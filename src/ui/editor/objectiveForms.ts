/** Pure helpers of the objective form: which done rule an objective has, and a default for each. */
import { tr } from '../../i18n/translate';
import type { ObjectiveDef, Quest } from '../../engine/quest/schema';
import type { Made } from './noteForms';

export const OBJECTIVE_RULES = [
  {
    key: 'none',
    get label() {
      return tr(
        'editor.objectiveForms.noRuleAnActionOrThe',
        'No rule: an action or the confirm button completes it',
      );
    },
  },
  {
    key: 'monsterKilled',
    get label() {
      return tr('editor.objectiveForms.aMonsterIsSlain', 'A monster is slain');
    },
  },
  {
    key: 'allKilled',
    get label() {
      return tr(
        'editor.objectiveForms.allOfSomeMonstersAreSlain',
        'All of some monsters are slain',
      );
    },
  },
  {
    key: 'allSeenKilled',
    get label() {
      return tr(
        'editor.objectiveForms.everyMonsterTheHeroesHaveSeen',
        'Every monster the heroes have seen is slain',
      );
    },
  },
  {
    key: 'flag',
    get label() {
      return tr('editor.objectiveForms.aFlagIsSet', 'A flag is set');
    },
  },
  {
    key: 'when',
    get label() {
      return tr('editor.objectiveForms.theseConditionsHold', 'These conditions hold');
    },
  },
] as const;
export type ObjectiveRuleKey = (typeof OBJECTIVE_RULES)[number]['key'];

export function objectiveRuleKey(o: ObjectiveDef): ObjectiveRuleKey {
  const d = o.done;
  if (!d) return 'none';
  if ('monsterKilled' in d) return 'monsterKilled';
  if ('allKilled' in d) return 'allKilled';
  if ('allSeenKilled' in d) return 'allSeenKilled';
  if ('flag' in d) return 'flag';
  return 'when';
}

/** The done rule of this kind with sensible content, or the reason there is none yet. */
export function ruleOf(q: Quest, key: ObjectiveRuleKey): Made<ObjectiveDef['done'] | null> {
  const m = q.monsters[0];
  switch (key) {
    case 'none':
      return { ok: true, value: null };
    case 'monsterKilled':
      return m
        ? { ok: true, value: { monsterKilled: m.id } }
        : {
            ok: false,
            error: tr('editor.objectiveForms.addAMonsterFirst', 'Add a monster first.'),
          };
    case 'allKilled':
      return m
        ? { ok: true, value: { allKilled: [m.id] } }
        : {
            ok: false,
            error: tr('editor.objectiveForms.addAMonsterFirst', 'Add a monster first.'),
          };
    case 'allSeenKilled':
      return { ok: true, value: { allSeenKilled: true } };
    case 'flag':
      return { ok: true, value: { flag: 'flag' } };
    case 'when':
      return { ok: true, value: { when: [{ flag: 'flag', is: true }] } };
  }
}
