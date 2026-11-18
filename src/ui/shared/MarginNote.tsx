import { useRef, type ReactNode } from 'react';
import { useModal } from './useModal';
import { useZoom } from '../play/ZoomLayer';

/** Size of the map area the note is placed in (the left grid cell of the play screen). */
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
  // not modal: it only takes part in the Escape stack, so Esc closes the top dialog first
  const ref = useRef<HTMLDivElement>(null);
  useModal(ref, { onEscape: onClose, trap: false, focus: 'none', restore: false });

  // the thing it points at may have moved with the zoom
  const { project, area } = useZoom();
  const MAP_W = area.w;
  const MAP_H = area.h;
  const { x, y } = project(anchor);
  const above = y > MAP_H * 0.5;
  let style: React.CSSProperties;
  let origin: { ox: string; oy: string };
  // a tall note never goes past the map: it takes the room there is and scrolls inside
  let maxHeight: number;
  if (above) {
    const left = Math.max(28, Math.min(x - 60, MAP_W - NOTE_W - 4));
    style = { left, bottom: MAP_H - y + 24 };
    maxHeight = Math.max(160, y - 24 - 8);
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
    maxHeight = Math.max(160, MAP_H - top - 8);
    origin = { ox, oy: `${y - top - 0}px` };
  }

  return (
    <div className={`note-slot ${above ? 'above' : 'beside'}`} style={style}>
      <div
        className="callout"
        ref={ref}
        role="dialog"
        aria-label={title}
        data-keep
        style={
          {
            '--ox': origin.ox,
            '--oy': above ? origin.oy : '50%',
            maxHeight,
            overflowY: 'auto',
          } as React.CSSProperties
        }
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
