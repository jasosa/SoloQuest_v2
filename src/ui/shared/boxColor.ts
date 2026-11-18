/** The fill of a monster token (the roster coin too) by the box its enemy comes from. */
export const boxTokenFill = (box: string | undefined): string =>
  box === 'Frozen Horror' ? 'var(--ice)' : 'var(--green)';
