import { describe, expect, it } from 'vitest';
import { drawnWidth, fitScale } from './FitToScreen';

describe('fitScale', () => {
  it('is 1 at the design size and shrinks to fit a smaller window', () => {
    expect(fitScale(1194, 834)).toBe(1);
    expect(fitScale(1194, 700)).toBeCloseTo(700 / 834);
    expect(fitScale(800, 834)).toBeCloseTo(800 / 1194);
  });
  it('grows on a big screen, but not past 1.5', () => {
    expect(fitScale(1600, 1100)).toBeCloseTo(1100 / 834);
    expect(fitScale(4000, 3000)).toBe(1.5);
  });
  it('is 1 for a window of no size', () => {
    expect(fitScale(0, 0)).toBe(1);
  });

  describe('drawnWidth', () => {
    it('is the design width unless the play screen has a wider window than the tablet', () => {
      expect(drawnWidth(1194, 834)).toBe(1194);
      // a window as wide as the tablet but shorter: scaled by height, so the width grows to fill it
      expect(drawnWidth(1194, 700)).toBe(Math.floor(1194 / (700 / 834)));
      // a wide, short window: the screen is scaled by height and gets the extra width
      const k = 600 / 834;
      expect(drawnWidth(1500, 600)).toBe(Math.floor(1500 / k));
      expect(drawnWidth(1500, 600, 'width')).toBe(1194);
    });
  });
});
