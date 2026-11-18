import {
  createContext,
  useContext,
  useEffect,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';

/** The size every screen is drawn at (the tablet it is made for). */
export const DESIGN_W = 1194;
export const DESIGN_H = 834;
/** Never blow it up more than this on a large screen. */
const MAX_SCALE = 1.5;

/**
 * How a screen fits the window. `contain`: the whole screen is shrunk until it fits (the play
 * screen, where the board must stay in one piece). `width`: the screen fills the width and the page
 * scrolls down when the window is shorter (select, editor, Designer), so nothing gets too small.
 */
export type FitMode = 'contain' | 'width' | 'fill';

/** The smallest the play screen is drawn at before the whole screen starts to shrink. */
const FILL_MIN_W = 1000;
const FILL_MIN_H = 600;

/** The height the screen is drawn at: the window's, on the play screen. */
export function drawnHeight(width: number, height: number, mode: FitMode = 'contain'): number {
  if (mode !== 'fill' || width <= 0 || height <= 0) return DESIGN_H;
  return Math.max(FILL_MIN_H, Math.floor(height / fitScale(width, height, mode)));
}

/**
 * The width the screen is drawn at. It is the design width, except on the play screen in a window
 * that is wider than the tablet: the screen then keeps its height and gets the extra width (the
 * right column takes it), so there is no empty strip left and right.
 */
export function drawnWidth(width: number, height: number, mode: FitMode = 'contain'): number {
  if (mode === 'width' || width <= 0 || height <= 0) return DESIGN_W;
  if (mode === 'fill')
    return Math.max(FILL_MIN_W, Math.floor(width / fitScale(width, height, mode)));
  const k = fitScale(width, height, mode);
  return Math.max(DESIGN_W, Math.floor(width / k));
}

/** The scale for a window of this size. */
export function fitScale(width: number, height: number, mode: FitMode = 'contain'): number {
  if (width <= 0 || height <= 0) return 1;
  if (mode === 'fill') return Math.min(1, width / FILL_MIN_W, height / FILL_MIN_H);
  const byWidth = width / DESIGN_W;
  // Select, editor and Library shrink on a window narrower than the tablet but are never blown up: on a
  // big window their text would be 1.5 times bigger than on the play screen, which is never scaled up.
  return mode === 'width' ? Math.min(1, byWidth) : Math.min(MAX_SCALE, byWidth, height / DESIGN_H);
}

function windowSize(): { w: number; h: number } {
  const v = window.visualViewport;
  return { w: v?.width ?? window.innerWidth, h: v?.height ?? window.innerHeight };
}

const FitModeCtx = createContext<Dispatch<SetStateAction<FitMode>>>(() => undefined);

/** A screen says how it wants to fit while it is shown. Play is `contain`, the default. */
export function useFitMode(mode: FitMode): void {
  const set = useContext(FitModeCtx);
  useEffect(() => {
    set(mode);
    return () => set('contain');
  }, [mode, set]);
}

/**
 * Draws the app at its design size and scales it to the window. On a tablet the browser bars take
 * some of the height, so without this the bottom of a screen (a Start button) is cut off.
 */
export function FitToScreen({ children }: { children: ReactNode }) {
  const [size, setSize] = useState(windowSize);
  const [mode, setMode] = useState<FitMode>('contain');
  useEffect(() => {
    const on = () => setSize(windowSize());
    window.addEventListener('resize', on);
    window.visualViewport?.addEventListener('resize', on);
    return () => {
      window.removeEventListener('resize', on);
      window.visualViewport?.removeEventListener('resize', on);
    };
  }, []);
  const k = fitScale(size.w, size.h, mode);
  const W = drawnWidth(size.w, size.h, mode);
  const H = drawnHeight(size.w, size.h, mode);
  const drawn = {
    width: W,
    '--app-w': `${W}px`,
    '--app-h': `${H}px`,
    height: H,
    transformOrigin: '0 0',
    transform: k === 1 ? undefined : `scale(${k})`,
  } as React.CSSProperties;

  // One tree for both modes, only the styles change: switching mode must not remount the screen.
  return (
    <FitModeCtx.Provider value={setMode}>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          overflowX: 'hidden',
          overflowY: mode === 'width' ? 'auto' : 'hidden',
        }}
        data-fit-scale={k.toFixed(3)}
        data-fit-mode={mode}
      >
        <div
          style={
            mode === 'width'
              ? {
                  position: 'relative',
                  width: W * k,
                  height: H * k,
                  margin: '0 auto',
                }
              : {
                  position: 'absolute',
                  left: (size.w - W * k) / 2,
                  top: (size.h - H * k) / 2,
                  width: W * k,
                  height: H * k,
                }
          }
        >
          <div style={drawn}>{children}</div>
        </div>
      </div>
    </FitModeCtx.Provider>
  );
}
