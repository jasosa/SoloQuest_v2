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

/** The title band of a page of the start flow: Back, the title, links on the right. */
export function PageHeader({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack?: (() => void) | undefined;
  children?: ReactNode;
}) {
  return (
    <header>
      {onBack && (
        <button className="link" data-testid="back" onClick={onBack}>
          {t('select.back', 'Back')}
        </button>
      )}
      <span className="qn">{t('select.soloquest', 'SoloQuest')}</span>
      {title && <h1>{title}</h1>}
      <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>{children}</span>
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
