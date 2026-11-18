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
import {
  manifestFiles,
  themeFromPack,
  type PackFile,
  type PackManifest,
  type StoredPack,
} from './pack';
import {
  adjustableSlots,
  GROUP_NAMES,
  isNoTune,
  NO_TUNE,
  tuneOfSlot,
  withTune,
  type SlotGroup,
  type SlotTune,
} from './tune';
import { OFFSET_MAX, SCALE_MAX, SCALE_MIN, type Theme, type TrapSlot } from './theme';

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
function Sample({
  theme,
  selected,
  onSelect,
}: {
  theme: Theme;
  selected: string | null;
  onSelect(id: string): void;
}) {
  /** A picture of the sample that can be clicked to adjust it. */
  const tag = (id: string, key: string, node: ReactNode) => (
    <g
      key={key}
      data-slot={id}
      className={selected === id ? 'pv-sel' : undefined}
      style={{ cursor: 'pointer' }}
      onClick={() => onSelect(id)}
    >
      {node}
    </g>
  );
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
  for (const f of SAMPLE_FURNITURE)
    nodes.push(tag(`furniture.${f.type}`, f.id, <Furniture f={f} board={board} />));

  // monsters, row 7
  MONSTER_TYPES.forEach((t: MonsterType, i) => {
    const x = cx(i);
    const y = cy(7);
    const href = theme.monster?.[t];
    const item = href ? (
      <image href={href} {...tokenBox(theme, t, x, y, U)} preserveAspectRatio="xMidYMid meet" />
    ) : (
      <g>
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
    );
    nodes.push(tag(`monster.${t}`, `m${t}`, item));
  });

  // blocks, row 7 to the right of the monsters
  const [bx1, by1] = at(10, 7);
  nodes.push(
    tag(
      'block.single',
      'b1',
      squarePiece(theme, { group: 'block', key: 'single' }, bx1, by1, U, 'block') ?? (
        <rect
          x={bx1 * U + 2}
          y={by1 * U + 2}
          width={U - 4}
          height={U - 4}
          fill={color.white}
          stroke={color.ink}
          strokeWidth={1.5}
        />
      ),
    ),
  );
  const dbl: [number, number][] = [
    at(12, 7) as unknown as [number, number],
    at(13, 7) as unknown as [number, number],
  ];
  nodes.push(
    tag(
      'block.double',
      'b2',
      blockPiece(theme, dbl, U, 'b2') ?? (
        <g>
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
      tag(
        `door.${kind}`,
        `d${i}`,
        doorPiece(theme, kind, cx(sx), cy(8), vertical, U) ??
          doorBuiltIn(`d${i}`, cx(sx), cy(8), vertical),
      ),
    );
  });

  // traps, row 8
  TRAP_SAMPLES.forEach((k, i) => {
    const [x, y] = at(i, 8);
    nodes.push(
      tag(
        `trap.${k}`,
        `t${k}`,
        squarePiece(theme, { group: 'trap', key: k }, x, y, U, 'trap') ?? (
          <g>
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

/** One knob: a slider with - and + buttons (44 px, so a finger can make small steps) and its value. */
function Knob({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format(v: number): string;
  onChange(v: number): void;
}) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, Math.round(v * 100) / 100)));
  return (
    <div className="pv-knob">
      <span className="pv-kl">{label}</span>
      <button className="chip" aria-label={`${label}: less`} onClick={() => set(value - step)}>
        {'\u2212'}
      </button>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => set(Number(e.target.value))}
      />
      <button className="chip" aria-label={`${label}: more`} onClick={() => set(value + step)}>
        +
      </button>
      <output className="pv-kv">{format(value)}</output>
    </div>
  );
}

export function PackPreview({
  pack,
  onClose,
  onSave,
}: {
  pack: StoredPack;
  onClose(): void;
  /** Keep the adjusted manifest (the dialog that opened this preview stores the pack). */
  onSave?: (manifest: PackManifest) => Promise<void>;
}) {
  const [draft, setDraft] = useState<PackManifest>(pack.manifest);
  const [slot, setSlot] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // every picture of the pack as a data URL, made once (an adjustment must not read the files again)
  const urls = useMemo(
    () => Object.fromEntries(Object.entries(pack.files).map(([name, f]) => [name, dataUrl(f)])),
    [pack],
  );
  const theme = useMemo(
    () => themeFromPack({ manifest: draft, files: pack.files }, (file) => urls[file] ?? ''),
    [draft, pack, urls],
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
      img.src = urls[file] ?? '';
    }
    return () => {
      live = false;
    };
  }, [files, urls]);
  const check = useMemo(() => checkPack(draft, sizes), [draft, sizes]);
  const boardSize = pack.manifest.board ? sizes[pack.manifest.board] : undefined;

  const slots = useMemo(() => adjustableSlots(draft), [draft]);
  const current = slot && slots.some((s) => s.id === slot) ? slot : null;
  const tune = current ? tuneOfSlot(draft, current) : NO_TUNE;
  const changed = JSON.stringify(draft) !== JSON.stringify(pack.manifest);
  const change = (next: Partial<SlotTune>) => {
    if (!current) return;
    setDraft((m) => withTune(m, current, { ...tuneOfSlot(m, current), ...next }));
  };
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const sq = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(2)} square`;

  return (
    <Dialog
      title={`Preview: ${pack.manifest.name}`}
      wide
      foot={
        <>
          {changed && onSave && (
            <span className="pv-unsaved" role="status">
              Unsaved changes
            </span>
          )}
          <button className="btn alt" autoFocus={!changed} onClick={onClose}>
            {changed ? 'Close without saving' : 'Close'}
          </button>
          {onSave && (
            <button
              className="btn"
              disabled={!changed || saving}
              onClick={async () => {
                setSaving(true);
                try {
                  await onSave(draft);
                } finally {
                  setSaving(false);
                }
              }}
            >
              Save changes
            </button>
          )}
        </>
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
          <Sample theme={theme} selected={current} onSelect={setSlot} />
          <p className="fr-help">
            Squares are 34 px; the real board shows them up to twice as big. Rows: furniture, then
            monsters with a single block and a double block, then traps (hidden, pit, spear, falling
            block, chest, scripted) and doors (closed, open, secret, closed in a vertical wall). Tap
            a picture to adjust it.
          </p>
          {onSave && slots.length > 0 && (
            <div className="pv-adjust" data-testid="pack-adjust">
              <div className="lbl">Adjust a picture</div>
              <select
                className="fr-sel"
                aria-label="Picture to adjust"
                value={current ?? ''}
                onChange={(e) => setSlot(e.target.value || null)}
              >
                <option value="">Choose a picture</option>
                {(Object.keys(GROUP_NAMES) as SlotGroup[]).map((g) => {
                  const inGroup = slots.filter((x) => x.group === g);
                  return inGroup.length === 0 ? null : (
                    <optgroup key={g} label={GROUP_NAMES[g]}>
                      {inGroup.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.label}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
              {current && (
                <>
                  <Knob
                    label="Size"
                    value={tune.scale}
                    min={SCALE_MIN}
                    max={SCALE_MAX}
                    step={0.05}
                    format={pct}
                    onChange={(v) => change({ scale: v })}
                  />
                  <Knob
                    label="Right"
                    value={tune.offset[0]}
                    min={-OFFSET_MAX}
                    max={OFFSET_MAX}
                    step={0.05}
                    format={sq}
                    onChange={(v) => change({ offset: [v, tune.offset[1]] })}
                  />
                  <Knob
                    label="Down"
                    value={tune.offset[1]}
                    min={-OFFSET_MAX}
                    max={OFFSET_MAX}
                    step={0.05}
                    format={sq}
                    onChange={(v) => change({ offset: [tune.offset[0], v] })}
                  />
                  <button
                    className="btn alt"
                    disabled={isNoTune(tune)}
                    onClick={() => change(NO_TUNE)}
                  >
                    Reset this picture
                  </button>
                </>
              )}
            </div>
          )}
          {pack.manifest.board && (
            <>
              <div className="lbl pv-gap">
                Board picture{boardSize ? ` (${boardSize.w} x ${boardSize.h} px)` : ''}
              </div>
              <img
                className="pv-board"
                src={urls[pack.manifest.board] ?? ''}
                alt="The board picture"
              />
            </>
          )}
        </div>
      </ThemeScope>
    </Dialog>
  );
}
