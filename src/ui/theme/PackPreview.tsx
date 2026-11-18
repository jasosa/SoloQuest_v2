import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { board } from '../../engine/board/board';
import type { FurnitureDef, MonsterType } from '../../engine/quest/schema';
import { MONSTER_TYPES, TRAP_KINDS } from '../../engine/quest/schema';
import { Furniture } from '../board/Furniture';
import { Dialog } from '../shared/Frame';
import { color } from '../shared/tokens';
import { MONSTER_LETTER } from '../play/monsterCodes';
import { ThemeScope } from './activeTheme';
import { checkPack, type PictureSize } from './check';
import { BoardArt, blockPiece, doorPiece, floorCell, squarePiece, tokenBox } from './draw';
import { manifestFiles, themeFromPack, type PackFile, type StoredPack } from './pack';
import type { Theme, TrapSlot } from './theme';

/**
 * The pack preview (backlog, decision 78): a sample board that shows every slot of a pack with the same
 * drawing code the game uses, a check of the pictures (too small, wrong shape for the board) and the
 * slots the pack leaves empty. It is how a pack author sees the result without opening a quest.
 */

const U = 34; // a square, as on the real board
/** The sample is the bottom left 14 x 9 squares of the real board; sample (0, 0) is board (1, 10). */
const OX = 1;
const OY = 10;
const COLS = 14;
const ROWS = 9;

const at = (sx: number, sy: number) => [sx + OX, sy + OY] as const;

/** A piece of furniture of `w` x `h` squares whose top left square is sample (sx, sy). */
function piece(
  id: string,
  type: FurnitureDef['type'],
  sx: number,
  sy: number,
  w: number,
  h: number,
): FurnitureDef {
  const cells: [number, number][] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) cells.push([...at(sx + x, sy + y)]);
  return { id, type, cells };
}

const SAMPLE_FURNITURE: FurnitureDef[] = [
  piece('s-bookcase', 'bookcase', 0, 0, 3, 1),
  piece('s-cupboard', 'cupboard', 4, 0, 3, 1),
  piece('s-fireplace', 'fireplace', 8, 0, 3, 1),
  piece('s-chest', 'chest', 12, 0, 1, 1),
  piece('s-throne', 'throne', 13, 0, 1, 1),
  piece('s-table', 'table', 0, 2, 3, 2),
  piece('s-sorc', 'sorcerersTable', 4, 2, 3, 2),
  piece('s-alch', 'alchemistsBench', 8, 2, 3, 2),
  piece('s-rack', 'rack', 11, 2, 3, 2),
  piece('s-stairs', 'stairs', 0, 4, 2, 2), // board (1, 14): the top left corner of the start room of quest 1
  piece('s-tomb', 'tomb', 4, 5, 3, 2),
  piece('s-weapons', 'weaponsRack', 8, 5, 3, 1),
];

const TRAP_SAMPLES: TrapSlot[] = ['armed', ...TRAP_KINDS];

function dataUrl(f: PackFile): string {
  let bin = '';
  for (let i = 0; i < f.bytes.length; i += 0x8000)
    bin += String.fromCharCode(...f.bytes.subarray(i, i + 0x8000));
  return `data:${f.mime};base64,${btoa(bin)}`;
}

/** The sample board: every slot of the theme, with the built-in drawing where the pack has no picture. */
function Sample({ theme }: { theme: Theme }) {
  const cx = (sx: number) => (sx + OX + 0.5) * U;
  const cy = (sy: number) => (sy + OY + 0.5) * U;
  const nodes: ReactNode[] = [];

  // the floor
  if (theme.board)
    nodes.push(
      <rect
        key="bg"
        x={0}
        y={0}
        width={board.width * U}
        height={board.height * U}
        fill="url(#pv-board)"
      />,
    );
  else
    for (let sy = 0; sy < ROWS; sy++)
      for (let sx = 0; sx < COLS; sx++)
        nodes.push(floorCell(theme, sx + OX, sy + OY, U, false, `f${sx},${sy}`, 'pv-board'));

  // furniture
  for (const f of SAMPLE_FURNITURE) nodes.push(<Furniture key={f.id} f={f} board={board} />);

  // monsters, row 7
  MONSTER_TYPES.forEach((t: MonsterType, i) => {
    const x = cx(i);
    const y = cy(7);
    const href = theme.monster?.[t];
    nodes.push(
      href ? (
        <image
          key={`m${t}`}
          href={href}
          {...tokenBox(theme, t, x, y, U)}
          preserveAspectRatio="xMidYMid meet"
        />
      ) : (
        <g key={`m${t}`}>
          <circle
            cx={x}
            cy={y}
            r={13.5}
            fill="var(--green)"
            stroke={color.tokenText}
            strokeWidth={2}
          />
          <text
            x={x}
            y={y + 4.2}
            textAnchor="middle"
            fill={color.tokenText}
            fontFamily="Bonum"
            fontWeight={700}
            fontSize={11.5}
          >
            {MONSTER_LETTER[t]}
          </text>
        </g>
      ),
    );
  });

  // blocks, row 7 to the right of the monsters
  const [bx1, by1] = at(10, 7);
  nodes.push(
    squarePiece(theme, { group: 'block', key: 'single' }, bx1, by1, U, 'block') ?? (
      <rect
        key="b1"
        x={bx1 * U + 2}
        y={by1 * U + 2}
        width={U - 4}
        height={U - 4}
        fill={color.white}
        stroke={color.ink}
        strokeWidth={1.5}
      />
    ),
  );
  const dbl: [number, number][] = [
    at(12, 7) as unknown as [number, number],
    at(13, 7) as unknown as [number, number],
  ];
  nodes.push(
    blockPiece(theme, dbl, U, 'b2') ?? (
      <g key="b2">
        {dbl.map(([x, y]) => (
          <rect
            key={x}
            x={x * U + 2}
            y={y * U + 2}
            width={U - 4}
            height={U - 4}
            fill={color.white}
            stroke={color.ink}
            strokeWidth={1.5}
          />
        ))}
      </g>
    ),
  );

  // doors, row 8: closed, open, secret, closed in a vertical wall
  const doorBuiltIn = (key: string, x: number, y: number, vertical: boolean) => (
    <rect
      key={key}
      x={x - (vertical ? 5 : 12)}
      y={y - (vertical ? 12 : 5)}
      width={vertical ? 10 : 24}
      height={vertical ? 24 : 10}
      fill={color.white}
      stroke={color.ink}
      strokeWidth={1.6}
    />
  );
  (
    [
      ['closed', 7, false],
      ['open', 8, false],
      ['secret', 9, false],
      ['closed', 11, true],
    ] as const
  ).forEach(([kind, sx, vertical], i) => {
    nodes.push(
      doorPiece(theme, kind, cx(sx), cy(8), vertical, U) ??
        doorBuiltIn(`d${i}`, cx(sx), cy(8), vertical),
    );
  });

  // traps, row 8
  TRAP_SAMPLES.forEach((k, i) => {
    const [x, y] = at(i, 8);
    nodes.push(
      squarePiece(theme, { group: 'trap', key: k }, x, y, U, 'trap') ?? (
        <g key={`t${k}`}>
          <polygon
            points={`${(x + 0.5) * U},${(y + 0.5) * U - 13} ${(x + 0.5) * U + 13},${(y + 0.5) * U + 10} ${(x + 0.5) * U - 13},${(y + 0.5) * U + 10}`}
            fill={color.white}
            stroke={color.ink}
            strokeWidth={1.8}
            strokeLinejoin="round"
          />
          <text
            x={(x + 0.5) * U}
            y={(y + 0.5) * U + 7}
            textAnchor="middle"
            fill={color.ink}
            fontFamily="Bonum"
            fontWeight={700}
            fontSize={14}
          >
            ?
          </text>
        </g>
      ),
    );
  });

  return (
    <svg
      viewBox={`${OX * U} ${OY * U} ${COLS * U} ${ROWS * U}`}
      width="100%"
      role="img"
      aria-label="Sample board"
      data-testid="pack-sample"
      style={{ display: 'block', border: '1.5px solid var(--ink)', background: color.floor }}
    >
      <defs>
        <BoardArt id="pv-board" theme={theme} w={board.width} h={board.height} size={U} />
      </defs>
      {nodes}
    </svg>
  );
}

export function PackPreview({ pack, onClose }: { pack: StoredPack; onClose(): void }) {
  const theme = useMemo(
    () => themeFromPack(pack, (file) => dataUrl(pack.files[file] as PackFile)),
    [pack],
  );
  const files = useMemo(() => manifestFiles(pack.manifest), [pack]);
  const [sizes, setSizes] = useState<Record<string, PictureSize>>({});
  // the real size of every picture, to tell which ones would look soft
  useEffect(() => {
    let live = true;
    const found: Record<string, PictureSize> = {};
    let left = files.length;
    if (left === 0) return;
    for (const file of files) {
      const img = new Image();
      const done = () => {
        left -= 1;
        if (left === 0 && live) setSizes({ ...found });
      };
      img.onload = () => {
        found[file] = { w: img.naturalWidth, h: img.naturalHeight };
        done();
      };
      img.onerror = done;
      img.src = dataUrl(pack.files[file] as PackFile);
    }
    return () => {
      live = false;
    };
  }, [files, pack]);
  const check = useMemo(() => checkPack(pack.manifest, sizes), [pack, sizes]);
  const boardSize = pack.manifest.board ? sizes[pack.manifest.board] : undefined;

  return (
    <Dialog
      title={`Preview: ${pack.manifest.name}`}
      wide
      foot={
        <button className="btn" autoFocus onClick={onClose}>
          Close
        </button>
      }
    >
      <ThemeScope theme={theme}>
        <div data-testid="pack-preview">
          <div className="lbl">Check</div>
          {check.warnings.length === 0 ? (
            <p className="fr-help" role="status">
              No problems found with the pictures.
            </p>
          ) : (
            <ul className="pv-warnings" role="status">
              {check.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
          {check.missing.length > 0 && (
            <p className="fr-help" data-testid="pack-missing">
              Not in this pack (the built-in drawing is used): {check.missing.join(', ')}.
            </p>
          )}
          <div className="lbl pv-gap">On the board</div>
          <Sample theme={theme} />
          <p className="fr-help">
            Squares are 34 px; the real board shows them up to twice as big. Rows: furniture, then
            monsters with a single block and a double block, then traps (hidden, pit, spear, falling
            block, chest, scripted) and doors (closed, open, secret, closed in a vertical wall).
          </p>
          {pack.manifest.board && (
            <>
              <div className="lbl pv-gap">
                Board picture{boardSize ? ` (${boardSize.w} x ${boardSize.h} px)` : ''}
              </div>
              <img
                className="pv-board"
                src={dataUrl(pack.files[pack.manifest.board] as PackFile)}
                alt="The board picture"
              />
            </>
          )}
        </div>
      </ThemeScope>
    </Dialog>
  );
}
