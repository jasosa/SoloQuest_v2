import { useRef, type ReactNode } from 'react';
import { useModal } from './useModal';

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
  /** One more class on the card, for a wider one. */
  className?: string;
  children: ReactNode;
}

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
  className,
  children,
}: NoteCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  useModal(ref, { onEscape: onClose, focus: focusTitle ? 'title' : 'first' });

  return (
    <div className={light ? 'veil light' : 'veil'} data-keep>
      <div
        className={className ? `note ${className}` : 'note'}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={ref}
      >
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
