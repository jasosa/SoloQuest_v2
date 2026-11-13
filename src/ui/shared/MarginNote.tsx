import { useEffect, type ReactNode } from 'react';

/** Size of the map area the note is placed in (the left grid cell of the play screen). */
export const MAP_W = 920;
export const MAP_H = 770;
const NOTE_W = 252;
/** The tallest margin note (a monster with wound and heal) stays below this. */
const SLOT_H = 280;

export interface MarginNoteProps {
  /** The tapped object, in map coordinates (px from the top left of the map area). */
  anchor: { x: number; y: number };
  kind: string;
  title: string;
  onClose(): void;
  children: ReactNode;
}

/**
 * A note that grows from the tapped object. In the upper half of the map it sits beside the
 * object, in the lower half above it, so the explored area near the heroes stays visible.
 * Closes with the x button or Esc (a tap outside is handled by the screen).
 */
export function MarginNote({ anchor, kind, title, onClose, children }: MarginNoteProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const { x, y } = anchor;
  const above = y > MAP_H * 0.5;
  let style: React.CSSProperties;
  let origin: { ox: string; oy: string };
  if (above) {
    const left = Math.max(28, Math.min(x - 60, MAP_W - NOTE_W - 4));
    style = { left, bottom: MAP_H - y + 24 };
    origin = { ox: `${x - left}px`, oy: '100%' };
  } else {
    let left = x + 26;
    let ox = '0';
    if (left + NOTE_W > MAP_W - 4) {
      left = x - 26 - NOTE_W;
      ox = '100%';
    }
    const top = Math.max(8, Math.min(y - SLOT_H / 2, MAP_H - SLOT_H - 8));
    style = { left, top, height: SLOT_H };
    origin = { ox, oy: `${y - top - 0}px` };
  }

  return (
    <div className={`note-slot ${above ? 'above' : 'beside'}`} style={style}>
      <div
        className="callout"
        role="dialog"
        aria-label={title}
        data-keep
        style={{ '--ox': origin.ox, '--oy': above ? origin.oy : '50%' } as React.CSSProperties}
      >
        <button className="close" aria-label="Close" onClick={onClose}>
          ×
        </button>
        <div className="kind">{kind}</div>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
}
