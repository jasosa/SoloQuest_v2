import type { ReactNode } from 'react';
import './frame.css';

/**
 * The building blocks of the Designer mockups (design/play-a/editor-mockups.html): the top bar with
 * its tabs, the three columns of panels, fields, toggles and the popup shell.
 */

export const EDITOR_TABS = ['Quest', 'Map', 'Actions', 'Monsters', 'Library'] as const;
export type EditorTab = (typeof EDITOR_TABS)[number];

export function TopBar({
  tabs,
  active,
  onTab,
  badges = {},
  children,
}: {
  tabs: readonly string[];
  active: string;
  onTab?(tab: string): void;
  /** A small count on a tab (the editor: letters that still need an action). */
  badges?: Readonly<Record<string, number>>;
  /** The right side: status and links. */
  children?: ReactNode;
}) {
  return (
    <div className="fr-top">
      <span className="fr-ttl">Quest editor</span>
      <div role="tablist" aria-label="Editor" style={{ display: 'flex', gap: 6 }}>
        {tabs.map((t) => (
          <button
            key={t}
            role="tab"
            className="fr-tab"
            aria-selected={t === active}
            onClick={() => onTab?.(t)}
          >
            {t}
            {(badges[t] ?? 0) > 0 && (
              <span className="ed-badge" data-testid="missing-count">
                {badges[t]}
              </span>
            )}
          </button>
        ))}
      </div>
      <span className="fr-sp">{children}</span>
    </div>
  );
}

export const Frame = ({ children, narrow }: { children: ReactNode; narrow?: boolean }) => (
  <div className="fr-frame" style={narrow ? { gridTemplateColumns: '250px 1fr' } : undefined}>
    {children}
  </div>
);

export const Col = ({ children, label }: { children: ReactNode; label?: string }) => (
  <div className="fr-col" aria-label={label}>
    {children}
  </div>
);

export function Panel({
  title,
  children,
  testId,
}: {
  title: ReactNode;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <section className="fr-panel" data-testid={testId}>
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
}: {
  title: string;
  children: ReactNode;
  foot: ReactNode;
  /** A wider dialog, for content such as a picture preview. */
  wide?: boolean;
}) {
  return (
    <div className="fr-veil">
      <div
        className={wide ? 'fr-dlg wide' : 'fr-dlg'}
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
