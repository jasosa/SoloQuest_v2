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

/**
 * The campaign overview: the quests of the pack in order with their status, who fell, what was carried
 * on, and the ways on: play the next quest, change the settings, start another campaign, delete this one.
 * Only what the engine keeps is shown: finished quests, flags, the team and who fell (decision 37).
 */
export function CampaignOverview({
  campaign,
  manifest,
  playables,
  savedHere,
  campaigns,
  onQuest,
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
  onNewCampaign(): void;
  onDelete(): void;
  onBack(): void;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const next = nextQuest(manifest, campaign);
  const total = manifest.quests.length;
  const team = normalizeTeam(campaign.team as TeamInput[]);
  const heroes = team.map((m) => labelOf(team, m.id));
  const fell = campaign.fallen.map((id) => labelOf(team, id));
  const carried = Object.entries(campaign.flags)
    .filter(([, on]) => on)
    .map(([flag]) => flagWords(flag));

  const cards: QuestCardData[] = manifest.quests.map((id, i) => {
    const p = playables.get(id);
    const done = campaign.finished.includes(id);
    const note = done
      ? t('select.done', 'Done')
      : savedHere.has(id)
        ? t('select.savedGame', 'Saved game')
        : id === next
          ? t('select.next', 'Next')
          : undefined;
    return {
      slot: i,
      number: p?.number ?? i + 1,
      playable: p,
      note,
      noteTestId: done ? 'quest-done' : undefined,
      selected: id === next,
    };
  });

  return (
    <>
      <PageHeader title={campaign.name || t('select.campaign', 'Campaign')} onBack={onBack} />
      <div className="pickcol">
        <p className="hint stage-hint">
          {t('select.selectTheQuestToPlay', 'Select the quest to play.')}
        </p>
        <QuestGrid cards={cards} onPick={(c) => onQuest(manifest.quests[c.slot]!)} />
      </div>
      <aside className="side">
        <section>
          <div className="lbl">{packLabel(manifest)}</div>
          <p className="hint" data-testid="campaign-progress">
            {t('select.nOfQuestsDone', '{done} of {total} quests done', {
              done: campaign.finished.length,
              total,
            })}
          </p>
          <p className="hint">
            {heroes.length > 0
              ? t('select.heroesList', 'Heroes: {heroes}', { heroes: heroes.join(', ') })
              : t('select.noHeroesYet', 'No heroes yet.')}
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
        </section>
        <div className="actions">
          {next && playables.has(next) && (
            <button className="btn" data-testid="play-next" onClick={() => onQuest(next)}>
              {t('select.playTheNextQuest', 'Play the next quest')}
            </button>
          )}
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
      </aside>

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
