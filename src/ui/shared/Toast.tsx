import type { ReactNode } from 'react';
import { NoteCard } from './NoteCard';
import { t } from '../../i18n/t';

/**
 * Toasts are short. A long message is cut and gets a "More" button that opens it whole in a card, and
 * stays on the screen longer, so it can be read.
 */

/** A toast longer than this is cut. */
export const TOAST_LIMIT = 110;

/** How long a toast stays: 3.2 s for a short one, more for a long one (about 45 ms a letter), at most 9 s. */
export function toastMs(text: string, least = 3200): number {
  return Math.max(least, Math.min(9000, 3200 + Math.max(0, text.length - 40) * 45));
}

/** The text a toast shows: the message, or its first words and an ellipsis. */
export function toastText(text: string): string {
  if (text.length <= TOAST_LIMIT) return text;
  // cut at a space, so a word is not split
  const cut = text.slice(0, TOAST_LIMIT);
  const at = cut.lastIndexOf(' ');
  return `${(at > TOAST_LIMIT * 0.6 ? cut.slice(0, at) : cut).trimEnd()}…`;
}

export function ToastBox({
  text,
  onMore,
  children,
}: {
  text: string;
  /** Called with the whole message when the person asks for it. */
  onMore(text: string): void;
  children?: ReactNode;
}) {
  const long = text.length > TOAST_LIMIT;
  return (
    <div className="toast" role="status">
      {toastText(text)}
      {long && (
        <button data-testid="toast-more" onClick={() => onMore(text)}>
          {t('shared.Toast.more', 'More')}
        </button>
      )}
      {children}
    </div>
  );
}

/** A message that was too long for its toast, in full. */
export function FullMessage({ text, onClose }: { text: string; onClose(): void }) {
  return (
    <NoteCard kind="Message" title={t('shared.Toast.message', 'Message')} onClose={onClose}>
      <p data-testid="full-message">{text}</p>
      <button className="btn" onClick={onClose}>
        {t('shared.Toast.close', 'Close')}
      </button>
    </NoteCard>
  );
}
