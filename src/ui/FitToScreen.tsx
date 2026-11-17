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
export type FitMode = 'contain' | 'width';

/** The scale for a window of this size. */
export function fitScale(width: number, height: number, mode: FitMode = 'contain'): number {
  if (width <= 0 || height <= 0) return 1;
  const byWidth = width / DESIGN_W;
  return mode === 'width'
    ? Math.min(MAX_SCALE, byWidth)
    : Math.min(MAX_SCALE, byWidth, height / DESIGN_H);
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
  const drawn = {
    width: DESIGN_W,
    height: DESIGN_H,
    transformOrigin: '0 0',
    transform: k === 1 ? undefined : `scale(${k})`,
  } as const;

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
                  width: DESIGN_W * k,
                  height: DESIGN_H * k,
                  margin: '0 auto',
                }
              : {
                  position: 'absolute',
                  left: (size.w - DESIGN_W * k) / 2,
                  top: (size.h - DESIGN_H * k) / 2,
                  width: DESIGN_W * k,
                  height: DESIGN_H * k,
                }
          }
        >
          <div style={drawn}>{children}</div>
        </div>
      </div>
    </FitModeCtx.Provider>
  );
}
