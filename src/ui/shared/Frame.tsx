import { useRef, type ReactNode } from 'react';
import { useModal } from './useModal';
import './frame.css';
import { t } from '../../i18n/t';
import { PageHeader } from '../select/parts';

/**
 * The building blocks of the Designer mockups (design/play-a/editor-mockups.html): the top bar with
 * its tabs, the three columns of panels, fields, toggles and the popup shell.
 */

export const EDITOR_TABS = ['Quest', 'Map', 'Actions', 'Monsters', 'Library'] as const;
export type EditorTab = (typeof EDITOR_TABS)[number];

/** The words of the tabs, read when drawn (the language is set at startup). */
export const editorTabLabel = (tab: string): string =>
  ({
    Quest: t('shared.Frame.tabQuest', 'Quest'),
    Map: t('shared.Frame.tabMap', 'Map'),
    Actions: t('shared.Frame.tabActions', 'Actions'),
    Monsters: t('shared.Frame.tabMonsters', 'Monsters'),
    Library: t('shared.Frame.tabLibrary', 'Library'),
  })[tab] ?? tab;

/**
 * The title band and the tabs of the editor and the Library (concept "editor"): the square Back button,
 * the title and a hint, the actions on the right, then the tabs as buttons with the extra actions at the end.
 */
export function TopBar({
  tabs,
  active,
  onTab,
  badges = {},
  title,
  hint,
  onBack,
  actions,
  children,
}: {
  tabs: readonly string[];
  active: string;
  onTab?(tab: string): void;
  /** A small count on a tab (the editor: letters that still need an action). */
  badges?: Readonly<Record<string, number>>;
  title: string;
  hint?: ReactNode;
  onBack(): void;
  /** The buttons on the right of the title. */
  actions?: ReactNode;
  /** The buttons at the end of the tab row. */
  children?: ReactNode;
}) {
  return (
    <>
      <PageHeader title={title} hint={hint} onBack={onBack}>
        {actions}
      </PageHeader>
      <div className="ed-tabrow">
        <div
          role="tablist"
          aria-label={t('shared.Frame.editor', 'Editor')}
          style={{ display: 'flex', gap: 10 }}
        >
          {tabs.map((tab) => (
            <button
              key={tab}
              role="tab"
              className="fr-tab"
              aria-selected={tab === active}
              onClick={() => onTab?.(tab)}
            >
              {editorTabLabel(tab)}
              {(badges[tab] ?? 0) > 0 && (
                <span className="ed-badge" data-testid="missing-count">
                  {badges[tab]}
                </span>
              )}
            </button>
          ))}
        </div>
        <span className="fr-sp">{children}</span>
      </div>
    </>
  );
}

export const Frame = ({
  children,
  narrow,
  numbered,
}: {
  children: ReactNode;
  narrow?: boolean;
  numbered?: boolean;
}) => (
  <div
    className={numbered ? 'fr-frame fr-numbered' : 'fr-frame'}
    style={narrow ? { gridTemplateColumns: '250px 1fr' } : undefined}
  >
    {children}
  </div>
);

export const Col = ({ children, label }: { children: ReactNode; label?: string }) => (
  <div className="fr-col" role={label ? 'group' : undefined} aria-label={label}>
    {children}
  </div>
);

export function Panel({
  title,
  children,
  testId,
  num,
  className,
}: {
  title: ReactNode;
  children: ReactNode;
  testId?: string;
  /** A numbered card of the Quest tab (the number is drawn by CSS). */
  num?: boolean;
  /** Extra class, for a screen that styles its own panels. */
  className?: string;
}) {
  return (
    <section
      className={['fr-panel', num ? 'fr-n' : '', className ?? ''].filter(Boolean).join(' ')}
      data-testid={testId}
    >
      <div className="fr-hd">{title}</div>
      <div className="fr-bd">{children}</div>
    </section>
  );
}

/** A panel whose body is a bare list (no padding), as the library lists of the mockup. */
export function ListPanel({
  title,
  children,
  testId,
  grow,
}: {
  title: ReactNode;
  children: ReactNode;
  testId?: string;
  /** Take the rest of the column: the list scrolls and the buttons below stay in view. */
  grow?: boolean;
}) {
  return (
    <section className={'fr-panel' + (grow ? ' grow' : '')} data-testid={testId}>
      <div className="fr-hd">{title}</div>
      <div className="fr-bd">{children}</div>
    </section>
  );
}

export const Fld = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="fr-fld">
    <span>{label}</span>
    {children}
  </label>
);

export function Toggle({
  label,
  on,
  onChange,
  disabled,
}: {
  label: string;
  on: boolean;
  onChange(next: boolean): void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      className="fr-tog"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
    >
      <i />
      {label}
    </button>
  );
}

export function Dialog({
  title,
  children,
  foot,
  wide = false,
  onClose,
}: {
  title: string;
  children: ReactNode;
  foot: ReactNode;
  /** A wider dialog, for content such as a picture preview. */
  wide?: boolean;
  /** What Escape does. Left out: Escape does nothing. */
  onClose?: (() => void) | undefined;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useModal(ref, { onEscape: onClose });
  return (
    <div className="fr-veil">
      <div
        className={wide ? 'fr-dlg wide' : 'fr-dlg'}
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="fr-dh">
          <h2>{title}</h2>
        </div>
        <div className="fr-db">{children}</div>
        <div className="fr-df">{foot}</div>
      </div>
    </div>
  );
}
