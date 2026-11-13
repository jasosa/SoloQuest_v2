import { useEffect, useRef, type ReactNode } from 'react';

export interface NoteCardProps {
  /** The big letter chip (a quest note letter). */
  letter?: string | undefined;
  /** Small caps line above the title. */
  kind: string;
  title: string;
  /** Closing the card (Esc and the veil do nothing when `onClose` is missing: a choice must be answered). */
  onClose?: (() => void) | undefined;
  children: ReactNode;
}

/**
 * The note sheet of the prototype: a card in the middle of a dim veil. Used for quest notes,
 * choices and the end of the quest. The first button gets focus so Enter goes on.
 */
export function NoteCard({ letter, kind, title, onClose, children }: NoteCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('button')?.focus();
  }, []);
  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="veil" data-keep>
      <div className="note" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="hd">
          {letter !== undefined && <span className="letter">{letter}</span>}
          <div>
            {kind}
            <h3>{title}</h3>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
