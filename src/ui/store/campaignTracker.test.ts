import { describe, expect, it } from 'vitest';
import { buildLevel } from '../../engine/board/level';
import { newCampaign } from '../../engine/pack/campaign';
import { parsePackManifest } from '../../engine/pack/registry';
import { testQuest } from '../../engine/quest/testQuest';
import { LocalCampaignStore, MemoryCampaignStore } from '../../persist/campaigns';
import { MemorySaveStore, resume } from '../../persist/saves';
import { createGameStore } from './gameStore';
import { trackCampaign } from './campaignTracker';

const pack = parsePackManifest({
  schemaVersion: 1,
  id: 'ice',
  name: 'Ice',
  dependsOn: ['core'],
  quests: ['test-quest'],
});
const level = buildLevel(
  testQuest({
    flagsIn: [{ flag: 'scepterDestroyed', oneShot: true }],
    flagsOut: ['lever'],
    objectives: [{ id: 'o', text: 'Pull', done: { flag: 'lever' } }],
    notes: [
      {
        id: 'lv',
        trigger: { type: 'manual', label: 'Lever' },
        effects: [{ type: 'setFlag', flag: 'lever', value: true }],
      },
    ],
  }),
);

describe('the campaign while a quest is played', () => {
  const open = (campaigns = new MemoryCampaignStore()) => {
    const campaign = newCampaign(pack, 3);
    campaigns.set(campaign);
    const game = createGameStore({
      level,
      seed: 5,
      team: ['dwarf', 'elf'],
      saves: new MemorySaveStore(),
      startFlags: { scepterDestroyed: false },
      now: () => 1,
    });
    return { campaigns, campaign, game, stop: trackCampaign(game, campaigns, campaign) };
  };

  it('lists the quest and its carried flag when it ends with the goal done, and Undo takes it back', () => {
    const { campaigns, game } = open();
    const d = game.getState().dispatch;
    d({ type: 'MANUAL_TRIGGER', note: 'lv' });
    expect(campaigns.get('ice')?.finished).toEqual([]);
    d({ type: 'END_QUEST', outcome: 'stairs' });
    expect(campaigns.get('ice')?.finished).toEqual([level.quest.id]);
    expect(campaigns.get('ice')?.flags).toEqual({ lever: true });
    game.getState().undo();
    expect(campaigns.get('ice')?.finished).toEqual([]);
    expect(campaigns.get('ice')?.flags).toEqual({});
  });

  it('a quest left with the goal undone is not finished', () => {
    const { campaigns, game } = open();
    game.getState().dispatch({ type: 'END_QUEST', outcome: 'stairs' });
    expect(campaigns.get('ice')?.finished).toEqual([]);
  });

  it('stops listening when told to', () => {
    const { campaigns, game, stop } = open();
    stop();
    game.getState().dispatch({ type: 'MANUAL_TRIGGER', note: 'lv' });
    game.getState().dispatch({ type: 'END_QUEST', outcome: 'stairs' });
    expect(campaigns.get('ice')?.finished).toEqual([]);
  });

  it('the start flags are saved with the game and come back on resume', async () => {
    const saves = new MemorySaveStore();
    const game = createGameStore({
      level,
      seed: 5,
      team: ['dwarf'],
      saves,
      startFlags: { scepterDestroyed: true },
      now: () => 1,
    });
    game.getState().dispatch({ type: 'ZARGON_TURN_END' });
    await game.getState().flush();
    const r = await resume(saves, level);
    expect(r.ok && r.startFlags).toEqual({ scepterDestroyed: true });
    expect(r.ok && r.state.flags.scepterDestroyed).toBe(true);
  });
});

describe('campaign stores', () => {
  it('memory: keeps one campaign per pack, and clear removes it', () => {
    const s = new MemoryCampaignStore();
    const c = newCampaign(pack, 9);
    s.set(c);
    expect(s.get('ice')).toEqual(c);
    expect(s.get('core')).toBeUndefined();
    s.clear('ice');
    expect(s.get('ice')).toBeUndefined();
  });

  it('local storage: round trips with a team that has a mercenary, and ignores a damaged value', () => {
    const mem = new Map<string, string>();
    const fake = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
    };
    (globalThis as { localStorage?: unknown }).localStorage = fake;
    try {
      const s = new LocalCampaignStore();
      const c = {
        ...newCampaign(pack, 9),
        team: [
          'dwarf' as const,
          { id: 'merc:scout', name: 'Scout', kind: 'mercenary' as const, owner: 'dwarf' },
        ],
      };
      s.set(c);
      expect(s.get('ice')).toEqual(c);
      mem.set('soloquest-campaigns', '{"ice": {"version": 7}}');
      expect(s.get('ice')).toBeUndefined();
      mem.set('soloquest-campaigns', 'not json');
      expect(s.get('ice')).toBeUndefined();
    } finally {
      delete (globalThis as { localStorage?: unknown }).localStorage;
    }
  });
});
