import { describe, expect, it } from 'vitest';
import type { Prompt } from '../../engine/game/prompts';
import { resultStages } from './notes';

describe('resultStages', () => {
  it('tells a trap first, then the rest of the search', () => {
    const prompts: Prompt[] = [
      { kind: 'drawCard' },
      { kind: 'trapSprung', trap: 't', trapKind: 'pit', effect: 'x' } as unknown as Prompt,
    ];
    const stages = resultStages(prompts);
    expect(stages.map((s) => s.map((p) => p.kind))).toEqual([['trapSprung'], ['drawCard']]);
  });
  it('one stage when there is no trap', () => {
    expect(resultStages([{ kind: 'drawCard' }])).toHaveLength(1);
    expect(resultStages([])).toHaveLength(0);
  });
});
