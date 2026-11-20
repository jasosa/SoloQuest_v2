import { describe, expect, it } from 'vitest';
import { buildLevel } from '../../engine/board/level';
import { newCampaign } from '../../engine/pack/campaign';
import { parsePackManifest } from '../../engine/pack/registry';
import { testQuest } from '../../engine/quest/testQuest';
import { LocalCampaignStore, MemoryCampaignStore } from '../../persist/campaigns';
import { MemorySaveStore, campaignOfSave, resume } from '../../persist/saves';
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

  it('Undo of the end after a resume (a new tracker on a game that had ended) still takes the quest back', () => {
    const { campaigns, game } = open();
    const d = game.getState().dispatch;
    d({ type: 'MANUAL_TRIGGER', note: 'lv' });
    d({ type: 'END_QUEST', outcome: 'stairs' });
    expect(campaigns.get('ice')?.finished).toEqual([level.quest.id]);
    // the player leaves and reopens the saved game: a new tracker starts on the ended game
    const again = trackCampaign(game, campaigns, newCampaign(pack, 3));
    game.getState().undo();
    expect(campaigns.get('ice')?.finished).toEqual([]);
    expect(campaigns.get('ice')?.flags).toEqual({});
    again();
  });

  it('Undo gives back only the finished list and flags: a setting toggled since stays', () => {
    const { campaigns, game } = open();
    const d = game.getState().dispatch;
    d({ type: 'MANUAL_TRIGGER', note: 'lv' });
    d({ type: 'END_QUEST', outcome: 'stairs' });
    campaigns.set({ ...campaigns.get('ice')!, settings: { raiment: true } });
    game.getState().undo();
    expect(campaigns.get('ice')?.settings).toEqual({ raiment: true });
    expect(campaigns.get('ice')?.finished).toEqual([]);
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

  it('the campaign id is saved with the game; an older campaign save resumes with the pack id', async () => {
    const saves = new MemorySaveStore();
    const game = createGameStore({
      level,
      seed: 5,
      team: ['dwarf'],
      saves,
      pack: 'ice',
      campaign: true,
      campaignId: 'ice-2',
      now: () => 1,
    });
    game.getState().dispatch({ type: 'ZARGON_TURN_END' });
    await game.getState().flush();
    const r = await resume(saves, level);
    expect(r.ok && r.campaignId).toBe('ice-2');
    expect(game.getState().campaignId).toBe('ice-2');
    // a save made before several campaigns per pack: `campaign` and the pack, no id
    const raw = await saves.load(level.quest.id);
    const { campaignId: _gone, ...older } = raw!;
    void _gone;
    await saves.save(older);
    const again = await resume(saves, level);
    expect(again.ok && again.campaignId).toBe('ice');
  });
});

describe('campaignOfSave', () => {
  it('is the campaign id, the pack id for an older campaign save, and nothing for a one-shot', () => {
    expect(campaignOfSave({ campaign: true, campaignId: 'ice-2', pack: 'ice' })).toBe('ice-2');
    expect(campaignOfSave({ campaign: true, pack: 'ice' })).toBe('ice');
    expect(campaignOfSave({ pack: 'ice' })).toBeUndefined();
    expect(campaignOfSave({})).toBeUndefined();
  });
});

describe('campaign stores', () => {
  it('memory: keeps campaigns by id, several per pack, and clear removes one', () => {
    const s = new MemoryCampaignStore();
    const c = newCampaign(pack, 9);
    s.set(c);
    expect(s.get('ice')).toEqual(c);
    expect(s.get('core')).toBeUndefined();
    const second = newCampaign(pack, 10, { id: 'ice-2', name: 'Campaign 2' });
    s.set(second);
    expect(s.list().map((x) => x.id)).toEqual(['ice', 'ice-2']);
    s.clear('ice');
    expect(s.get('ice')).toBeUndefined();
    expect(s.get('ice-2')).toEqual(second);
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
      // a campaign saved before ids and names (keyed by its pack) gets the pack as its id
      const { id: _id, name: _name, ...old } = c;
      void _id;
      void _name;
      mem.set('soloquest-campaigns', JSON.stringify({ ice: old }));
      expect(s.get('ice')).toEqual({ ...c, id: 'ice', name: '' });
      expect(s.list()).toEqual([{ ...c, id: 'ice', name: '' }]);
      // several campaigns of one pack, in the order they were made
      mem.delete('soloquest-campaigns');
      s.set(c);
      const c2 = { ...c, id: 'ice-2', name: 'Campaign 2' };
      s.set(c2);
      expect(s.list()).toEqual([c, c2]);
      s.clear('ice');
      expect(s.list()).toEqual([c2]);
      mem.set('soloquest-campaigns', '{"ice": {"version": 7}}');
      expect(s.get('ice')).toBeUndefined();
      expect(s.list()).toEqual([]);
      mem.set('soloquest-campaigns', 'not json');
      expect(s.get('ice')).toBeUndefined();
    } finally {
      delete (globalThis as { localStorage?: unknown }).localStorage;
    }
  });
});
