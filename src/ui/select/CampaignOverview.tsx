import { useState } from 'react';
import { labelOf, normalizeTeam, type TeamInput } from '../../engine/data/team';
import { nextQuest, type Campaign } from '../../engine/pack/campaign';
import type { PackManifest } from '../../engine/pack/schema';
import type { CampaignStore } from '../../persist/campaigns';
import { packLabel } from '../packs';
import { Dialog } from '../shared/Frame';
import { QuestSettingsCard } from '../shared/QuestSettingsCard';
import { t } from '../../i18n/t';
import { PageHeader, type Playable } from './parts';
import { QuestGrid, type QuestCardData } from './StartPages';

/** "scepterDestroyed" read as "scepter destroyed". */
const flagWords = (flag: string): string => flag.replace(/([A-Z])/g, ' $1').toLowerCase();

/** "12 Nov": the day of a journal line. */
export const dayLabel = (at: number): string =>
  new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/**
 * The campaign page (concept "Campaign detail"): the quests of the pack in order with their status,
 * the heroes, the journal, and the way on for the quest picked: play it or skip it. Only what the engine
 * keeps is shown: finished and skipped quests, flags, the team, who fell and the journal (decisions 37, 101).
 */
export function CampaignOverview({
  campaign,
  manifest,
  playables,
  savedHere,
  campaigns,
  onQuest,
  onSkip,
  onNewCampaign,
  onDelete,
  onBack,
}: {
  campaign: Campaign;
  manifest: PackManifest;
  /** The quests of the pack that are encoded, by quest id. */
  playables: ReadonlyMap<string, Playable>;
  /** The ids of the quests that have a saved game of this campaign. */
  savedHere: ReadonlySet<string>;
  campaigns: CampaignStore;
  onQuest(questId: string): void;
  onSkip(questId: string): void;
  onNewCampaign(): void;
  onDelete(): void;
  onBack(): void;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const next = nextQuest(manifest, campaign);
  const [picked, setPicked] = useState<string | undefined>();
  const total = manifest.quests.length;
  const team = normalizeTeam(campaign.team as TeamInput[]);
  const heroes = team.map((m) => labelOf(team, m.id));
  const fell = campaign.fallen.map((id) => labelOf(team, id));
  const carried = Object.entries(campaign.flags)
    .filter(([, on]) => on)
    .map(([flag]) => flagWords(flag));
  const numberOf = (id: string) => playables.get(id)?.number ?? manifest.quests.indexOf(id) + 1;

  const current = picked && manifest.quests.includes(picked) ? picked : next;
  const cards: QuestCardData[] = manifest.quests.map((id, i) => {
    const p = playables.get(id);
    const done = campaign.finished.includes(id);
    const skipped = !done && campaign.skipped.includes(id);
    const note = done
      ? t('select.done', 'Done')
      : skipped
        ? t('select.skipped', 'Skipped')
        : savedHere.has(id)
          ? t('select.savedGame', 'Saved game')
          : id === next
            ? t('select.next', 'Next')
            : undefined;
    return {
      slot: i,
      number: numberOf(id),
      playable: p,
      note,
      noteTestId: done ? 'quest-done' : undefined,
      selected: id === current,
      status: done ? 'done' : skipped ? 'skipped' : id === next ? 'next' : undefined,
    };
  });
  const cur = current ? playables.get(current) : undefined;
  const curDone = current ? campaign.finished.includes(current) : false;
  const curSkipped = current ? campaign.skipped.includes(current) : false;
  const curStatus = !current
    ? ''
    : curDone
      ? t('select.done', 'Done')
      : curSkipped
        ? t('select.skipped', 'Skipped')
        : current === next
          ? t('select.next', 'Next')
          : '';
  const journal = [...campaign.journal].reverse();
  const changeFor = current ?? next;

  return (
    <>
      <PageHeader title={campaign.name || t('select.campaign', 'Campaign')} onBack={onBack}>
        <span className="hint head-hint" data-testid="campaign-progress">
          {packLabel(manifest)} ·{' '}
          {t('select.nOfQuestsDone', '{done} of {total} quests done', {
            done: campaign.finished.length,
            total,
          })}
        </span>
      </PageHeader>
      <main className="stage campaign-page">
        <div className="camp-main">
          <QuestGrid cards={cards} onPick={(c) => setPicked(manifest.quests[c.slot])} />
          {current && cur && (
            <section className="camp-panel" data-testid="camp-panel">
              <div className="camp-panel-text">
                <div className="lbl">
                  {curStatus
                    ? t('select.questStatus', 'Quest {number} · {status}', {
                        number: numberOf(current),
                        status: curStatus,
                      })
                    : t('select.questN', 'Quest {number}', { number: numberOf(current) })}
                </div>
                <h2>{cur.level.quest.title}</h2>
                <p className="summary">{cur.level.quest.intro.summary}</p>
              </div>
              <div className="camp-panel-btns">
                {!curDone && !curSkipped && (
                  <button
                    className="btn alt"
                    data-testid="skip-quest"
                    onClick={() => onSkip(current)}
                  >
                    {t('select.skip', 'Skip')}
                  </button>
                )}
                <button className="btn" data-testid="play-next" onClick={() => onQuest(current)}>
                  {curDone ? t('select.playAgain', 'Play again') : t('select.play', 'Play')}
                </button>
              </div>
            </section>
          )}
          {!current && (
            <p className="hint" data-testid="camp-all-done">
              {t('select.everyQuestDoneOrSkipped', 'Every quest is done or skipped.')}
            </p>
          )}
          <div className="camp-links">
            {manifest.campaignSettings.length > 0 && (
              <button
                className="btn alt"
                data-testid="campaign-settings"
                onClick={() => setSettingsOpen(true)}
              >
                {t('select.campaignSettings', 'Campaign settings')}
              </button>
            )}
            <button className="btn alt" data-testid="new-campaign" onClick={onNewCampaign}>
              {t('select.startANewCampaign', 'Start a new campaign')}
            </button>
            <button
              className="link"
              data-testid="delete-campaign"
              onClick={() => setConfirmDelete(true)}
            >
              {t('select.deleteThisCampaign', 'Delete this campaign')}
            </button>
          </div>
        </div>
        <aside className="camp-side">
          <section className="card">
            <div className="card-head">
              <h2>{t('select.heroes', 'Heroes')}</h2>
              {changeFor && (
                <button
                  className="link"
                  data-testid="change-heroes"
                  onClick={() => onQuest(changeFor)}
                >
                  {t('select.change', 'Change')}
                </button>
              )}
            </div>
            <p>
              {heroes.length > 0 ? heroes.join(' · ') : t('select.noHeroesYet', 'No heroes yet.')}
            </p>
            {fell.length > 0 && (
              <p className="team-warn" role="note" data-testid="campaign-fell">
                {t('select.fellInTheLastQuest', 'Fell in the last quest: {heroes}', {
                  heroes: fell.join(', '),
                })}
              </p>
            )}
            {carried.length > 0 && (
              <p className="hint">
                {t('select.carriedOn', 'Carried on: {flags}', { flags: carried.join(', ') })}
              </p>
            )}
            <p className="hint">
              {t(
                'select.theAppKeepsOnlyWho',
                'The app keeps only who plays. Gold and items stay on your sheets.',
              )}
            </p>
          </section>
          <section className="card journal">
            <h2>{t('select.journal', 'Journal')}</h2>
            {journal.length === 0 && (
              <p className="hint">{t('select.nothingYet', 'Nothing yet.')}</p>
            )}
            <ul>
              {journal.map((j, i) => (
                <li key={`${j.at}-${i}`}>
                  <span className="hint">
                    {dayLabel(j.at)} ·{' '}
                    {t('select.questN', 'Quest {number}', { number: numberOf(j.quest) })}
                  </span>
                  <span>
                    {j.result === 'won'
                      ? t('select.won', 'Won.')
                      : t('select.skippedDot', 'Skipped.')}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </main>

      {settingsOpen && (
        <QuestSettingsCard
          questId={manifest.quests[0] ?? ''}
          title={campaign.name || packLabel(manifest)}
          campaignOnly
          campaign={{ store: campaigns, pack: manifest, campaignId: campaign.id }}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {confirmDelete && (
        <Dialog
          title={t('select.deleteThisCampaign', 'Delete this campaign')}
          onClose={() => setConfirmDelete(false)}
          foot={
            <>
              <button className="btn alt" autoFocus onClick={() => setConfirmDelete(false)}>
                {t('select.keepIt', 'Keep it')}
              </button>
              <button
                className="btn"
                data-testid="confirm-delete"
                onClick={() => {
                  setConfirmDelete(false);
                  onDelete();
                }}
              >
                {t('select.deleteThisCampaign', 'Delete this campaign')}
              </button>
            </>
          }
        >
          <p>
            {t(
              'select.thisForgetsTheFinished2',
              'This forgets the finished quests, the carried flags, the heroes, the settings and the saved games of this campaign. It cannot be brought back.',
            )}
          </p>
        </Dialog>
      )}
    </>
  );
}
