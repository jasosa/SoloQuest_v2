import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

/** The layer scales from the top left of the map area. */
const ORIGIN = { x: 0, y: 0 };
/** The layer: the board drawing (26 x 19 squares of 34 px, plus 2 px margin) and the map padding. */
const BOARD_W = 28 + 26 * 34 + 4;
const BOARD_H = 18 + 19 * 34 + 4;
export const ZOOM_MIN = 1;
export const ZOOM_MAX = 3;
export const ZOOM_STEP = 0.25;

interface View {
  s: number;
  tx: number;
  ty: number;
}
const NONE: View = { s: 1, tx: 0, ty: 0 };

type Project = (p: { x: number; y: number }) => { x: number; y: number };
const ZoomCtx = createContext<Project>((p) => p);

/** Where a point of the unzoomed map lies now. Margin notes use it to follow what they point at. */
export const useProject = () => useContext(ZoomCtx);

const clampView = (v: View, w: number, h: number): View => {
  const s = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v.s));
  // the board keeps covering the map area: no empty space beside it when zoomed in
  const tx = Math.min(0, Math.max(w - ORIGIN.x - s * BOARD_W, v.tx));
  const ty = Math.min(0, Math.max(h - ORIGIN.y - s * BOARD_H, v.ty));
  return { s, tx: s === 1 ? 0 : tx, ty: s === 1 ? 0 : ty };
};

/** Zoom `v` to `s` keeping the map point under (cx, cy) still. */
const zoomAt = (v: View, s: number, cx: number, cy: number, w: number, h: number): View => {
  const k = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, s)) / v.s;
  const px = cx - ORIGIN.x;
  const py = cy - ORIGIN.y;
  return clampView({ s: v.s * k, tx: px - (px - v.tx) * k, ty: py - (py - v.ty) * k }, w, h);
};

/**
 * Zoom and pan of the board: pinch with two fingers, drag with one finger (zoomed in), the wheel on
 * a computer, and the − / + buttons with the percent. Only the board scales: margin notes stay at
 * their normal size and follow the thing they point at (`useProject`).
 */
export function ZoomLayer({ children, notes }: { children: ReactNode; notes: ReactNode }) {
  const [view, setView] = useState<View>(NONE);
  const box = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ dist: number; v: View; mid: { x: number; y: number } } | null>(null);
  const pan = useRef<{ x: number; y: number; v: View; moved: boolean } | null>(null);
  const dragged = useRef(false);

  const size = () => {
    const r = box.current?.getBoundingClientRect();
    return { w: r?.width ?? 920, h: r?.height ?? 770, left: r?.left ?? 0, top: r?.top ?? 0 };
  };

  const step = (d: number) => {
    const { w, h } = size();
    setView((v) => zoomAt(v, v.s + d, w / 2, h / 2, w, h));
  };

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const { w, h, left, top } = size();
      setView((v) =>
        zoomAt(v, v.s * (e.deltaY < 0 ? 1.12 : 1 / 1.12), e.clientX - left, e.clientY - top, w, h),
      );
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const down = (e: React.PointerEvent) => {
    if ((e.target as Element).closest('[data-keep]')) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()] as [
        { x: number; y: number },
        { x: number; y: number },
      ];
      gesture.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        v: view,
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      };
      pan.current = null;
      dragged.current = true;
    } else if (pointers.current.size === 1) {
      pan.current = { x: e.clientX, y: e.clientY, v: view, moved: false };
      dragged.current = false;
    }
  };

  const move = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const { w, h, left, top } = size();
    if (gesture.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()] as [
        { x: number; y: number },
        { x: number; y: number },
      ];
      const g = gesture.current;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const zoomed = zoomAt(
        g.v,
        g.v.s * (Math.hypot(a.x - b.x, a.y - b.y) / g.dist),
        g.mid.x - left,
        g.mid.y - top,
        w,
        h,
      );
      // the two fingers also drag the board
      setView(
        clampView(
          { ...zoomed, tx: zoomed.tx + (mid.x - g.mid.x), ty: zoomed.ty + (mid.y - g.mid.y) },
          w,
          h,
        ),
      );
      return;
    }
    const p = pan.current;
    if (p && pointers.current.size === 1 && p.v.s > 1) {
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      if (!p.moved && Math.hypot(dx, dy) < 8) return;
      p.moved = true;
      dragged.current = true;
      setView(clampView({ ...p.v, tx: p.v.tx + dx, ty: p.v.ty + dy }, w, h));
    }
  };

  const up = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) gesture.current = null;
    if (pointers.current.size === 0) pan.current = null;
  };

  const project: Project = (p) =>
    view.s === 1
      ? p
      : {
          x: ORIGIN.x + view.tx + view.s * (p.x - ORIGIN.x),
          y: ORIGIN.y + view.ty + view.s * (p.y - ORIGIN.y),
        };

  const pct = Math.round(view.s * 100);
  return (
    <ZoomCtx.Provider value={project}>
      <div
        ref={box}
        className="map zoombox"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        // a drag or pinch must not count as a tap on the board
        onClickCapture={(e) => {
          if (dragged.current) {
            e.stopPropagation();
            e.preventDefault();
            dragged.current = false;
          }
        }}
      >
        <div className="zoomclip">
          <div
            className="zoomlayer"
            style={
              view.s === 1
                ? undefined
                : {
                    transformOrigin: '0 0',
                    transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.s})`,
                  }
            }
          >
            {children}
          </div>
        </div>
        {notes}
        <div className="zoomctl" data-keep role="group" aria-label="Zoom">
          <button
            className="chip"
            aria-label="Zoom out"
            disabled={view.s <= ZOOM_MIN}
            onClick={() => step(-ZOOM_STEP)}
          >
            −
          </button>
          <button
            className="chip"
            aria-label="Zoom 100 percent"
            disabled={view.s === 1}
            data-testid="zoom-level"
            onClick={() => setView(NONE)}
          >
            {pct}%
          </button>
          <button
            className="chip"
            aria-label="Zoom in"
            disabled={view.s >= ZOOM_MAX}
            onClick={() => step(ZOOM_STEP)}
          >
            +
          </button>
        </div>
      </div>
    </ZoomCtx.Provider>
  );
}
