import { useEffect, useState } from 'react';
import { buildLevel, type Level } from '../../engine/board/level';
import { exportQuest } from '../../engine/editor/io';
import { labelOf, normalizeTeam, type TeamMember } from '../../engine/data/team';
import type { CampaignStore } from '../../persist/campaigns';
import type { TeamInput } from '../../engine/data/team';
import { TeamPicker } from './TeamPicker';
import {
  orphanSaves,
  resume,
  type OrphanSave,
  type Resumed,
  type SaveStore,
} from '../../persist/saves';
import { clearOverride, getOverrides } from '../../persist/questOverrides';
import type { UserQuestStore } from '../../persist/userQuests';
import { useFitMode } from '../FitToScreen';
import { questEntries as bundledEntries } from '../quests';
import { SAVED_GAME_FAILED } from '../store/openSaved';
import { Dialog } from '../shared/Frame';
import { QuestSettingsCard } from '../shared/QuestSettingsCard';
import { CORE_PACK } from '../../engine/pack/registry';
import { packOfQuest, packTabs, packs } from '../packs';

export type StartChoice =
  | {
      kind: 'new';
      level: Level;
      team: readonly TeamMember[];
      /** One-shot: this quest alone. Campaign: it is kept in the pack's campaign (decision 37). */
      mode: 'oneShot' | 'campaign';
      /** The pack of the quest (an edited copy stays in the pack of the quest it copies). */
      pack: string | undefined;
      /** The id of the bundled quest, also for an edited copy. */
      questId: string;
    }
  | {
      kind: 'resume';
      level: Level;
      resumed: Extract<Resumed, { ok: true }>;
      questId: string;
      pack: string | undefined;
    };

export interface SelectScreenProps {
  saves: SaveStore;
  /** The campaign of each pack, kept on this device. */
  campaigns: CampaignStore;
  onStart(choice: StartChoice): void;
  /** A short message to show, for example when a saved game could not be opened. */
  notice?: string | undefined;
  /** Open the quest editor. */
  onEditor?: (() => void) | undefined;
  /** Open the texture packs dialog. */
  onTextures?: (() => void) | undefined;
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
  notice,
  onEditor,
  onTextures,
  textureName,
  userStore,
}: SelectScreenProps) {
  useFitMode('width');
  // Edited copies by bundled quest slot. Reload after "Use original".
  const [edited, setEdited] = useState<ReadonlyMap<number, Level>>(new Map());
  useEffect(() => {
    if (!userStore) return;
    let live = true;
    void (async () => {
      const map = new Map<number, Level>();
      for (const [n, id] of Object.entries(getOverrides())) {
        try {
          // The editor autosaves a draft; Save removes it. A draft is the newest version, so play it.
          let level: Level | undefined;
          try {
            const draft = await userStore.loadDraft(id);
            if (draft) level = buildLevel(draft.quest);
          } catch {
            /* a draft that cannot be built is ignored: the saved copy is played */
          }
          if (!level) {
            const quest = await userStore.load(id);
            if (quest) level = buildLevel(quest);
          }
          if (level) map.set(Number(n), level);
        } catch {
          /* a broken copy is ignored: the original is played */
        }
      }
      if (live) setEdited(map);
    })();
    return () => {
      live = false;
    };
  }, [userStore]);
  const questEntries = bundledEntries.map((q) => {
    const level = edited.get(q.slot);
    return level ? { ...q, level } : q;
  });

  /** A quest of this device (made in the editor) is shown with the core game. */
  const inPack = (questId: string) => packOfQuest(questId) ?? CORE_PACK;
  /** The id of the bundled quest of an entry, also when its level is an edited copy. */
  const baseId = (q: { slot: number; level?: Level | undefined }) =>
    bundledEntries.find((b) => b.slot === q.slot)?.level?.quest.id ?? q.level?.quest.id ?? '';
  /** The pack of an entry: an edited copy has a new id, so it stays in the pack of the quest it copies. */
  const packOfEntry = (q: { slot: number; level?: Level | undefined }) => {
    const original = bundledEntries.find((b) => b.slot === q.slot)?.level ?? q.level;
    return original ? inPack(original.quest.id) : CORE_PACK;
  };
  const [packId, setPackId] = useState<string>(CORE_PACK);
  const tabs = packTabs(packs, (id) => bundledEntries.some((q) => q.level?.quest.id === id));
  // Saved games that no quest here matches (for example a pack that is not installed).
  const [orphans, setOrphans] = useState<readonly OrphanSave[]>([]);
  useEffect(() => {
    let live = true;
    void (async () => {
      const known = new Set(bundledEntries.flatMap((q) => (q.level ? [q.level.quest.id] : [])));
      for (const id of Object.values(getOverrides())) known.add(id);
      for (const r of (await userStore?.list()) ?? []) known.add(r.id);
      const found = await orphanSaves(
        saves,
        (id) => known.has(id),
        (p) => packs.byId.has(p),
      );
      if (live) setOrphans(found);
    })();
    return () => {
      live = false;
    };
  }, [saves, userStore]);
  const [slot, setSlot] = useState<number | undefined>(
    () => questEntries.find((q) => q.level)?.slot,
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [team, setTeam] = useState<readonly TeamMember[]>([]);
  const [saved, setSaved] = useState<{ id: string; r: Resumed } | undefined>();
  /** The Heroes popup of "New game". */
  const [choosing, setChoosing] = useState(false);

  const shown = questEntries.filter((q) =>
    tabs.length === 0 ? true : q.level ? packOfEntry(q) === packId : packId === CORE_PACK,
  );
  const entry = questEntries.find((q) => q.slot === slot);
  const level = entry?.level;
  const questId = level?.quest.id;

  // Is there an autosave for the chosen quest?
  useEffect(() => {
    if (!level) return;
    let live = true;
    void resume(saves, level).then((r) => {
      if (live) setSaved({ id: level.quest.id, r });
    });
    return () => {
      live = false;
    };
  }, [saves, level]);

  const resumed = saved && saved.id === questId && saved.r.ok ? saved.r : undefined;
  const unusable = saved && saved.id === questId && !saved.r.ok && saved.r.reason !== 'none';

  // The packs whose heroes and allies the popup offers: the pack of the quest and the ones it needs.
  const questPack = level ? packOfEntry({ slot: slot ?? 0, level }) : CORE_PACK;
  const teamPacks = [...(packs.byId.get(questPack)?.requires ?? []), questPack]
    .map((id) => packs.byId.get(id)?.manifest)
    .filter((m) => m !== undefined);
  const ready = team.some((m) => m.kind === 'hero');

  // Play mode (decision 37): a campaign of this pack, or the quest alone.
  const [campaignTick, setCampaignTick] = useState(0);
  void campaignTick; // read again after a change
  const campaign = campaigns.get(questPack);
  const packName =
    questPack === CORE_PACK
      ? 'the core game'
      : (packs.byId.get(questPack)?.manifest.name ?? questPack);
  const packTotal = packs.byId.get(questPack)?.manifest.quests.length ?? 0;
  const [mode, setMode] = useState<'oneShot' | 'campaign'>('oneShot');
  const [confirmReset, setConfirmReset] = useState(false);
  const openChoosing = () => {
    const c = campaigns.get(questPack);
    setMode(c ? 'campaign' : 'oneShot');
    setTeam(c ? normalizeTeam(c.team as TeamInput[]).filter((m) => !c.fallen.includes(m.id)) : []);
    setChoosing(true);
  };
  const chooseMode = (next: 'oneShot' | 'campaign') => {
    setMode(next);
    const c = campaigns.get(questPack);
    if (next === 'campaign' && c && team.length === 0)
      setTeam(normalizeTeam(c.team as TeamInput[]).filter((m) => !c.fallen.includes(m.id)));
  };
  const fellLast = campaign
    ? campaign.fallen.map((id) => labelOf(normalizeTeam(campaign.team as TeamInput[]), id))
    : [];

  return (
    <div className="app select">
      <header>
        <span className="qn">SoloQuest</span>
        <h1>Choose a quest</h1>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {level && (
            <button
              className="link"
              data-testid="quest-settings"
              onClick={() => setSettingsOpen(true)}
            >
              Quest settings
            </button>
          )}
          {onTextures && (
            <button
              className="link"
              onClick={onTextures}
              data-testid="textures-link"
              aria-label={textureName ? `Textures: ${textureName} in use` : 'Textures'}
            >
              {textureName ? (
                <>
                  Textures: <b className="tex-name">{textureName}</b>
                </>
              ) : (
                'Textures'
              )}
            </button>
          )}
          {onEditor && (
            <button className="link" onClick={onEditor}>
              Quest editor
            </button>
          )}
        </span>
      </header>

      <div className="pickcol">
        {tabs.length > 0 && (
          <div className="packtabs" role="tablist" aria-label="Quest packs">
            {tabs.map((p) => (
              <button
                key={p.id}
                role="tab"
                className="chip"
                aria-selected={p.id === packId}
                data-testid={`pack-${p.id}`}
                onClick={() => {
                  setPackId(p.id);
                  const first = questEntries.find((q) => q.level && packOfEntry(q) === p.id);
                  if (first) setSlot(first.slot);
                }}
              >
                {p.name}
              </button>
            ))}
          </div>
        )}
        {orphans.map((o) => (
          <p key={o.questId} className="hint orphan" role="status" data-testid="orphan-save">
            {o.message}{' '}
            <button
              className="link"
              onClick={() => {
                void saves
                  .remove(o.questId)
                  .then(() => setOrphans((list) => list.filter((x) => x.questId !== o.questId)));
              }}
            >
              Delete the save
            </button>
          </p>
        ))}

        <div className="pick">
          {shown.map((q) => (
            <button
              key={q.slot}
              className="qcard"
              aria-pressed={q.slot === slot}
              disabled={!q.level}
              onClick={() => {
                setSlot(q.slot);
              }}
            >
              <span className="qnum">Quest {q.number}</span>
              {q.level && <span className="qtitle">{q.level.quest.title}</span>}
              {edited.has(q.slot) && <span className="qnote">Edited</span>}
              {q.level && campaigns.get(packOfEntry(q))?.finished.includes(baseId(q)) && (
                <span className="qnote" data-testid="quest-done">
                  Done
                </span>
              )}
              {!q.level && <span className="qnote">Not encoded yet</span>}
            </button>
          ))}
        </div>
      </div>

      <aside className="side">
        {level && (
          <>
            <section>
              <div className="lbl">Quest {level.quest.number}</div>
              <h2>{level.quest.title}</h2>
              {/* the story comes right under the title */}
              <p className="summary">{level.quest.intro.summary}</p>
              {level.quest.suggestedPack && (
                <p className="hint" data-testid="suggested-pack">
                  Looks best with the texture pack {level.quest.suggestedPack}.
                </p>
              )}
              {entry && edited.has(entry.slot) && (
                <>
                  <p className="hint">This is your edited copy.</p>
                  <button
                    className="btn alt"
                    onClick={() => {
                      if (entry) clearOverride(entry.slot);
                      setEdited((m) => {
                        const next = new Map(m);
                        if (entry) next.delete(entry.slot);
                        return next;
                      });
                    }}
                  >
                    Use original
                  </button>
                  <button
                    className="btn alt"
                    onClick={() => {
                      const orig = bundledEntries.find((b) => b.slot === entry?.slot);
                      if (orig?.level) downloadForPublishing(level, orig.level.quest.id);
                    }}
                  >
                    Export to publish (admin)
                  </button>
                </>
              )}
            </section>

            {resumed && (
              <section className="saved">
                <div className="lbl">Saved game</div>
                <p>
                  Turn {resumed.state.turn} ·{' '}
                  {resumed.team.map((m) => labelOf(resumed.team, m.id)).join(', ')}
                </p>
                <button
                  className="btn"
                  onClick={() =>
                    onStart({
                      kind: 'resume',
                      level,
                      resumed,
                      questId: baseId({ slot: slot ?? 0, level }),
                      pack: questPack,
                    })
                  }
                >
                  Resume
                </button>
              </section>
            )}
            {notice && !unusable && (
              <p className="hint" role="alert">
                {notice}
              </p>
            )}
            {unusable && (
              <p className="hint" role="alert">
                {SAVED_GAME_FAILED}
              </p>
            )}

            <div className="actions">
              <button
                className={resumed ? 'btn alt' : 'btn'}
                data-testid="new-game"
                onClick={openChoosing}
              >
                New game
              </button>
            </div>
            {campaign && (
              <>
                <p className="hint" data-testid="campaign-progress">
                  Campaign of {packName}: {campaign.finished.length} of {packTotal} quests done.
                </p>
                <button className="link" onClick={() => setConfirmReset(true)}>
                  Start a new campaign
                </button>
              </>
            )}
          </>
        )}
      </aside>

      {settingsOpen && level && (
        <QuestSettingsCard
          questId={level.quest.id}
          title={level.quest.title}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {confirmReset && (
        <Dialog
          title="Start a new campaign"
          onClose={() => setConfirmReset(false)}
          foot={
            <>
              <button className="btn alt" autoFocus onClick={() => setConfirmReset(false)}>
                Keep it
              </button>
              <button
                className="btn"
                onClick={() => {
                  campaigns.clear(questPack);
                  setConfirmReset(false);
                  setCampaignTick((n) => n + 1);
                }}
              >
                Start a new campaign
              </button>
            </>
          }
        >
          <p>
            This forgets the finished quests, the carried flags and the settings of this pack's
            campaign. The next campaign game starts a new one.
          </p>
        </Dialog>
      )}

      {choosing && level && (
        <Dialog
          title="Choose your heroes"
          onClose={() => setChoosing(false)}
          foot={
            <>
              <button className="btn alt" autoFocus onClick={() => setChoosing(false)}>
                {resumed ? 'Keep the saved game' : 'Cancel'}
              </button>
              <button
                className="btn"
                disabled={!ready}
                aria-describedby={ready ? undefined : 'team-hint'}
                onClick={() => {
                  setChoosing(false);
                  onStart({
                    kind: 'new',
                    level,
                    team,
                    mode,
                    pack: questPack,
                    questId: baseId({ slot: slot ?? 0, level }),
                  });
                }}
              >
                {resumed ? 'Replace it and start' : 'Start the quest'}
              </button>
            </>
          }
        >
          {resumed && (
            <p className="hint" role="alert">
              This replaces the saved game (turn {resumed.state.turn}). It cannot be brought back.
            </p>
          )}
          <div className="lbl">Play mode</div>
          <div className="pick-heroes" role="group" aria-label="Play mode">
            <button
              className="chip"
              aria-pressed={mode === 'oneShot'}
              onClick={() => chooseMode('oneShot')}
            >
              One-shot
            </button>
            <button
              className="chip"
              aria-pressed={mode === 'campaign'}
              onClick={() => chooseMode('campaign')}
            >
              Campaign
            </button>
          </div>
          <p className="hint" data-testid="mode-hint">
            {mode === 'oneShot'
              ? 'This quest alone. Carried flags take their one-shot values.'
              : campaign
                ? `Campaign: ${campaign.finished.length} of ${packTotal} quests done.`
                : `A new campaign starts for ${packName}.`}
          </p>
          {mode === 'campaign' && fellLast.length > 0 && (
            <p className="hint">
              Fell in the last quest: {fellLast.join(', ')}. Tap a chip to bring them back.
            </p>
          )}
          <TeamPicker value={team} onChange={setTeam} packs={teamPacks} rule={level.quest.team} />
          <p className="hint" id="team-hint">
            {ready ? 'Pick 1 to 4 heroes.' : 'Pick 1 to 4 heroes to start the quest.'}
          </p>
        </Dialog>
      )}
    </div>
  );
}
