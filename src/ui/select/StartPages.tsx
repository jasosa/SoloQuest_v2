import type { Resumed } from '../../persist/saves';
import { t } from '../../i18n/t';
import { MenuButton, PageHeader, type Playable } from './parts';

/** A pack in a list: its name, how many quests it lists and how many of them are encoded. */
export interface PackCard {
  readonly id: string;
  readonly name: string;
  readonly total: number;
  readonly encoded: number;
  readonly color: string;
}

/** The last saved game that can be opened, for "Continue your last game". */
export interface LastGame {
  readonly playable: Playable;
  readonly resumed: Extract<Resumed, { ok: true }>;
  /** The box of the quest, as the player reads it. */
  readonly box: string;
  /** The name of the campaign the game belongs to, if any. */
  readonly campaignName?: string | undefined;
  /** When the game was last saved (milliseconds). */
  readonly at: number;
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
  /** Campaign status, for the look of the tile. */
  readonly status?: 'done' | 'skipped' | 'next' | undefined;
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
          className={`qcard${q.status ? ` ${q.status}` : ''}`}
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
