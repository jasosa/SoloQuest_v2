import { describe, expect, it } from 'vitest';
import { fitScale } from './FitToScreen';

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
});
