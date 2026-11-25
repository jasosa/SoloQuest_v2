import { useState } from 'react';
import type { Campaign } from '../../engine/pack/campaign';
import { t } from '../../i18n/t';
import { dayLabel } from './CampaignOverview';
import { PageHeader } from './parts';
import type { PackCard } from './StartPages';

/** What the list shows about one saved campaign. */
export interface SavedCampaign {
  readonly campaign: Campaign;
  /** False when the pack of the campaign is not installed: it can only be deleted. */
  readonly usable: boolean;
  readonly packName: string;
  /** The quest ids of the pack, in order (empty when the pack is missing). */
  readonly quests: readonly string[];
  /** "Quest 2 · The Rescue of Sir Ragnar", or undefined when every quest is done or skipped. */
  readonly next: string | undefined;
  readonly nextInProgress: boolean;
  readonly heroes: string;
}

/** Campaigns: the saved ones with their progress, and the panel for a new one (concept "Campaigns"). */
export function CampaignsPage({
  saved,
  cards,
  nextName,
  onCampaign,
  onDeleteCampaign,
  onNew,
  onBack,
}: {
  saved: readonly SavedCampaign[];
  /** The boxes a campaign can be played in: owned and encoded. */
  cards: readonly PackCard[];
  /** The name a new campaign of a box gets unless the player types one ("Campaign 2"). */
  nextName(pack: string): string;
  onCampaign(id: string): void;
  onDeleteCampaign(id: string): void;
  onNew(pack: string, name: string): void;
  onBack(): void;
}) {
  const [pack, setPack] = useState<string | undefined>(cards[0]?.id);
  const [name, setName] = useState<string | undefined>();
  const shownName = name ?? (pack ? nextName(pack) : '');
  return (
    <>
      <PageHeader title={t('select.campaigns', 'Campaigns')} onBack={onBack}>
        <span className="hint head-hint">
          {t(
            'select.aBoxPlayedInOrder',
            'A box played in order. Skip or replay whenever you like.',
          )}
        </span>
      </PageHeader>
      <main className="stage campaigns-page">
        <div className="camp-list">
          {saved.length === 0 && (
            <p className="hint">{t('select.noSavedCampaignYet', 'No saved campaign yet.')}</p>
          )}
          {saved.map((s) => {
            const c = s.campaign;
            const last = c.journal[c.journal.length - 1];
            return (
              <div key={c.id} className="camp-row-wrap">
                <button
                  className="camp-row"
                  disabled={!s.usable}
                  data-testid={`campaign-${c.id}`}
                  onClick={() => onCampaign(c.id)}
                >
                  <span className="camp-row-head">
                    <span className="camp-name">{c.name || t('select.campaign', 'Campaign')}</span>
                    <span className="camp-pack">{s.packName}</span>
                    {last && <span className="camp-date">{dayLabel(last.at)}</span>}
                  </span>
                  <span className="segs" aria-hidden="true">
                    {s.quests.map((q) => (
                      <span
                        key={q}
                        className={`seg${
                          c.finished.includes(q) ? ' done' : c.skipped.includes(q) ? ' skipped' : ''
                        }`}
                      />
                    ))}
                  </span>
                  <span className="camp-next">
                    {s.usable
                      ? s.next
                        ? t('select.nextLine', 'Next: {quest}{progress}', {
                            quest: s.next,
                            progress: s.nextInProgress
                              ? ` ${t('select.inProgressParen', '(in progress)')}`
                              : '',
                          })
                        : t('select.everyQuestDoneOrSkipped', 'Every quest is done or skipped.')
                      : t('select.packNotInstalled', 'The pack {pack} is not installed.', {
                          pack: c.pack,
                        })}
                    {s.heroes && <span className="camp-heroes"> {s.heroes}</span>}
                  </span>
                </button>
                {!s.usable && (
                  <button
                    className="link"
                    data-testid={`delete-campaign-${c.id}`}
                    onClick={() => onDeleteCampaign(c.id)}
                  >
                    {t('select.deleteThisCampaign', 'Delete this campaign')}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <aside className="detail new-campaign">
          <h2>{t('select.newCampaign', 'New campaign')}</h2>
          <div className="lbl">{t('select.box', 'Box')}</div>
          <div className="box-list">
            {cards.map((p) => (
              <button
                key={p.id}
                className="box-pick"
                aria-pressed={p.id === pack}
                data-testid={`pack-${p.id}`}
                onClick={() => {
                  setPack(p.id);
                  setName(undefined);
                }}
              >
                <span className="box-name">{p.name}</span>
              </button>
            ))}
          </div>
          <label className="lbl" htmlFor="campaign-name">
            {t('select.name', 'Name')}
          </label>
          <input
            id="campaign-name"
            className="field"
            data-testid="campaign-name"
            value={shownName}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            className="btn"
            data-testid="new-campaign-heroes"
            disabled={!pack}
            onClick={() => pack && onNew(pack, shownName.trim() || nextName(pack))}
          >
            {t('select.chooseHeroes', 'Choose heroes')}
          </button>
        </aside>
      </main>
    </>
  );
}
