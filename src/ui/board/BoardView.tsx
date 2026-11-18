import { useMemo } from 'react';
import { areaAt, cellsOf, isWallBetween, roomIds, type Board } from '../../engine/board/board';
import { color } from '../shared/tokens';
import { useTheme } from '../theme/activeTheme';
import { BoardArt, floorCell, RockPattern, wallSegment } from '../theme/draw';

export const CELL = 34;

export interface BoardViewProps {
  board: Board;
  /** Cells to draw as explored. Everything else stays rock hatching. */
  known: (x: number, y: number) => boolean;
  /** Draw room ids in the middle of each room (for map checks). */
  labels?: boolean;
}

const EDGES = [
  [0, -1, 0, 0, 1, 0],
  [1, 0, 1, 0, 1, 1],
  [0, 1, 0, 1, 1, 1],
  [-1, 0, 0, 0, 0, 1],
] as const;

export function BoardView({ board, known, labels = false }: BoardViewProps) {
  const { width: W, height: H } = board;
  const rooms = useMemo(() => roomIds(board), [board]);
  const theme = useTheme();

  const cells = [];
  const walls = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      cells.push(
        <rect
          key={`g${x},${y}`}
          x={x * CELL}
          y={y * CELL}
          width={CELL}
          height={CELL}
          fill="none"
          stroke={color.rockLine}
          strokeWidth={0.6}
        />,
      );
      if (!known(x, y)) continue;
      const corridor = areaAt(board, x, y) === 'C';
      cells.push(floorCell(theme, x, y, CELL, corridor, `f${x},${y}`));
      for (const [dx, dy, ax, ay, bx, by] of EDGES) {
        if (!isWallBetween(board, [x, y], [x + dx, y + dy])) continue;
        if (theme.board) continue; // the board picture has the walls
        walls.push(
          wallSegment(
            theme,
            `w${x},${y},${dx},${dy}`,
            (x + ax) * CELL,
            (y + ay) * CELL,
            (x + bx) * CELL,
            (y + by) * CELL,
          ),
        );
      }
    }
  }

  return (
    <svg
      id="board"
      role="img"
      aria-label="Quest board"
      width={W * CELL + 4}
      height={H * CELL + 4}
      viewBox={`-2 -2 ${W * CELL + 4} ${H * CELL + 4}`}
    >
      <defs>
        <RockPattern id="hatch" theme={theme} size={CELL} />
        <BoardArt id="board-art" theme={theme} w={W} h={H} size={CELL} />
      </defs>
      <rect x={0} y={0} width={W * CELL} height={H * CELL} fill="url(#hatch)" />
      {cells}
      {walls}
      <rect
        x={0}
        y={0}
        width={W * CELL}
        height={H * CELL}
        fill="none"
        stroke={color.ink}
        strokeWidth={3}
      />
      {labels &&
        rooms.map((id) => {
          const cs = cellsOf(board, id).filter(([x, y]) => known(x, y));
          if (cs.length === 0) return null;
          const cx = cs.reduce((s, c) => s + c[0], 0) / cs.length + 0.5;
          const cy = cs.reduce((s, c) => s + c[1], 0) / cs.length + 0.5;
          return (
            <text
              key={id}
              x={cx * CELL}
              y={cy * CELL}
              textAnchor="middle"
              dominantBaseline="central"
              fontFamily="Bonum, serif"
              fontSize={13}
              fill={color.ink}
            >
              {id}
            </text>
          );
        })}
    </svg>
  );
}
