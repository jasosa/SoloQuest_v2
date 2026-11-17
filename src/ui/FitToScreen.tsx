import { useEffect, useState, type ReactNode } from 'react';

/** The size every screen is drawn at (the tablet it is made for). */
export const DESIGN_W = 1194;
export const DESIGN_H = 834;
/** Never blow it up more than this on a large screen. */
const MAX_SCALE = 1.5;

/** The scale that makes the whole screen fit a window of this size. */
export function fitScale(width: number, height: number): number {
  if (width <= 0 || height <= 0) return 1;
  return Math.min(MAX_SCALE, width / DESIGN_W, height / DESIGN_H);
}

function windowSize(): { w: number; h: number } {
  const v = window.visualViewport;
  return { w: v?.width ?? window.innerWidth, h: v?.height ?? window.innerHeight };
}

/**
 * Draws the app at its design size and scales it to the window, centered. On a tablet the browser
 * bars take some of the height, so without this the bottom of a screen (a Start button) is cut off.
 */
export function FitToScreen({ children }: { children: ReactNode }) {
  const [size, setSize] = useState(windowSize);
  useEffect(() => {
    const on = () => setSize(windowSize());
    window.addEventListener('resize', on);
    window.visualViewport?.addEventListener('resize', on);
    return () => {
      window.removeEventListener('resize', on);
      window.visualViewport?.removeEventListener('resize', on);
    };
  }, []);
  const k = fitScale(size.w, size.h);
  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden' }} data-fit-scale={k.toFixed(3)}>
      <div
        style={{
          position: 'absolute',
          left: (size.w - DESIGN_W * k) / 2,
          top: (size.h - DESIGN_H * k) / 2,
          width: DESIGN_W,
          height: DESIGN_H,
          transformOrigin: '0 0',
          transform: k === 1 ? undefined : `scale(${k})`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
