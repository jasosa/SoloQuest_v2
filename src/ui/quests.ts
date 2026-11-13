/**
 * The quests that are bundled with the app: every `src/content/quests/*.json`, parsed with the
 * Zod schema. The Quest Book has 14 quests; the ones that are not encoded yet are listed as such.
 */
import { buildLevel, type Level } from '../engine/board/level';
import { parseQuest } from '../engine/quest/loader';

export const QUEST_COUNT = 14;

export interface QuestEntry {
  readonly number: number;
  /** Undefined while the quest is not encoded. */
  readonly level: Level | undefined;
}

const files = import.meta.glob('../content/quests/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>;

export function loadQuestEntries(data: Record<string, unknown> = files): QuestEntry[] {
  const byNumber = new Map<number, Level>();
  for (const raw of Object.values(data)) {
    const quest = parseQuest(raw);
    byNumber.set(quest.number, buildLevel(quest));
  }
  return Array.from({ length: QUEST_COUNT }, (_, i) => ({
    number: i + 1,
    level: byNumber.get(i + 1),
  }));
}

export const questEntries: readonly QuestEntry[] = loadQuestEntries();

export function levelOfNumber(n: number): Level | undefined {
  return questEntries.find((q) => q.number === n)?.level;
}

/**
 * Development only: `?quest=test` plays the made-up engine fixture (pit, chest trap, spear, secret
 * door) plus one falling block, so the trap flows can be tried and tested. It is never listed in
 * the quest select, and `import.meta.env.DEV` is false in a production build.
 */
export async function devTestLevel(): Promise<Level | undefined> {
  if (!import.meta.env.DEV) return undefined;
  const { testQuest } = await import('../engine/quest/testQuest');
  const base = testQuest();
  return buildLevel(
    testQuest({
      traps: [...base.traps, { id: 't4', kind: 'fallingBlock', cell: [6, 18] }],
      // A statue in the start room that wakes when door d3 opens (dormant monster, decision 28).
      monsters: [
        ...base.monsters,
        { id: 'm-statue', type: 'gargoyle', name: 'The statue', cell: [4, 16], state: 'dormant' },
      ],
      npcs: [
        {
          id: 'n1',
          name: 'Sir Test',
          cell: [2, 16],
          defend: 2,
          body: 3,
          text: 'Moves with the heroes. Zargon never attacks it.',
        },
      ],
      notes: [
        {
          id: 'n-wake',
          trigger: { type: 'doorOpened', door: 'd3' },
          effects: [{ type: 'setMonsterState', monster: 'm-statue', state: 'active' }],
        },
        {
          id: 'n-choice',
          trigger: { type: 'doorOpened', door: 'd3' },
          effects: [
            {
              type: 'promptChoice',
              text: 'A lever hangs by the door. Pull it?',
              options: [
                {
                  label: 'Pull the lever',
                  effects: [{ type: 'showText', text: 'A far gate grinds open.' }],
                },
                { label: 'Leave it', effects: [{ type: 'showText', text: 'Nothing happens.' }] },
              ],
            },
          ],
        },
        {
          id: 'n-sq',
          letter: 'S',
          at: [4, 18],
          trigger: { type: 'squareEntered', cell: [4, 18] },
          effects: [
            {
              type: 'showText',
              title: 'A cold draft',
              text: 'A cold draft comes from a crack in the wall.',
            },
          ],
        },
        {
          id: 'n-area',
          trigger: { type: 'areaEntered', area: 'R17' },
          effects: [{ type: 'showText', title: 'The study', text: 'Dust covers every shelf.' }],
        },
        {
          id: 'n-manual',
          trigger: { type: 'manual', label: 'Call for help' },
          effects: [
            { type: 'showText', text: 'A knight steps out of the shadows.' },
            { type: 'spawnNpc', npc: 'n1' },
          ],
        },
        {
          id: 'n-place',
          trigger: { type: 'manual', label: 'Wake the guardian' },
          effects: [{ type: 'placeMonster', monster: 'm3', cell: [3, 17] }],
        },
      ],
    }),
  );
}
