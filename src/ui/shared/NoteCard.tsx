import { useEffect, useRef, type ReactNode } from 'react';

export interface NoteCardProps {
  /** The big letter chip (a quest note letter, or a monster code). */
  letter?: string | undefined;
  /** Small caps line above the title. */
  kind: string;
  title: string;
  /** Closing the card (Esc and the veil do nothing when `onClose` is missing: a choice must be answered). */
  onClose?: (() => void) | undefined;
  /** `light`: no dim veil, the map stays readable around the card (Zargon's turn). */
  light?: boolean;
  /** Focus the title instead of the first button, so a screen reader reads the card first. */
  focusTitle?: boolean;
  children: ReactNode;
}

/** Cards that are open, oldest first. Esc closes only the top one. */
const openCards: symbol[] = [];

/**
 * The note sheet of the prototype: a card in the middle of a dim veil. Used for quest notes,
 * choices, Zargon's turn and the end of the quest. The first button gets focus so Enter goes on.
 */
export function NoteCard({
  letter,
  kind,
  title,
  onClose,
  light,
  focusTitle,
  children,
}: NoteCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    const target = focusTitle
      ? root?.querySelector<HTMLElement>('h3')
      : root?.querySelector<HTMLElement>('button');
    target?.focus();
  }, [focusTitle]);
  useEffect(() => {
    const me = Symbol('card');
    openCards.push(me);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || openCards[openCards.length - 1] !== me) return;
      onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      openCards.splice(openCards.indexOf(me), 1);
    };
  }, [onClose]);

  return (
    <div className={light ? 'veil light' : 'veil'} data-keep>
      <div className="note" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="hd">
          {letter !== undefined && <span className="letter">{letter}</span>}
          <div>
            {kind}
            <h3 tabIndex={-1}>{title}</h3>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
