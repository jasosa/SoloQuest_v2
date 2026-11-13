/** What the player tapped on the map (it gets a margin note). */
export type Selection =
  | { readonly kind: 'door'; readonly id: string }
  | { readonly kind: 'cell'; readonly at: readonly [number, number] }
  | { readonly kind: 'monster'; readonly id: string };

/** Parse the `?select=` screenshot parameter: `door:d3`, `cell:12,18` or `monster:m1`. */
export function parseSelection(value: string | null): Selection | null {
  if (!value) return null;
  const [kind, rest = ''] = value.split(':');
  if (kind === 'door' && rest) return { kind, id: rest };
  if (kind === 'monster' && rest) return { kind, id: rest };
  if (kind === 'cell') {
    const [x, y] = rest.split(',').map(Number);
    if (Number.isInteger(x) && Number.isInteger(y)) return { kind, at: [x as number, y as number] };
  }
  return null;
}
