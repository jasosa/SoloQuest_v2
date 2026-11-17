import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

/** The size of what is zoomed (the drawing and its padding), in layout px. */
export interface Content {
  readonly w: number;
  readonly h: number;
}
/** The play board: 26 x 19 squares of 34 px with a 2 px margin, and the map padding. */
export const PLAY_BOARD: Content = { w: 28 + 26 * 34 + 4, h: 18 + 19 * 34 + 4 };
/** How far the board can be zoomed in from its fitted size. */
export const ZOOM_MAX = 3;
export const ZOOM_STEP = 0.25;

/** The board as drawn now: `e` px of screen per px of the layer, and where its corner is. */
interface View {
  e: number;
  x: number;
  y: number;
}
interface Area {
  w: number;
  h: number;
}

/** The scale at which the whole board fits the map area (the 100% of the zoom chips). */
const baseOf = ({ w, h }: Area, c: Content): number => Math.max(0.3, Math.min(w / c.w, h / c.h));

const fitView = (a: Area, c: Content): View => {
  const e = baseOf(a, c);
  return { e, x: (a.w - e * c.w) / 2, y: (a.h - e * c.h) / 2 };
};

/** Keep the board covering the area when it is zoomed in, and centered when it is smaller. */
const clampView = (v: View, a: Area, c: Content): View => {
  const b = baseOf(a, c);
  const e = Math.min(b * ZOOM_MAX, Math.max(b, v.e));
  const cw = e * c.w;
  const ch = e * c.h;
  return {
    e,
    x: cw <= a.w ? (a.w - cw) / 2 : Math.min(0, Math.max(a.w - cw, v.x)),
    y: ch <= a.h ? (a.h - ch) / 2 : Math.min(0, Math.max(a.h - ch, v.y)),
  };
};

/** Zoom `v` to scale `e` keeping the point under (cx, cy) still. */
const zoomAt = (v: View, e: number, cx: number, cy: number, a: Area, c: Content): View => {
  const b = baseOf(a, c);
  const next = Math.min(b * ZOOM_MAX, Math.max(b, e));
  const k = next / v.e;
  return clampView({ e: next, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k }, a, c);
};

interface ZoomInfo {
  /** Where a point of the layer (map coordinates) lies on the map area now. */
  project(p: { x: number; y: number }): { x: number; y: number };
  /** The map area, in layout px. */
  area: Area;
}
const ZoomCtx = createContext<ZoomInfo>({ project: (p) => p, area: { w: 920, h: 770 } });

/** Margin notes use it to follow what they point at, and to stay inside the map area. */
export const useZoom = () => useContext(ZoomCtx);
export const useProject = () => useContext(ZoomCtx).project;

/**
 * The board in the map area: it is fitted to the area (as large as it can be), and zooms from
 * there. Pinch with two fingers, drag with one finger (zoomed in), the wheel with Ctrl, and the
 * − / + chips with the percent (100% is the fitted size). Only the board scales: margin notes keep
 * their size and follow the thing they point at (`useProject`).
 */
export function ZoomLayer({
  children,
  notes,
  content = PLAY_BOARD,
  className = 'map zoombox',
  padding = '18px 0 0 28px',
  onePointerPan = true,
  wheelPan = false,
}: {
  children: ReactNode;
  notes?: ReactNode;
  /** The size of what is zoomed: the play board by default. */
  content?: Content;
  className?: string;
  /** Padding of the layer inside its size (the map padding of the play board). */
  padding?: string;
  /** A finger on the board drags it when zoomed in. Off in the editor, where a drag moves things. */
  onePointerPan?: boolean;
  /** The wheel (without Ctrl) moves the board when zoomed in. */
  wheelPan?: boolean;
}) {
  const [area, setArea] = useState<Area>({ w: 920, h: 770 });
  // null: the board is fitted to the area, and follows it when the window changes
  const [picked, setPicked] = useState<View | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const clip = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ dist: number; v: View; mid: { x: number; y: number } } | null>(null);
  const pan = useRef<{ x: number; y: number; v: View; moved: boolean } | null>(null);
  const dragged = useRef(false);

  useLayoutEffect(() => {
    const el = clip.current;
    if (!el) return;
    const measure = () => setArea({ w: el.offsetWidth || 920, h: el.offsetHeight || 770 });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const view = picked ? clampView(picked, area, content) : fitView(area, content);
  const base = baseOf(area, content);
  const viewRef = useRef(view);
  // the handlers read the view as it is now
  useLayoutEffect(() => {
    viewRef.current = view;
  });

  /** Where the map area is on the screen, and the scale the whole app is drawn at (FitToScreen). */
  const screen = () => {
    const r = clip.current?.getBoundingClientRect();
    return {
      left: r?.left ?? 0,
      top: r?.top ?? 0,
      k: r && r.width && area.w ? r.width / area.w : 1,
    };
  };

  const step = (d: number) =>
    setPicked(
      zoomAt(
        viewRef.current,
        base * (viewRef.current.e / base + d),
        area.w / 2,
        area.h / 2,
        area,
        content,
      ),
    );

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) {
        // the wheel moves a board that is zoomed in
        if (!wheelPan || viewRef.current.e <= base * 1.001) return;
        e.preventDefault();
        const { k } = screen();
        const v = viewRef.current;
        setPicked(clampView({ ...v, x: v.x - e.deltaX / k, y: v.y - e.deltaY / k }, area, content));
        return;
      }
      e.preventDefault();
      const { left, top, k } = screen();
      setPicked(
        zoomAt(
          viewRef.current,
          viewRef.current.e * (e.deltaY < 0 ? 1.12 : 1 / 1.12),
          (e.clientX - left) / k,
          (e.clientY - top) / k,
          area,
          content,
        ),
      );
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [area, content, wheelPan, base]); // eslint-disable-line react-hooks/exhaustive-deps

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
        v: viewRef.current,
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      };
      pan.current = null;
      dragged.current = true;
    } else if (pointers.current.size === 1 && onePointerPan) {
      pan.current = { x: e.clientX, y: e.clientY, v: viewRef.current, moved: false };
      dragged.current = false;
    }
  };

  const move = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const { left, top, k } = screen();
    if (gesture.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()] as [
        { x: number; y: number },
        { x: number; y: number },
      ];
      const g = gesture.current;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const zoomed = zoomAt(
        g.v,
        g.v.e * (Math.hypot(a.x - b.x, a.y - b.y) / g.dist),
        (g.mid.x - left) / k,
        (g.mid.y - top) / k,
        area,
        content,
      );
      // the two fingers also drag the board
      setPicked(
        clampView(
          {
            ...zoomed,
            x: zoomed.x + (mid.x - g.mid.x) / k,
            y: zoomed.y + (mid.y - g.mid.y) / k,
          },
          area,
          content,
        ),
      );
      return;
    }
    const p = pan.current;
    if (p && pointers.current.size === 1 && p.v.e > base * 1.001) {
      const dx = (e.clientX - p.x) / k;
      const dy = (e.clientY - p.y) / k;
      if (!p.moved && Math.hypot(dx, dy) * k < 8) return;
      p.moved = true;
      dragged.current = true;
      setPicked(clampView({ ...p.v, x: p.v.x + dx, y: p.v.y + dy }, area, content));
    }
  };

  const up = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) gesture.current = null;
    if (pointers.current.size === 0) pan.current = null;
  };

  const info: ZoomInfo = {
    project: (p) => ({ x: view.x + view.e * p.x, y: view.y + view.e * p.y }),
    area,
  };

  const pct = Math.round((view.e / base) * 100);
  return (
    <ZoomCtx.Provider value={info}>
      <div
        ref={box}
        className={className}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        // a drag or pinch moved the board: the thing under the finger is not tapped or placed
        onPointerUpCapture={(e) => {
          if (dragged.current) e.stopPropagation();
        }}
        // a drag or pinch must not count as a tap on the board
        onClickCapture={(e) => {
          if (dragged.current) {
            e.stopPropagation();
            e.preventDefault();
            dragged.current = false;
          }
        }}
      >
        <div className="zoomclip" ref={clip}>
          <div
            className="zoomlayer"
            style={{
              padding,
              transformOrigin: '0 0',
              transform: `translate(${view.x}px, ${view.y}px) scale(${view.e})`,
            }}
          >
            {children}
          </div>
        </div>
        {notes}
        <div className="zoomctl" data-keep role="group" aria-label="Zoom">
          <button
            className="chip"
            aria-label="Zoom out"
            disabled={pct <= 100}
            onClick={() => step(-ZOOM_STEP)}
          >
            −
          </button>
          <button
            className="chip"
            aria-label="Zoom 100 percent"
            disabled={picked === null || pct === 100}
            data-testid="zoom-level"
            onClick={() => setPicked(null)}
          >
            {pct}%
          </button>
          <button
            className="chip"
            aria-label="Zoom in"
            disabled={pct >= ZOOM_MAX * 100}
            onClick={() => step(ZOOM_STEP)}
          >
            +
          </button>
        </div>
      </div>
    </ZoomCtx.Provider>
  );
}
