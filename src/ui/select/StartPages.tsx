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

export function HomePage({
  last,
  notice,
  orphans,
  onSingle,
  onCampaign,
  onContinue,
  onSettings,
  onEditor,
  onDeleteOrphan,
}: {
  /** `undefined` while it is being looked for, `null` when there is none. */
  last: LastGame | null | undefined;
  notice: string | undefined;
  orphans: readonly { questId: string; message: string }[];
  onSingle(): void;
  onCampaign(): void;
  onContinue(): void;
  onSettings(): void;
  onEditor?: (() => void) | undefined;
  onDeleteOrphan(questId: string): void;
}) {
  return (
    <>
      <PageHeader title={t('select.home', 'Home')}>
        {onEditor && (
          <button className="link" onClick={onEditor}>
            {t('select.questEditor', 'Quest editor')}
          </button>
        )}
      </PageHeader>
      <main className="stage narrow">
        <MenuButton
          title={t('select.singleQuest', 'Single Quest')}
          caption={t('select.playASingleQuest', 'Play a single quest')}
          testId="home-single"
          onClick={onSingle}
        />
        <MenuButton
          title={t('select.questPackCampaign', 'Quest Pack Campaign')}
          caption={t(
            'select.chooseAQuestPack',
            'Choose a quest pack and play all missions in order',
          )}
          testId="home-campaign"
          onClick={onCampaign}
        />
        <MenuButton
          title={t('select.continueYourLastGame', 'Continue your last game')}
          caption={
            last
              ? last.playable.number === undefined
                ? t('select.lastGameOther', '{title}, turn {turn}', {
                    title: last.playable.level.quest.title,
                    turn: last.resumed.state.turn,
                  })
                : t('select.lastGame', 'Quest {number}, {title}, turn {turn}', {
                    number: last.playable.number,
                    title: last.playable.level.quest.title,
                    turn: last.resumed.state.turn,
                  })
              : t('select.noSavedGameYet', 'No saved game yet.')
          }
          disabled={!last}
          testId="home-continue"
          onClick={onContinue}
        />
        <MenuButton
          title={t('select.settings', 'Settings')}
          caption={t('select.texturesTranslations', 'Textures, translations')}
          testId="home-settings"
          onClick={onSettings}
        />
        {notice && (
          <p className="hint" role="alert">
            {notice}
          </p>
        )}
        {orphans.map((o) => (
          <p key={o.questId} className="hint orphan" role="status" data-testid="orphan-save">
            {o.message}{' '}
            <button className="link" onClick={() => onDeleteOrphan(o.questId)}>
              {t('select.deleteTheSave', 'Delete the save')}
            </button>
          </p>
        ))}
      </main>
    </>
  );
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

export function SinglePacksPage({
  cards,
  others,
  onPack,
  onOther,
  onBack,
}: {
  cards: readonly PackCard[];
  others: readonly Playable[];
  onPack(id: string): void;
  onOther(key: string): void;
  onBack(): void;
}) {
  return (
    <>
      <PageHeader title={t('select.singleQuest', 'Single Quest')} onBack={onBack} />
      <main className="stage">
        <div className="lbl">{t('select.questPacks', 'Quest packs')}</div>
        <PackGrid cards={cards} onPick={onPack} />
        <div className="lbl">{t('select.otherMissions', 'Other missions')}</div>
        {others.length === 0 && (
          <p className="hint">
            {t('select.questsYouMakeIn', 'Quests you make in the editor are listed here.')}
          </p>
        )}
        <div className="menu-grid">
          {others.map((o) => (
            <MenuButton
              key={o.key}
              title={o.level.quest.title}
              caption={t('select.madeOnThisDevice', 'Made on this device')}
              testId={`other-${o.key}`}
              onClick={() => onOther(o.key)}
            />
          ))}
        </div>
      </main>
    </>
  );
}

/** One card of the quest grid. */
export interface QuestCardData {
  readonly slot: number;
  readonly number: number;
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
          <span className="qnum">{t('select.quest', 'Quest {number}', { number: q.number })}</span>
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

export function SingleQuestsPage({
  title,
  cards,
  onPick,
  onBack,
}: {
  title: string;
  cards: readonly QuestCardData[];
  onPick(card: QuestCardData): void;
  onBack(): void;
}) {
  return (
    <>
      <PageHeader title={title} onBack={onBack} />
      <main className="stage">
        <p className="hint">{t('select.selectTheQuestToPlay', 'Select the quest to play.')}</p>
        <QuestGrid cards={cards} onPick={onPick} />
      </main>
    </>
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
  onBack,
}: {
  cards: readonly PackCard[];
  saved: readonly { campaign: Campaign; caption: string; usable: boolean }[];
  onPack(id: string): void;
  onCampaign(id: string): void;
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
            <MenuButton
              key={c.id}
              title={c.name || t('select.campaign', 'Campaign')}
              caption={caption}
              disabled={!usable}
              testId={`campaign-${c.id}`}
              onClick={() => onCampaign(c.id)}
            />
          ))}
        </div>
      </main>
    </>
  );
}
