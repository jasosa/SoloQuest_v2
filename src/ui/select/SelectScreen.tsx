import { useEffect, useMemo, useState } from 'react';
import { buildLevel, type Level } from '../../engine/board/level';
import { exportQuest } from '../../engine/editor/io';
import { nextCampaignSlot, nextQuest, skipQuest } from '../../engine/pack/campaign';
import { labelOf, normalizeTeam, type TeamInput } from '../../engine/data/team';
import { CampaignsPage, type SavedCampaign } from './CampaignsPage';
import type { CampaignStore } from '../../persist/campaigns';
import {
  campaignOfSave,
  orphanSaves,
  resume,
  type OrphanSave,
  type SaveStore,
} from '../../persist/saves';
import { clearOverride, getOverrides } from '../../persist/questOverrides';
import type { UserQuestStore } from '../../persist/userQuests';
import { useFitMode } from '../FitToScreen';
import { questEntries as bundledEntries } from '../quests';
import { inActiveLanguage } from '../../i18n/runtime';
import { CORE_PACK } from '../../engine/pack/registry';
import { packLabel, packOfQuest, packs } from '../packs';
import { t } from '../../i18n/t';
import { CampaignOverview } from './CampaignOverview';
import { QuestStart } from './QuestStart';
import { type Playable, type StartChoice } from './parts';
import { CollectionPage, HomePage } from './HomePage';
import { MINE, PlayQuestPage } from './PlayQuestPage';
import { getRecord, onHistoryChange, type QuestRecord } from '../../persist/history';
import { setBoxColor, setOwned, useBoxColors, useOwnedBoxes } from '../collection';
import { SettingsPage, type LastGame, type PackCard, type QuestCardData } from './StartPages';

export type { StartChoice } from './parts';

/** The pages of the start flow (see DESIGN.md, "Start flow"). */
export type Route =
  | { page: 'home' }
  | { page: 'settings' }
  | { page: 'collection' }
  | { page: 'singlePacks' }
  | { page: 'singleQuests'; pack: string }
  /** A quest played alone: choose the heroes. `key` is the quest id. */
  | { page: 'single'; key: string; back: Route }
  | { page: 'campaignPacks' }
  /** Heroes for a new campaign of a pack, with the first quest. */
  | { page: 'campaignNew'; pack: string; name?: string }
  | { page: 'campaign'; id: string }
  | { page: 'campaignQuest'; id: string; key: string };

export const HOME: Route = { page: 'home' };

/** A page whose quest or campaign is gone (deleted, not installed): go to a page that exists. */
function Redirect({ to, go }: { to: Route; go(route: Route): void }) {
  useEffect(() => go(to), [to, go]);
  return null;
}

export interface SelectScreenProps {
  saves: SaveStore;
  /** The campaigns of this device. */
  campaigns: CampaignStore;
  /** Returns false when the game could not be opened. */
  onStart(choice: StartChoice): boolean;
  /** The page shown. The app keeps it, so a finished game returns to the page it started from. */
  route: Route;
  onRoute(route: Route): void;
  /** A short message to show, for example when a saved game could not be opened. */
  notice?: string | undefined;
  /** Open the quest editor. */
  onEditor?: (() => void) | undefined;
  /** Open the texture packs dialog. */
  onTextures?: (() => void) | undefined;
  /** Opens the Translations dialog (decision 92). */
  onTranslations?: (() => void) | undefined;
  /** The name of the language in use (undefined: English). */
  languageName?: string | null | undefined;
  /** The name of the texture pack in use, or null/undefined for the built-in look. */
  textureName?: string | null | undefined;
  /** Edited copies of bundled quests replace them in the list. */
  userStore?: UserQuestStore | undefined;
}

/** Save the edited quest as a file for the bundled folder (admin: publish for everyone). */
function downloadForPublishing(edited: Level, bundledId: string): void {
  try {
    const text = exportQuest({ ...edited.quest, id: bundledId });
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${bundledId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    /* nothing to do: the browser blocked the download */
  }
}

export function SelectScreen({
  saves,
  campaigns,
  onStart,
  route,
  onRoute,
  notice,
  onEditor,
  onTextures,
  onTranslations,
  languageName,
  textureName,
  userStore,
}: SelectScreenProps) {
  useFitMode('width');
  // Edited copies by bundled quest slot. Reload after "Use original".
  const [edited, setEdited] = useState<ReadonlyMap<number, Level>>(new Map());
  // The quests made on this device (the editor), played as they were last saved.
  const [mine, setMine] = useState<readonly Level[]>([]);
  useEffect(() => {
    if (!userStore) return;
    let live = true;
    /** The newest version: the editor autosaves a draft and Save removes it. */
    const newest = async (id: string): Promise<Level | undefined> => {
      try {
        const draft = await userStore.loadDraft(id);
        if (draft) return buildLevel(inActiveLanguage(draft.quest));
      } catch {
        /* a draft that cannot be built is ignored: the saved copy is played */
      }
      const quest = await userStore.load(id);
      return quest ? buildLevel(quest) : undefined;
    };
    void (async () => {
      const map = new Map<number, Level>();
      const overridden = new Set<string>();
      for (const [n, id] of Object.entries(getOverrides())) {
        overridden.add(id);
        try {
          const level = await newest(id);
          if (level) map.set(Number(n), level);
        } catch {
          /* a broken copy is ignored: the original is played */
        }
      }
      const own: Level[] = [];
      try {
        for (const r of await userStore.list()) {
          if (overridden.has(r.id)) continue;
          try {
            const level = await newest(r.id);
            if (level) own.push(level);
          } catch {
            /* a quest that cannot be built is not listed */
          }
        }
      } catch {
        /* the store cannot be read: no other missions */
      }
      if (live) {
        setEdited(map);
        setMine(own);
      }
    })();
    return () => {
      live = false;
    };
  }, [userStore]);

  const playables = useMemo<Playable[]>(() => {
    const bundled = bundledEntries.flatMap((q): Playable[] => {
      if (!q.level) return [];
      const copy = edited.get(q.slot);
      return [
        {
          key: q.level.quest.id,
          level: copy ?? q.level,
          pack: packOfQuest(q.level.quest.id) ?? CORE_PACK,
          number: q.number,
          slot: q.slot,
          edited: copy !== undefined,
        },
      ];
    });
    const own = mine.map((level): Playable => ({
      key: level.quest.id,
      level,
      pack: undefined,
      number: undefined,
      slot: undefined,
      edited: false,
    }));
    return [...bundled, ...own];
  }, [edited, mine]);
  const byKey = useMemo(() => new Map(playables.map((p) => [p.key, p])), [playables]);

  // Counts up when a campaign is deleted: the lists are read again.
  const [tick, setTick] = useState(0);
  // Saved games: the newest one that opens (Home), and those no quest here matches.
  const [saveList, setSaveList] = useState<readonly { questId: string; campaignId?: string }[]>([]);
  const [last, setLast] = useState<LastGame | null | undefined>();
  const [orphans, setOrphans] = useState<readonly OrphanSave[]>([]);
  useEffect(() => {
    let live = true;
    void (async () => {
      let all: Awaited<ReturnType<SaveStore['list']>> = [];
      try {
        all = [...(await saves.list())].sort((a, b) => b.updatedAt - a.updatedAt);
      } catch {
        /* saved games cannot be read here */
      }
      const found = await orphanSaves(
        saves,
        (id) => playables.some((p) => p.level.quest.id === id || p.key === id),
        (p) => packs.byId.has(p),
      );
      let newest: LastGame | null = null;
      for (const g of all) {
        const p = playables.find((x) => x.level.quest.id === g.questId);
        if (!p) continue;
        // a game of a campaign that is gone would play without a campaign: not offered
        const cid = campaignOfSave(g);
        if (cid !== undefined && !campaigns.get(cid)) continue;
        const r = await resume(saves, p.level);
        if (r.ok) {
          const manifest = p.pack ? packs.byId.get(p.pack)?.manifest : undefined;
          newest = {
            playable: p,
            resumed: r,
            box: manifest ? packLabel(manifest) : t('select.myQuests', 'My quests'),
            campaignName: cid !== undefined ? campaigns.get(cid)?.name || undefined : undefined,
            at: g.updatedAt,
          };
          break;
        }
      }
      if (!live) return;
      setSaveList(
        all.map((g) => ({
          questId: g.questId,
          ...(campaignOfSave(g) !== undefined ? { campaignId: campaignOfSave(g)! } : {}),
        })),
      );
      setOrphans(found);
      setLast(newest);
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saves, playables, tick]);

  const go = onRoute;

  const encodedIn = (packId: string) =>
    playables.filter((p) => p.pack === packId && p.level).length;
  const installed = packs.packs.map((p) => p.manifest.id);
  const colors = useBoxColors(installed);
  const owned = useOwnedBoxes(installed);
  const packCards: PackCard[] = packs.packs
    .filter((p) => owned.has(p.manifest.id))
    .map((p) => ({
      id: p.manifest.id,
      name: packLabel(p.manifest),
      total: p.manifest.quests.length,
      encoded: encodedIn(p.manifest.id),
      color: colors[p.manifest.id]!,
    }));
  const counts = {
    quests: packCards.reduce((n, p) => n + p.encoded, 0),
    boxes: packCards.length,
    campaignsInProgress: campaigns
      .list()
      .filter((c) => (packs.byId.get(c.pack)?.manifest.quests.length ?? 0) > c.finished.length)
      .length,
    own: playables.filter((p) => p.pack === undefined).length,
  };
  const others = playables.filter((p) => p.pack === undefined);
  // Results of past games, read again when one is written.
  const [historyTick, setHistoryTick] = useState(0);
  useEffect(() => onHistoryChange(() => setHistoryTick((n) => n + 1)), []);
  const records = useMemo(() => {
    void historyTick;
    const m = new Map<string, QuestRecord>();
    for (const p of playables) {
      const r = getRecord(p.key);
      if (r) m.set(p.key, r);
    }
    return m;
  }, [playables, historyTick]);

  const startChoice = (choice: StartChoice) => onStart(choice);
  /** Forget a campaign and the saved games that belong to it (they must not show up in the next campaign of that id). */
  const deleteCampaign = async (id: string) => {
    try {
      for (const g of await saves.list())
        if (campaignOfSave(g) === id) await saves.remove(g.questId);
    } catch {
      /* saved games cannot be read here: the campaign goes anyway */
    }
    campaigns.clear(id);
    setTick((n) => n + 1);
    go({ page: 'campaignPacks' });
  };

  const publish = (p: Playable) => {
    const orig = bundledEntries.find((b) => b.slot === p.slot)?.level;
    if (orig) downloadForPublishing(p.level, orig.quest.id);
  };
  const restoreOriginal = (p: Playable) => {
    if (p.slot !== undefined) clearOverride(p.slot);
    setEdited((m) => {
      const next = new Map(m);
      if (p.slot !== undefined) next.delete(p.slot);
      return next;
    });
  };

  switch (route.page) {
    case 'collection':
      return (
        <div className="app select page">
          <CollectionPage
            boxes={packs.packs.map((p) => ({
              id: p.manifest.id,
              name: packLabel(p.manifest),
              quests: p.manifest.quests.length,
              always: p.manifest.id === CORE_PACK,
              owned: owned.has(p.manifest.id),
              color: colors[p.manifest.id]!,
            }))}
            onToggle={(id, on) => setOwned(id, on, installed)}
            onColor={setBoxColor}
            onBack={() => go(HOME)}
          />
        </div>
      );

    case 'settings':
      return (
        <div className="app select page">
          <SettingsPage
            textureName={textureName}
            languageName={languageName}
            onTextures={onTextures}
            onTranslations={onTranslations}
            onBack={() => go(HOME)}
          />
        </div>
      );

    case 'singlePacks':
    case 'singleQuests': {
      const boxId = route.page === 'singleQuests' ? route.pack : CORE_PACK;
      const inBox = (id: string) =>
        bundledEntries.filter((q) =>
          q.level ? (packOfQuest(q.level.quest.id) ?? CORE_PACK) === id : id === CORE_PACK,
        );
      const cards: QuestCardData[] =
        boxId === MINE
          ? others.map((p, i) => ({
              slot: i,
              number: undefined,
              playable: p,
              note: saveList.some((g) => g.questId === p.level.quest.id)
                ? t('select.savedGame', 'Saved game')
                : undefined,
            }))
          : inBox(boxId).map((q) => {
              const p = q.level ? byKey.get(q.level.quest.id) : undefined;
              const hasSave = p && saveList.some((g) => g.questId === p.level.quest.id);
              return {
                slot: q.slot,
                number: q.number,
                playable: p,
                note: hasSave ? t('select.savedGame', 'Saved game') : undefined,
              };
            });
      const entries = [
        ...packCards.map((c) => ({ id: c.id, name: c.name, count: c.total, color: c.color })),
        ...(others.length > 0 || boxId === MINE
          ? [
              {
                id: MINE,
                name: t('select.myQuests', 'My quests'),
                count: others.length,
                color: 'var(--muted)',
              },
            ]
          : []),
      ];
      const manifest = packs.byId.get(boxId)?.manifest;
      return (
        <div className="app select page">
          <PlayQuestPage
            key={boxId}
            boxes={entries}
            box={boxId}
            boxName={
              boxId === MINE
                ? t('select.myQuests', 'My quests')
                : manifest
                  ? packLabel(manifest)
                  : boxId
            }
            cards={cards}
            records={records}
            onBox={(pack) => go({ page: 'singleQuests', pack })}
            onChoose={(p) => go({ page: 'single', key: p.key, back: route })}
            onBack={() => go(HOME)}
          />
        </div>
      );
    }

    case 'single': {
      const playable = byKey.get(route.key);
      if (!playable) return <Redirect to={HOME} go={go} />;
      return (
        <div className="app select page">
          <QuestStart
            key={route.key}
            mode="single"
            playable={playable}
            saves={saves}
            campaigns={campaigns}
            campaign={undefined}
            notice={notice}
            onStart={startChoice}
            onBack={() => go(route.back)}
            onUseOriginal={() => restoreOriginal(playable)}
            onExport={() => publish(playable)}
          />
        </div>
      );
    }

    case 'campaignPacks': {
      const nameFor = (pack: string) =>
        t('select.campaignNumber', 'Campaign {number}', {
          number: nextCampaignSlot(
            pack,
            campaigns.list().map((c) => c.id),
          ).number,
        });
      const saved: SavedCampaign[] = campaigns.list().map((c) => {
        const manifest = packs.byId.get(c.pack)?.manifest;
        const next = manifest ? nextQuest(manifest, c) : undefined;
        const p = next ? byKey.get(next) : undefined;
        const team = normalizeTeam(c.team as TeamInput[]);
        return {
          campaign: c,
          usable: manifest !== undefined,
          packName: manifest ? packLabel(manifest) : c.pack,
          quests: manifest?.quests ?? [],
          next: p
            ? p.number === undefined
              ? p.level.quest.title
              : t('select.questAndTitle', 'Quest {number} · {title}', {
                  number: p.number,
                  title: p.level.quest.title,
                })
            : undefined,
          nextInProgress:
            p !== undefined &&
            saveList.some((g) => g.questId === p.level.quest.id && g.campaignId === c.id),
          heroes: team.map((m) => labelOf(team, m.id)).join(', '),
          color: colors[c.pack] ?? 'var(--ink)',
        };
      });
      return (
        <div className="app select page">
          <CampaignsPage
            saved={saved}
            cards={packCards.filter((c) => c.encoded > 0)}
            nextName={nameFor}
            onNew={(pack, name) => go({ page: 'campaignNew', pack, name })}
            onCampaign={(id) => go({ page: 'campaign', id })}
            onDeleteCampaign={(id) => void deleteCampaign(id)}
            onBack={() => go(HOME)}
          />
        </div>
      );
    }

    case 'campaignNew': {
      const manifest = packs.byId.get(route.pack)?.manifest;
      const first = manifest?.quests.map((id) => byKey.get(id)).find((p) => p !== undefined);
      if (!manifest || !first) return <Redirect to={{ page: 'campaignPacks' }} go={go} />;
      const slot = nextCampaignSlot(
        route.pack,
        campaigns.list().map((c) => c.id),
      );
      return (
        <div className="app select page">
          <QuestStart
            key={`new-${slot.id}`}
            mode="new"
            playable={first}
            saves={saves}
            campaigns={campaigns}
            campaign={{
              id: slot.id,
              name:
                route.name ??
                t('select.campaignNumber', 'Campaign {number}', { number: slot.number }),
            }}
            notice={notice}
            onStart={(choice) => {
              if (startChoice(choice) && choice.kind === 'new' && choice.campaign)
                go({ page: 'campaign', id: choice.campaign.id });
            }}
            onBack={() => go({ page: 'campaignPacks' })}
          />
        </div>
      );
    }

    case 'campaign': {
      const campaign = campaigns.get(route.id);
      const manifest = campaign ? packs.byId.get(campaign.pack)?.manifest : undefined;
      if (!campaign || !manifest) return <Redirect to={{ page: 'campaignPacks' }} go={go} />;
      const inPack = new Map(
        manifest.quests.flatMap((id) => {
          const p = byKey.get(id);
          return p ? [[id, p] as const] : [];
        }),
      );
      const savedHere = new Set(
        manifest.quests.filter((id) => {
          const p = inPack.get(id);
          return (
            p &&
            saveList.some((g) => g.questId === p.level.quest.id && g.campaignId === campaign.id)
          );
        }),
      );
      return (
        <div className="app select page">
          <CampaignOverview
            campaign={campaign}
            manifest={manifest}
            playables={inPack}
            savedHere={savedHere}
            onQuest={(key) => go({ page: 'campaignQuest', id: campaign.id, key })}
            onSkip={(id) => {
              campaigns.set(skipQuest(campaign, id, Date.now()));
              setTick((n) => n + 1);
            }}
            onBack={() => go({ page: 'campaignPacks' })}
          />
        </div>
      );
    }

    case 'campaignQuest': {
      const campaign = campaigns.get(route.id);
      const playable = byKey.get(route.key);
      if (!campaign || !playable) return <Redirect to={{ page: 'campaignPacks' }} go={go} />;
      return (
        <div className="app select page">
          <QuestStart
            key={`${route.id}-${route.key}`}
            mode="campaign"
            playable={playable}
            saves={saves}
            campaigns={campaigns}
            campaign={campaign}
            notice={notice}
            onStart={(choice) => {
              if (startChoice(choice)) go({ page: 'campaign', id: campaign.id });
            }}
            onBack={() => go({ page: 'campaign', id: campaign.id })}
          />
        </div>
      );
    }

    default:
      return (
        <div className="app select page">
          <HomePage
            last={last}
            counts={counts}
            onCollection={() => go({ page: 'collection' })}
            notice={notice}
            orphans={orphans}
            onSingle={() => go({ page: 'singlePacks' })}
            onCampaign={() => go({ page: 'campaignPacks' })}
            onContinue={() => {
              if (!last) return;
              const { playable, resumed } = last;
              const ok = startChoice({
                kind: 'resume',
                level: playable.level,
                resumed,
                questId: playable.key,
                pack: playable.pack,
              });
              if (ok && resumed.campaignId) go({ page: 'campaign', id: resumed.campaignId });
            }}
            onSettings={() => go({ page: 'settings' })}
            onEditor={onEditor}
            onDeleteOrphan={(questId) => {
              void saves
                .remove(questId)
                .then(() => setOrphans((list) => list.filter((x) => x.questId !== questId)));
            }}
          />
        </div>
      );
  }
}
