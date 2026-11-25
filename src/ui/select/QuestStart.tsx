import { useEffect, useMemo, useState } from 'react';
import { labelOf, normalizeTeam, type TeamInput, type TeamMember } from '../../engine/data/team';
import { newCampaign, startFlagsFor, type Campaign } from '../../engine/pack/campaign';
import { MemoryCampaignStore, type CampaignStore } from '../../persist/campaigns';
import { resume, type Resumed, type SaveStore } from '../../persist/saves';
import { CORE_PACK } from '../../engine/pack/registry';
import { packs } from '../packs';
import { SAVED_GAME_FAILED } from '../store/openSaved';
import { SettingsRows } from '../shared/QuestSettingsCard';
import { t } from '../../i18n/t';
import { TeamPicker } from './TeamPicker';
import { PageHeader, flagWords, type Playable, type StartChoice } from './parts';

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
    last?.ok &&
    mode !== 'new' &&
    (mode === 'single' ? last.campaignId === undefined : last.campaignId === saved?.id)
      ? last
      : undefined;
  const turn = last?.ok ? last.state.turn : 0;

  // The settings of a campaign that is not made yet are kept here until Start.
  const draft = useMemo(() => {
    const store = new MemoryCampaignStore();
    if (mode === 'new' && manifest && campaign)
      store.set(newCampaign(manifest, 0, { id: campaign.id, name: campaign.name }));
    return store;
  }, [mode, manifest, campaign]);

  // "Before you start": the carried flags this quest begins with, as the campaign or the one-shot gives them.
  const asked = quest.flagsIn ?? [];
  const given = useMemo(() => startFlagsFor(quest, saved), [quest, saved]);
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const answer = (flag: string): boolean => answers[flag] ?? given[flag] ?? false;

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
      flags: Object.fromEntries(asked.map((f) => [f.flag, answer(f.flag)])),
      ...(mode !== 'single' && campaign
        ? { campaign: { id: campaign.id, name: campaign.name, settings } }
        : {}),
    });
  };

  const title =
    mode === 'new'
      ? t('select.heroesForYourCampaign', 'Heroes for your campaign')
      : playable.number === undefined
        ? quest.title
        : t('select.questAndTitle', 'Quest {number} · {title}', {
            number: playable.number,
            title: quest.title,
          });
  const subtitle = [
    manifest ? manifest.name : t('select.coreGame', 'Core game'),
    campaign && mode !== 'single'
      ? t('select.campaignNamed', 'Campaign "{name}"', { name: campaign.name })
      : undefined,
  ]
    .filter((x) => x !== undefined)
    .join(' · ');
  const settingsCampaign =
    mode !== 'single' && manifest && campaign
      ? {
          store: mode === 'new' ? draft : campaigns,
          pack: manifest,
          campaignId: campaign.id,
        }
      : undefined;
  const heroCount = team.filter((m) => m.kind === 'hero').length;

  return (
    <>
      <PageHeader title={title} onBack={onBack}>
        <span className="hint head-hint">{subtitle}</span>
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
      </PageHeader>
      <div className="setup-wrap">
        <main className="stage setup">
          <section className="card setup-col start-team" aria-label={t('select.heroes', 'Heroes')}>
            <h2>{t('select.numberedHeroes', '1 · Heroes')}</h2>
            <p className="hint" data-testid={mode === 'new' ? 'mode-hint' : undefined}>
              {mode === 'new'
                ? t(
                    'select.heroesCanBeChanged',
                    'Heroes can be changed before each quest. Mercenaries and animals can be added.',
                  )
                : t('select.pick1To4Hint', 'Any hero from your boxes can play.')}
            </p>
            {fellLast.length > 0 && (
              <p className="hint">
                {t(
                  'select.fellInTheLast',
                  'Fell in the last quest: {heroes}. Tap a chip to bring them back.',
                  { heroes: fellLast.join(', ') },
                )}
              </p>
            )}
            <TeamPicker value={team} onChange={setTeam} packs={teamPacks} rule={quest.team} />
          </section>

          <section
            className="card setup-col"
            aria-label={t('select.beforeYouStart', 'Before you start')}
          >
            <h2>{t('select.numberedBefore', '2 · Before you start')}</h2>
            <h3 className="quest-title" data-testid="quest-title">
              {quest.title}
            </h3>
            <p className="summary">{quest.intro.summary}</p>
            {quest.suggestedPack && (
              <p className="hint" data-testid="suggested-pack">
                {t('select.looksBestWithThe', 'Looks best with the texture pack {suggestedPack}.', {
                  suggestedPack: quest.suggestedPack,
                })}
              </p>
            )}
            {asked.length > 0 ? (
              asked.map((f) => (
                <div key={f.flag} className="ask" data-testid={`ask-${f.flag}`}>
                  <p>
                    {t('select.carriedFlagQuestion', 'Carried from an earlier quest: {flag}?', {
                      flag: flagWords(f.flag),
                    })}
                  </p>
                  <div className="yesno">
                    <button
                      className={answer(f.flag) ? 'btn' : 'btn alt'}
                      aria-pressed={answer(f.flag)}
                      onClick={() => setAnswers({ ...answers, [f.flag]: true })}
                    >
                      {t('select.yes', 'Yes')}
                    </button>
                    <button
                      className={answer(f.flag) ? 'btn alt' : 'btn'}
                      aria-pressed={!answer(f.flag)}
                      onClick={() => setAnswers({ ...answers, [f.flag]: false })}
                    >
                      {t('select.no', 'No')}
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="hint">
                {t(
                  'select.nothingToAsk',
                  'Nothing is carried over by the app. This quest asks nothing.',
                )}
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
            {resumed?.ok && (
              <div className="saved">
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
              </div>
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
          </section>

          <section className="card setup-col" aria-label={t('select.options', 'Options')}>
            <h2>{t('select.numberedOptions', '3 · Options')}</h2>
            <SettingsRows
              questId={quest.id}
              solo={quest.team?.solo === true}
              campaign={settingsCampaign}
            />
            <p className="hint">
              {mode === 'single'
                ? t('select.optionsKeptForTheQuest', 'Options are kept for this quest.')
                : t(
                    'select.optionsKeptForCampaign',
                    'Campaign options are kept for the whole campaign.',
                  )}
            </p>
          </section>
        </main>
        <footer className="setup-foot">
          <p className="hint" id="team-hint">
            {ready
              ? t('select.nHeroesPicked', 'Heroes: {count}. Pick 1 to 4.', { count: heroCount })
              : t('select.pick1To42', 'Pick 1 to 4 heroes to start the quest.')}
          </p>
          {exists && (
            <p className="hint" data-testid="replace-hint">
              {t(
                'select.startingReplacesTheSaved',
                'Starting replaces the saved game (turn {turn}). It cannot be brought back.',
                { turn },
              )}
            </p>
          )}
        </footer>
      </div>
    </>
  );
}
