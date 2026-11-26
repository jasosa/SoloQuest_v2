import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { edgeDoorPiece } from './draw';
import type { Theme } from './theme';

const S = 34;
const theme = { edgeDoor: { ironEntry: 'i.png', woodenExit: 'w.png' } } as unknown as Theme;

type Props = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  transform?: string;
  opacity?: number;
  children?: ReactNode;
  'data-themed'?: string;
};
const piece = (kind: 'ironEntry' | 'woodenExit', dx: number, dy: number, open = false) => {
  const el = edgeDoorPiece(theme, kind, open, 100, 200, dx, dy, S);
  expect(isValidElement(el)).toBe(true);
  return el as ReactElement<Props>;
};
/** The door picture, turned as a whole (the wooden exit is one image, the iron entry a group). */
const turned = (el: ReactElement<Props>): { turn: string | undefined; door: Props } => {
  if (el.type === 'image') return { turn: el.props.transform, door: el.props };
  const images = Children.toArray(el.props.children).filter(
    (c): c is ReactElement<Props> => isValidElement(c) && c.type === 'image',
  );
  const door = images.find((c) => c.props['data-themed'] === 'edge-door')!;
  return { turn: el.props.transform, door: door.props };
};

describe('edgeDoorPiece: the door on the wall line, the arrow outside and pointing out', () => {
  it('is null without a picture (the drawn look)', () => {
    expect(edgeDoorPiece({} as Theme, 'ironEntry', false, 0, 0, 1, 0, S)).toBeNull();
  });

  it('centres the picture a quarter of a square outside the wall, whatever the side and kind', () => {
    // (dx, dy) points from outside into the board; the wall line is at (100, 200)
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const)
      for (const kind of ['ironEntry', 'woodenExit'] as const) {
        const { door } = turned(piece(kind, dx, dy));
        expect(door.x! + door.width! / 2).toBeCloseTo(100 - dx * S * 0.25);
        expect(door.y! + door.height! / 2).toBeCloseTo(200 - dy * S * 0.25);
        expect(door.width).toBe(S);
      }
  });

  it('turns the arrow out of the board for the exit, and for the entry once its arrow is mirrored', () => {
    const rot = (t: string | undefined) => (t ? Number(/^rotate\((-?[\d.]+)/.exec(t)![1]) : 0);
    // exit picture: the arrow points right, away from the door. West wall (dx 1): out is left.
    expect(Math.abs(rot(turned(piece('woodenExit', 1, 0)).turn))).toBe(180);
    expect(rot(turned(piece('woodenExit', -1, 0)).turn)).toBe(0);
    expect(rot(turned(piece('woodenExit', 0, 1)).turn)).toBe(-90);
    expect(rot(turned(piece('woodenExit', 0, -1)).turn)).toBe(90);
    // entry picture: the door half points into the board, the arrow half lies outside
    expect(rot(turned(piece('ironEntry', 1, 0)).turn)).toBe(0);
    expect(Math.abs(rot(turned(piece('ironEntry', -1, 0)).turn))).toBe(180);
    expect(rot(turned(piece('ironEntry', 0, 1)).turn)).toBe(90);
    expect(rot(turned(piece('ironEntry', 0, -1)).turn)).toBe(-90);
  });

  it('mirrors only the arrow half of the entry picture, in place', () => {
    const g = piece('ironEntry', 1, 0);
    const imgs = Children.toArray(g.props.children).filter(
      (c): c is ReactElement<Props> => isValidElement(c) && c.type === 'image',
    );
    const arrow = imgs.find((c) => c.props['data-themed'] === 'edge-door-arrow')!.props;
    const door = imgs.find((c) => c.props['data-themed'] === 'edge-door')!.props;
    expect(door.transform).toBeUndefined();
    // a flip about the middle of the left half: x -> 2c - x with c = x0 + S / 4
    expect(arrow.transform).toBe(`translate(${2 * (door.x! + S / 4)} 0) scale(-1 1)`);
  });

  it('fades an open door to 45% for both kinds, and a closed one is solid', () => {
    expect(piece('woodenExit', 1, 0, true).props.opacity).toBe(0.45);
    expect(piece('ironEntry', 1, 0, true).props.opacity).toBe(0.45);
    expect(piece('woodenExit', 1, 0).props.opacity).toBe(1);
    expect(piece('ironEntry', 1, 0).props.opacity).toBe(1);
  });
});
