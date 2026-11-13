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
    }),
  );
}
