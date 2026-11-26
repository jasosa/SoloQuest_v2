import { describe, expect, it } from 'vitest';
import {
  NEUTRAL_BAR,
  barOfExpansion,
  barOfPack,
  packOfExpansion,
  type BarContext,
} from './boxBars';

const ctx: BarContext = {
  colors: { core: '#6e1f2a', 'frozen-horror': '#3b6b8c', other: '#5a3a73' },
  packs: [
    { id: 'core', name: 'HeroQuest' },
    { id: 'frozen-horror', name: 'Frozen Horror' },
    { id: 'other', name: 'Other Box' },
  ],
};

describe('the colour of a bar', () => {
  it('a quest of a box takes the colour of the box from My collection', () => {
    expect(barOfPack('core', ctx)).toBe('#6e1f2a');
    expect(barOfPack('frozen-horror', ctx)).toBe('#3b6b8c');
    // the player changed a colour: the bar follows
    expect(barOfPack('other', { ...ctx, colors: { ...ctx.colors, other: '#112233' } })).toBe(
      '#112233',
    );
  });

  it('a quest made on this device (no pack) is neutral; so is a box with no colour', () => {
    expect(barOfPack(undefined, ctx)).toBe(NEUTRAL_BAR);
    expect(barOfPack('missing', ctx)).toBe(NEUTRAL_BAR);
    expect(NEUTRAL_BAR).toBe('var(--muted)');
  });

  it('an item of an expansion takes the box of that name', () => {
    expect(packOfExpansion('Frozen Horror', ctx.packs)).toBe('frozen-horror');
    expect(packOfExpansion('Nowhere', ctx.packs)).toBeUndefined();
    expect(barOfExpansion('Frozen Horror', false, ctx)).toBe('#3b6b8c');
  });

  it('an item with no expansion is the base game; what the player made is neutral', () => {
    expect(barOfExpansion(undefined, false, ctx)).toBe('#6e1f2a');
    expect(barOfExpansion(undefined, true, ctx)).toBe(NEUTRAL_BAR);
    expect(barOfExpansion('Frozen Horror', true, ctx)).toBe(NEUTRAL_BAR);
  });

  it('an expansion no installed box is called after cannot be linked: neutral', () => {
    expect(barOfExpansion('Test pack', false, ctx)).toBe(NEUTRAL_BAR);
  });
});
