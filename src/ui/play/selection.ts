import type { FurnitureDef } from '../../engine/quest/schema';

/** What the player tapped on the map (it gets a margin note). */
export type Selection =
  | { readonly kind: 'door'; readonly id: string }
  | { readonly kind: 'cell'; readonly at: readonly [number, number] }
  /** A square the heroes cannot see (fog): the note offers to reveal what is there. */
  | { readonly kind: 'fog'; readonly at: readonly [number, number] }
  | { readonly kind: 'monster'; readonly id: string }
  /** `furniture` is set when the tap was on a piece of furniture: its name leads the note. */
  | {
      readonly kind: 'room';
      readonly room: string;
      readonly furniture?: FurnitureDef['type'];
      /** The id of that furniture piece, for its own "For this quest" notes. */
      readonly furnitureId?: string;
    }
  | { readonly kind: 'trap'; readonly id: string }
  | { readonly kind: 'chest'; readonly id: string }
  | { readonly kind: 'tunnel'; readonly id: string; readonly end: 'a' | 'b' }
  | { readonly kind: 'square'; readonly at: readonly [number, number] }
  | { readonly kind: 'zone'; readonly id: string; readonly at?: readonly [number, number] }
  | { readonly kind: 'hero'; readonly hero: string };

/** Parse the `?select=` screenshot parameter: `door:d3`, `cell:12,18`, `monster:m1`, `room:R20`, `trap:t1`. */
export function parseSelection(value: string | null): Selection | null {
  if (!value) return null;
  const [kind, rest = ''] = value.split(':');
  if (kind === 'door' && rest) return { kind, id: rest };
  if (kind === 'monster' && rest) return { kind, id: rest };
  if (kind === 'trap' && rest) return { kind, id: rest };
  if (kind === 'chest' && rest) return { kind, id: rest };
  if (kind === 'room' && rest) return { kind, room: rest };
  if (kind === 'cell') {
    const [x, y] = rest.split(',').map(Number);
    if (Number.isInteger(x) && Number.isInteger(y)) return { kind, at: [x as number, y as number] };
  }
  return null;
}
