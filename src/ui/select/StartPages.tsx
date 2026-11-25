import type { Resumed } from '../../persist/saves';
import type { Campaign } from '../../engine/pack/campaign';
import { t } from '../../i18n/t';
import { MenuButton, PageHeader, type Playable } from './parts';

/** A pack in a list: its name, how many quests it lists and how many of them are encoded. */
export interface PackCard {
  readonly id: string;
  readonly name: string;
  readonly total: number;
  readonly encoded: number;
}

/** The last saved game that can be opened, for "Continue your last game". */
export interface LastGame {
  readonly playable: Playable;
  readonly resumed: Extract<Resumed, { ok: true }>;
}

export function SettingsPage({
  textureName,
  languageName,
  onTextures,
  onTranslations,
  onBack,
}: {
  textureName: string | null | undefined;
  languageName: string | null | undefined;
  onTextures?: (() => void) | undefined;
  onTranslations?: (() => void) | undefined;
  onBack(): void;
}) {
  return (
    <>
      <PageHeader title={t('select.settings', 'Settings')} onBack={onBack} />
      <main className="stage narrow">
        {onTextures && (
          <MenuButton
            title={t('select.textures', 'Textures')}
            caption={textureName ?? t('select.builtInLook', 'Built-in look')}
            testId="textures-link"
            onClick={onTextures}
          />
        )}
        {onTranslations && (
          <MenuButton
            title={t('select.translations', 'Translations')}
            caption={languageName ?? t('select.english', 'English')}
            testId="translations-link"
            onClick={onTranslations}
          />
        )}
      </main>
    </>
  );
}

/** A grid of menu buttons, one per pack. */
export function PackGrid({
  cards,
  onPick,
}: {
  cards: readonly PackCard[];
  onPick(id: string): void;
}) {
  return (
    <div className="menu-grid">
      {cards.map((p) => (
        <MenuButton
          key={p.id}
          title={p.name}
          caption={
            p.encoded === 0
              ? t('select.notEncodedYet', 'Not encoded yet')
              : t('select.nQuests', '{count} quests', { count: p.total })
          }
          disabled={p.encoded === 0}
          testId={`pack-${p.id}`}
          onClick={() => onPick(p.id)}
        />
      ))}
    </div>
  );
}

/** One card of the quest grid. */
export interface QuestCardData {
  readonly slot: number;
  readonly number: number | undefined;
  /** Undefined: not encoded yet. */
  readonly playable: Playable | undefined;
  /** The small line under the title ("Done", "Next", "Saved game"). */
  readonly note?: string | undefined;
  readonly noteTestId?: string | undefined;
  readonly selected?: boolean | undefined;
}

export function QuestGrid({
  cards,
  onPick,
}: {
  cards: readonly QuestCardData[];
  onPick(card: QuestCardData): void;
}) {
  return (
    <div className="pick">
      {cards.map((q) => (
        <button
          key={q.slot}
          className="qcard"
          aria-pressed={q.selected === true}
          disabled={!q.playable}
          onClick={() => onPick(q)}
        >
          {q.number !== undefined && (
            <span className="qnum">
              {t('select.quest', 'Quest {number}', { number: q.number })}
            </span>
          )}
          {q.playable && <span className="qtitle">{q.playable.level.quest.title}</span>}
          {q.playable?.edited && <span className="qnote">{t('select.edited', 'Edited')}</span>}
          {q.note && (
            <span className="qnote" data-testid={q.noteTestId}>
              {q.note}
            </span>
          )}
          {!q.playable && (
            <span className="qnote">{t('select.notEncodedYet', 'Not encoded yet')}</span>
          )}
        </button>
      ))}
    </div>
  );
}

/** "Frozen Horror, 3 of 10 quests done": the caption of a saved campaign. */
export const campaignCaption = (c: Campaign, packName: string, total: number): string =>
  t('select.campaignCaption', '{packName}, {done} of {total} quests done', {
    packName,
    done: c.finished.length,
    total,
  });

export function CampaignPacksPage({
  cards,
  saved,
  onPack,
  onCampaign,
  onDeleteCampaign,
  onBack,
}: {
  cards: readonly PackCard[];
  saved: readonly { campaign: Campaign; caption: string; usable: boolean }[];
  onPack(id: string): void;
  onCampaign(id: string): void;
  /** For a campaign whose pack is not installed: it cannot be opened, only deleted. */
  onDeleteCampaign(id: string): void;
  onBack(): void;
}) {
  return (
    <>
      <PageHeader title={t('select.questPackCampaign', 'Quest Pack Campaign')} onBack={onBack} />
      <main className="stage">
        <div className="lbl">{t('select.selectAQuestPack', 'Select a quest pack')}</div>
        <PackGrid cards={cards} onPick={onPack} />
        <div className="lbl">{t('select.orContinueASaved', 'Or continue a saved campaign')}</div>
        {saved.length === 0 && (
          <p className="hint">{t('select.noSavedCampaignYet', 'No saved campaign yet.')}</p>
        )}
        <div className="menu-grid wide">
          {saved.map(({ campaign: c, caption, usable }) => (
            <div key={c.id}>
              <MenuButton
                title={c.name || t('select.campaign', 'Campaign')}
                caption={caption}
                disabled={!usable}
                testId={`campaign-${c.id}`}
                onClick={() => onCampaign(c.id)}
              />
              {!usable && (
                <button
                  className="link"
                  data-testid={`delete-campaign-${c.id}`}
                  onClick={() => onDeleteCampaign(c.id)}
                >
                  {t('select.deleteThisCampaign', 'Delete this campaign')}
                </button>
              )}
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
