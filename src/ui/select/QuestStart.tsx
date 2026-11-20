import { useEffect, useMemo, useState } from 'react';
import { labelOf, normalizeTeam, type TeamInput, type TeamMember } from '../../engine/data/team';
import { newCampaign, type Campaign } from '../../engine/pack/campaign';
import { MemoryCampaignStore, type CampaignStore } from '../../persist/campaigns';
import { resume, type Resumed, type SaveStore } from '../../persist/saves';
import { CORE_PACK } from '../../engine/pack/registry';
import { packs } from '../packs';
import { SAVED_GAME_FAILED } from '../store/openSaved';
import { QuestSettingsCard } from '../shared/QuestSettingsCard';
import { t } from '../../i18n/t';
import { TeamPicker } from './TeamPicker';
import { PageHeader, type Playable, type StartChoice } from './parts';

/**
 * The page where the heroes are chosen for one quest. Three uses:
 * - `single`: a quest played alone (no campaign, flags take their one-shot values),
 * - `campaign`: the next quest of a saved campaign (the team of the campaign, who fell left out),
 * - `new`: the heroes of a new campaign, for the first quest of its pack.
 */
export function QuestStart({
  mode,
  playable,
  saves,
  campaigns,
  campaign,
  notice,
  onStart,
  onBack,
  onUseOriginal,
  onExport,
}: {
  mode: 'single' | 'campaign' | 'new';
  playable: Playable;
  saves: SaveStore;
  campaigns: CampaignStore;
  /** `campaign`: the saved campaign. `new`: the id and the name the new campaign will have. */
  campaign: Campaign | { id: string; name: string } | undefined;
  notice?: string | undefined;
  onStart(choice: StartChoice): void;
  onBack(): void;
  onUseOriginal?: (() => void) | undefined;
  onExport?: (() => void) | undefined;
}) {
  const { level } = playable;
  const quest = level.quest;
  const questPack = playable.pack ?? CORE_PACK;
  const manifest = playable.pack ? packs.byId.get(playable.pack)?.manifest : undefined;
  const teamPacks = [...(packs.byId.get(questPack)?.requires ?? []), questPack]
    .map((id) => packs.byId.get(id)?.manifest)
    .filter((m) => m !== undefined);

  const saved = mode === 'campaign' ? (campaign as Campaign | undefined) : undefined;
  const fallen = saved?.fallen ?? [];
  const [team, setTeam] = useState<readonly TeamMember[]>(() =>
    saved ? normalizeTeam(saved.team as TeamInput[]).filter((m) => !fallen.includes(m.id)) : [],
  );
  const fellLast = saved
    ? fallen.map((id) => labelOf(normalizeTeam(saved.team as TeamInput[]), id))
    : [];
  const ready = team.some((m) => m.kind === 'hero');

  // The autosave of this quest, if it can be opened.
  const [last, setLast] = useState<Resumed | undefined>();
  useEffect(() => {
    let live = true;
    void resume(saves, level).then((r) => {
      if (live) setLast(r);
    });
    return () => {
      live = false;
    };
  }, [saves, level]);
  const unusable = last && !last.ok && last.reason !== 'none';
  const exists = last?.ok === true;
  // A saved game is resumed in the mode it was played in; otherwise starting replaces it.
  const resumed =
    last?.ok && (mode === 'single' ? last.campaignId === undefined : last.campaignId === saved?.id)
      ? last
      : undefined;
  const turn = last?.ok ? last.state.turn : 0;

  const [questSettings, setQuestSettings] = useState(false);
  const [campaignSettings, setCampaignSettings] = useState(false);
  // The settings of a campaign that is not made yet are kept here until Start.
  const draft = useMemo(() => {
    const store = new MemoryCampaignStore();
    if (mode === 'new' && manifest && campaign)
      store.set(newCampaign(manifest, 0, { id: campaign.id, name: campaign.name }));
    return store;
  }, [mode, manifest, campaign]);
  const hasCampaignSettings = (manifest?.campaignSettings.length ?? 0) > 0;

  const start = () => {
    const settings =
      mode === 'new' && campaign
        ? (draft.get(campaign.id)?.settings ?? {})
        : (saved?.settings ?? {});
    onStart({
      kind: 'new',
      level,
      team,
      pack: playable.pack,
      questId: playable.key,
      ...(mode !== 'single' && campaign
        ? { campaign: { id: campaign.id, name: campaign.name, settings } }
        : {}),
    });
  };

  const title =
    mode === 'new'
      ? t('select.heroesForYourCampaign', 'Heroes for your campaign')
      : t('select.chooseYourHeroes', 'Choose your heroes');

  return (
    <>
      <PageHeader title={title} onBack={onBack} />
      <div className="pickcol start-team">
        <TeamPicker value={team} onChange={setTeam} packs={teamPacks} rule={quest.team} />
        <p className="hint" id="team-hint">
          {ready
            ? t('select.pick1To4', 'Pick 1 to 4 heroes.')
            : t('select.pick1To42', 'Pick 1 to 4 heroes to start the quest.')}
        </p>
      </div>

      <aside className="side">
        <section>
          <div className="lbl">
            {mode === 'new'
              ? t('select.firstQuest', 'First quest')
              : playable.number === undefined
                ? t('select.questOfThisDevice', 'Quest made on this device')
                : t('select.quest', 'Quest {number}', { number: playable.number })}
          </div>
          <h2>{quest.title}</h2>
          <p className="summary">{quest.intro.summary}</p>
          {quest.suggestedPack && (
            <p className="hint" data-testid="suggested-pack">
              {t('select.looksBestWithThe', 'Looks best with the texture pack {suggestedPack}.', {
                suggestedPack: quest.suggestedPack,
              })}
            </p>
          )}
          {playable.edited && (
            <>
              <p className="hint">{t('select.thisIsYourEdited', 'This is your edited copy.')}</p>
              <button className="btn alt" onClick={onUseOriginal}>
                {t('select.useOriginal', 'Use original')}
              </button>
              <button className="btn alt" onClick={onExport}>
                {t('select.exportToPublishAdmin', 'Export to publish (admin)')}
              </button>
            </>
          )}
        </section>

        {mode === 'new' && (
          <p className="hint" data-testid="mode-hint">
            {t(
              'select.heroesCanBeChanged',
              'Heroes can be changed before each quest. Mercenaries and animals can be added.',
            )}
          </p>
        )}
        {fellLast.length > 0 && (
          <p className="hint">
            {t(
              'select.fellInTheLast',
              'Fell in the last quest: {heroes}. Tap a chip to bring them back.',
              { heroes: fellLast.join(', ') },
            )}
          </p>
        )}

        {resumed?.ok && (
          <section className="saved">
            <div className="lbl">{t('select.savedGame', 'Saved game')}</div>
            <p>
              {t('select.turn', 'Turn {turn} · {heroes}', {
                turn: resumed.state.turn,
                heroes: resumed.team.map((m) => labelOf(resumed.team, m.id)).join(', '),
              })}
            </p>
            <button
              className="btn"
              onClick={() =>
                onStart({
                  kind: 'resume',
                  level,
                  resumed,
                  questId: playable.key,
                  pack: playable.pack,
                })
              }
            >
              {t('select.resume', 'Resume')}
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
            className="link"
            data-testid="quest-settings"
            onClick={() => setQuestSettings(true)}
          >
            {t('select.questSettings', 'Quest settings')}
          </button>
          {mode !== 'single' && hasCampaignSettings && (
            <button
              className="link"
              data-testid="campaign-settings"
              onClick={() => setCampaignSettings(true)}
            >
              {t('select.campaignSettings', 'Campaign settings')}
            </button>
          )}
          {exists && (
            <p className="hint" data-testid="replace-hint">
              {t(
                'select.startingReplacesTheSaved',
                'Starting replaces the saved game (turn {turn}). It cannot be brought back.',
                { turn },
              )}
            </p>
          )}
          <button
            className={resumed ? 'btn alt' : 'btn'}
            data-testid="start-game"
            disabled={!ready}
            aria-describedby={ready ? undefined : 'team-hint'}
            onClick={start}
          >
            {mode !== 'single'
              ? t('select.start', 'Start')
              : exists
                ? t('select.replaceItAndStart', 'Replace it and start')
                : t('select.startTheQuest', 'Start the quest')}
          </button>
        </div>
      </aside>

      {questSettings && (
        <QuestSettingsCard
          questId={quest.id}
          title={quest.title}
          solo={quest.team?.solo === true}
          onClose={() => setQuestSettings(false)}
        />
      )}
      {campaignSettings && manifest && campaign && (
        <QuestSettingsCard
          questId={quest.id}
          title={campaign.name || manifest.name}
          campaignOnly
          campaign={{
            store: mode === 'new' ? draft : campaigns,
            pack: manifest,
            campaignId: campaign.id,
          }}
          onClose={() => setCampaignSettings(false)}
        />
      )}
    </>
  );
}
