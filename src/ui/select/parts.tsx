import type { ReactNode } from 'react';
import type { Level } from '../../engine/board/level';
import type { TeamMember } from '../../engine/data/team';
import type { Resumed } from '../../persist/saves';
import { t } from '../../i18n/t';

/** A quest that can be played from the lists: bundled (maybe an edited copy) or made on this device. */
export interface Playable {
  /** The id of the bundled quest (also for an edited copy), or the id of the quest made here. */
  readonly key: string;
  /** What is played: the edited copy when there is one. */
  readonly level: Level;
  /** The pack of the quest. Undefined for a quest made on this device. */
  readonly pack: string | undefined;
  /** The number on the quest. Undefined for a quest made on this device. */
  readonly number: number | undefined;
  /** The bundled slot, for the edited copies. */
  readonly slot: number | undefined;
  readonly edited: boolean;
}

/** "scepterDestroyed" read as "scepter destroyed". */
export const flagWords = (flag: string): string => flag.replace(/([A-Z])/g, ' $1').toLowerCase();

/** The chevron of the Back button. */
function Chevron() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12.5 4.5L7 10l5.5 5.5" />
    </svg>
  );
}

/**
 * The title band of a page of the start flow (concept): Home has the wordmark; every other page has the
 * square Back button and the title. `hint` sits on the title line, `subtitle` under it, buttons go right.
 */
export function PageHeader({
  title,
  hint,
  subtitle,
  subtitleTestId,
  onBack,
  children,
}: {
  title: string;
  hint?: ReactNode;
  subtitle?: string | undefined;
  subtitleTestId?: string | undefined;
  onBack?: (() => void) | undefined;
  children?: ReactNode;
}) {
  return (
    <header className="page-head">
      {onBack ? (
        <button
          className="back-btn"
          data-testid="back"
          aria-label={t('select.back', 'Back')}
          onClick={onBack}
        >
          <Chevron />
        </button>
      ) : (
        <span className="wordmark">{t('select.soloquest', 'SoloQuest')}</span>
      )}
      {(title || subtitle) && (
        <div className="head-titles">
          <div className="head-line">
            {title && <h1 title={title}>{title}</h1>}
            {hint && <span className="head-hint">{hint}</span>}
          </div>
          {subtitle && (
            <p className="head-sub" data-testid={subtitleTestId}>
              {subtitle}
            </p>
          )}
        </div>
      )}
      <span className="head-right">{children}</span>
    </header>
  );
}

/** The big square button of the start flow: a title, a caption and an optional tag. */
export function MenuButton({
  title,
  caption,
  tag,
  disabled,
  testId,
  onClick,
}: {
  title: string;
  caption?: string | undefined;
  tag?: string | undefined;
  disabled?: boolean | undefined;
  testId?: string | undefined;
  onClick(): void;
}) {
  return (
    <button className="menu-btn" disabled={disabled} data-testid={testId} onClick={onClick}>
      <span className="mb-text">
        <span className="mb-title">{title}</span>
        {caption && <span className="mb-cap">{caption}</span>}
      </span>
      {tag && <span className="qnote mb-tag">{tag}</span>}
    </button>
  );
}

/** What the select screen hands to the app when a game starts. */
export type StartChoice =
  | {
      kind: 'new';
      level: Level;
      team: readonly TeamMember[];
      /** Answers of "Before you start": they replace the carried flags the quest begins with. */
      flags?: Readonly<Record<string, boolean>>;
      /** The pack of the quest (an edited copy stays in the pack of the quest it copies). */
      pack: string | undefined;
      /** The id of the bundled quest, also for an edited copy. */
      questId: string;
      /** Set for a campaign game (decision 37). A single quest has none: it is a one-shot. */
      campaign?: {
        /** The campaign to play in. When the store has none with this id it is made now. */
        id: string;
        name: string;
        /** The campaign settings, used when the campaign is made now. */
        settings: Readonly<Record<string, boolean>>;
      };
    }
  | {
      kind: 'resume';
      level: Level;
      resumed: Extract<Resumed, { ok: true }>;
      questId: string;
      pack: string | undefined;
    };
