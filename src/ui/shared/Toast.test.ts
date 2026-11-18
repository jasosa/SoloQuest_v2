import { describe, expect, it } from 'vitest';
import { TOAST_LIMIT, toastMs, toastText } from './Toast';

describe('toastText', () => {
  it('leaves a short message alone', () => {
    expect(toastText('Saved.')).toBe('Saved.');
    const exact = 'x'.repeat(TOAST_LIMIT);
    expect(toastText(exact)).toBe(exact);
  });
  it('cuts a long message at a word and adds an ellipsis', () => {
    const long =
      'The trap sprang and the hero falls into the pit, loses one Body Point and must stay there. '.repeat(
        3,
      );
    const shown = toastText(long);
    expect(shown.length).toBeLessThanOrEqual(TOAST_LIMIT + 1);
    expect(shown.endsWith('…')).toBe(true);
    expect(long.startsWith(shown.slice(0, -1))).toBe(true);
    // not in the middle of a word
    expect(/\s$/.test(shown.slice(0, -1))).toBe(false);
    expect(long.charAt(shown.length - 1)).toBe(' ');
  });
  it('cuts a text with no spaces at the limit', () => {
    expect(toastText('y'.repeat(300))).toBe(`${'y'.repeat(TOAST_LIMIT)}…`);
  });
});

describe('toastMs', () => {
  it('is 3.2 s for a short message and grows with the length, up to 9 s', () => {
    expect(toastMs('Saved.')).toBe(3200);
    expect(toastMs('x'.repeat(40))).toBe(3200);
    expect(toastMs('x'.repeat(140))).toBe(3200 + 100 * 45);
    expect(toastMs('x'.repeat(1000))).toBe(9000);
  });
  it('can have a longer minimum (the editor keeps 4 s)', () => {
    expect(toastMs('Saved.', 4000)).toBe(4000);
    expect(toastMs('x'.repeat(1000), 4000)).toBe(9000);
  });
});
