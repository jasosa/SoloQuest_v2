/**
 * The editor can author everything the shipped quests use: every trigger, effect, condition and
 * objective rule found in the quest files is a choice in the forms. Adding a piece to a quest
 * file without a form for it fails here.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseQuest } from '../../engine/quest/loader';
import type { Effect } from '../../engine/quest/schema';
import { CONDITION_TYPES, EFFECT_TYPES, TRIGGER_TYPES, conditionKey } from './noteForms';
import { OBJECTIVE_RULES, objectiveRuleKey } from './objectiveForms';

const dir = resolve(import.meta.dirname, '../../content/quests');
const files = readdirSync(dir).filter((f) => /^(q|fh)\d+.*\.json$/.test(f));

function* walk(effects: readonly Effect[]): Generator<Effect> {
  for (const e of effects) {
    yield e;
    if (e.type === 'promptChoice') for (const o of e.options) yield* walk(o.effects);
  }
}

describe('quest files only use pieces the editor has a form for', () => {
  it('finds the quest files', () => {
    expect(files.length).toBeGreaterThanOrEqual(23);
  });
  for (const f of files) {
    it(f, () => {
      const q = parseQuest(JSON.parse(readFileSync(resolve(dir, f), 'utf8')));
      const triggers = new Set(TRIGGER_TYPES.map((t) => t.type as string));
      const effects = new Set(EFFECT_TYPES.map((t) => t.type as string));
      const conditions = new Set(CONDITION_TYPES.map((t) => t.key as string));
      const rules = new Set(OBJECTIVE_RULES.map((r) => r.key as string));
      for (const n of q.notes) {
        expect(triggers.has(n.trigger.type), `${n.id} trigger ${n.trigger.type}`).toBe(true);
        for (const c of n.when ?? []) expect(conditions.has(conditionKey(c))).toBe(true);
        for (const e of walk(n.effects))
          expect(effects.has(e.type), `${n.id} ${e.type}`).toBe(true);
      }
      for (const o of q.objectives) {
        expect(rules.has(objectiveRuleKey(o)), `${o.id} rule`).toBe(true);
        for (const c of [
          ...(o.confirmWhen ?? []),
          ...(o.done && 'when' in o.done ? o.done.when : []),
        ])
          expect(conditions.has(conditionKey(c))).toBe(true);
      }
    });
  }
});
