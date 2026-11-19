/**
 * The quests that are bundled with the app: every `src/content/quests/*.json`, parsed with the
 * Zod schema. The Quest Book has 14 quests; the ones that are not encoded yet are listed as such.
 */
import { buildLevel, type Level } from '../engine/board/level';
import { parseQuest } from '../engine/quest/loader';

export const QUEST_COUNT = 14;

export interface QuestEntry {
  /** The number printed on the quest (the quests of two packs can share one: Core 1 and Frozen Horror 1). */
  readonly number: number;
  /**
   * The unique key of the entry in the lists, the URL (`?quest=`) and the edited copies. A core quest
   * has its own number. A quest of a pack takes its number when that is free, else the pack's
   * number of hundreds plus its number (Frozen Horror 3 is 103, because Core 3 exists).
   */
  readonly slot: number;
  /** Undefined while the quest is not encoded. */
  readonly level: Level | undefined;
}

const files = import.meta.glob('../content/quests/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>;

export function loadQuestEntries(data: Record<string, unknown> = files): QuestEntry[] {
  const coreByNumber = new Map<number, Level>();
  const others: { pack: string; level: Level }[] = [];
  for (const raw of Object.values(data)) {
    const quest = parseQuest(raw);
    if (quest.pack === undefined) coreByNumber.set(quest.number, buildLevel(quest));
    else others.push({ pack: quest.pack, level: buildLevel(quest) });
  }
  const core: QuestEntry[] = Array.from({ length: QUEST_COUNT }, (_, i) => ({
    number: i + 1,
    slot: i + 1,
    level: coreByNumber.get(i + 1),
  }));
  const used = new Set(core.map((e) => e.slot));
  const packIds = [...new Set(others.map((o) => o.pack))].sort();
  const rest = others
    .sort((a, b) => a.pack.localeCompare(b.pack) || a.level.quest.number - b.level.quest.number)
    .map(({ pack, level }): QuestEntry => {
      const number = level.quest.number;
      let slot = used.has(number) ? (packIds.indexOf(pack) + 1) * 100 + number : number;
      while (used.has(slot)) slot += 1000;
      used.add(slot);
      return { number, slot, level };
    });
  return [...core, ...rest];
}

export const questEntries: readonly QuestEntry[] = loadQuestEntries();

/** A bundled quest by its slot (`?quest=3`, `?quest=103`). */
export function levelOfSlot(slot: number): Level | undefined {
  return questEntries.find((q) => q.slot === slot)?.level;
}

/** A bundled quest by its id (`?quest=fh03-the-rescue`). */
export function levelOfId(id: string): Level | undefined {
  return questEntries.find((q) => q.level?.quest.id === id)?.level;
}

/**
 * Development only: `?quest=test` plays the made-up engine fixture (pit, chest trap, spear, secret
 * door) plus one falling block, so the trap flows can be tried and tested. It is never listed in
 * the quest select, and `import.meta.env.DEV` is false in a production build.
 */
export async function devTestLevel(which: string = 'test'): Promise<Level | undefined> {
  if (!import.meta.env.DEV) return undefined;
  // `?quest=test-maps`: a quest with two maps joined by a stairway (see testMaps.ts).
  if (which === 'test-maps') {
    const { testMapsQuest } = await import('../engine/quest/testMaps');
    return buildLevel(testMapsQuest());
  }
  const { testQuest } = await import('../engine/quest/testQuest');
  // `?quest=frozen`: the heroes start outside an iron door in the bottom wall and leave through a
  // wooden exit; the bottom corridor holds the Frozen Horror hazards.
  if (which === 'frozen')
    return buildLevel(
      testQuest({
        blocks: [],
        start: { door: 'in' },
        edgeDoors: [
          { id: 'in', cell: [3, 18], side: 's', kind: 'ironEntry' },
          { id: 'out', cell: [20, 18], side: 's', kind: 'woodenExit' },
        ],
        traps: [
          { id: 'st', kind: 'stalactite', cell: [4, 18] },
          { id: 'ax', kind: 'swingingAxe', cell: [5, 18] },
          { id: 'wt', kind: 'wanderingTrap', cell: [6, 18] },
          { id: 'si', kind: 'slipperyIce', cell: [7, 18] },
          {
            id: 'sl',
            kind: 'iceSlide',
            cell: [10, 18],
            path: [
              [10, 18],
              [11, 18],
              [12, 18],
            ],
          },
        ],
        // R17 is an Ice Vault (its rule shows in the room note)
        roomTiles: [{ type: 'iceVault', area: 'R17' }],
        // an icy river on the corridor and an ice ledge in R17 (their rules show on tap and when first seen)
        boardTiles: [
          {
            type: 'icyRiver',
            cells: [
              [14, 18],
              [15, 18],
            ],
          },
          {
            type: 'iceLedge',
            cells: [
              [5, 16],
              [5, 17],
            ],
          },
        ],
        wandering: { monster: 'goblin', count: 2 },
      }),
    );
  const base = testQuest();
  return buildLevel(
    testQuest({
      traps: [...base.traps, { id: 't4', kind: 'fallingBlock', cell: [6, 18] }],
      // A statue in the start room that wakes when door d3 opens (dormant monster, decision 28).
      monsters: [
        // m3 is hidden until the quest places it: give it two Dread spells (a caster).
        ...base.monsters.map((m) =>
          m.id === 'm3'
            ? { ...m, spells: ['fear', 'sleep'] }
            : // m2 is a special monster with an ability (decision 69).
              m.id === 'm2'
              ? { ...m, special: true, abilities: ['fireImmune'], enemy: 'marsh' }
              : m,
        ),
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
      enemyDefs: [
        {
          id: 'marsh',
          name: 'Marsh Goblin',
          base: 'goblin',
          letter: 'M',
          // a 1 x 1 picture, enough to test that a monster with an image shows it
          image:
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        },
      ],
      zones: [
        {
          id: 'z1',
          cells: [
            [3, 16],
            [4, 16],
          ],
        },
      ],
      notes: [
        {
          id: 'n-zone',
          trigger: { type: 'zoneEntered', zone: 'z1' },
          effects: [{ type: 'showText', title: 'The cold spot', text: 'The air grows cold here.' }],
        },
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
          at: [5, 18],
          trigger: { type: 'squareEntered', cell: [4, 18] },
          effects: [
            {
              type: 'showText',
              title: 'A cold draft',
              text: 'A cold draft comes from a crack in the wall.',
            },
            { type: 'setFlag', flag: 'draft', value: true },
          ],
        },
        {
          id: 'n-eye-btn',
          target: { kind: 'square', id: '1,18' },
          when: [{ lookDone: [1, 18] }],
          trigger: { type: 'manual', label: 'Mark the spot', hint: 'A scratch on the floor.' },
          effects: [{ type: 'showText', text: 'You mark the spot.' }],
        },
        {
          id: 'n-sq-btn',
          target: { kind: 'square', id: '4,18' },
          when: [{ flag: 'draft', is: true }],
          trigger: { type: 'manual', label: 'Seal the crack' },
          effects: [{ type: 'showText', text: 'The crack is sealed.' }],
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
          id: 'n-lever',
          target: { kind: 'area', id: 'R17' },
          trigger: { type: 'manual', label: 'Knock on the wall' },
          effects: [{ type: 'showText', text: 'Something knocks back.' }],
        },
        {
          id: 'n-stone',
          trigger: { type: 'manual', label: 'Turn the guardian to stone' },
          effects: [{ type: 'setMonsterState', monster: 'm3', state: 'stone', turns: 2 }],
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
