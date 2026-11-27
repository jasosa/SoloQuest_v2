import { isValidElement, type ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { edgeDoorPiece } from './draw';
import type { Theme } from './theme';

const S = 34;
const theme = { edgeDoor: { ironEntry: 'i.png', woodenExit: 'w.png' } } as unknown as Theme;

type Props = {
  x: number;
  y: number;
  width: number;
  height: number;
  transform?: string;
  opacity: number;
};
const piece = (kind: 'ironEntry' | 'woodenExit', dx: number, dy: number, open = false) => {
  const el = edgeDoorPiece(theme, kind, open, 100, 200, dx, dy, S);
  expect(isValidElement(el)).toBe(true);
  return (el as ReactElement<Props>).props;
};
const rot = (p: Props) => (p.transform ? Number(/^rotate\((-?[\d.]+)/.exec(p.transform)![1]) : 0);

describe('edgeDoorPiece: the door on the wall line, the arrow outside', () => {
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
        const door = piece(kind, dx, dy);
        expect(door.x + door.width / 2).toBeCloseTo(100 - dx * S * 0.25);
        expect(door.y + door.height / 2).toBeCloseTo(200 - dy * S * 0.25);
        expect(door.width).toBe(S);
      }
  });

  it('turns the entry arrow into the board and the exit arrow out of it, on every side', () => {
    // (dx, dy) points into the board; the pictures have the arrow pointing right, the door on its right
    // for the entry (arrow at the door) and on its left for the exit (arrow away from the door)
    expect(rot(piece('ironEntry', 1, 0))).toBe(0); // west wall: in is right
    expect(Math.abs(rot(piece('ironEntry', -1, 0)))).toBe(180); // east wall: in is left
    expect(rot(piece('ironEntry', 0, 1))).toBe(90); // north wall: in is down
    expect(rot(piece('ironEntry', 0, -1))).toBe(-90); // south wall: in is up
    expect(Math.abs(rot(piece('woodenExit', 1, 0)))).toBe(180); // west wall: out is left
    expect(rot(piece('woodenExit', -1, 0))).toBe(0); // east wall: out is right
    expect(rot(piece('woodenExit', 0, 1))).toBe(-90); // north wall: out is up
    expect(rot(piece('woodenExit', 0, -1))).toBe(90); // south wall: out is down
  });

  it('draws one image per door, with no mirrored arrow', () => {
    for (const kind of ['ironEntry', 'woodenExit'] as const)
      expect(piece(kind, 1, 0)).toHaveProperty('href', kind === 'ironEntry' ? 'i.png' : 'w.png');
  });

  it('fades an open door to 45% for both kinds, and a closed one is solid', () => {
    expect(piece('woodenExit', 1, 0, true).opacity).toBe(0.45);
    expect(piece('ironEntry', 1, 0, true).opacity).toBe(0.45);
    expect(piece('woodenExit', 1, 0).opacity).toBe(1);
    expect(piece('ironEntry', 1, 0).opacity).toBe(1);
  });
});
