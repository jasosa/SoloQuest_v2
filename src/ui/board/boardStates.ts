import { areaAt, type Board } from '../../engine/board/board';

export type BoardState = 'fog' | 'partial' | 'full';

/** Scripted explored areas for screenshots: `?state=fog|partial|full`. */
export function knownFor(board: Board, state: BoardState): (x: number, y: number) => boolean {
  if (state === 'full') return () => true;
  if (state === 'fog') return () => false;
  const open = new Set(['C', 'R11', 'R20']);
  return (x, y) => open.has(areaAt(board, x, y) ?? '');
}

export function parseState(value: string | null): BoardState {
  return value === 'fog' || value === 'partial' || value === 'full' ? value : 'full';
}
