import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { board } from '../../engine/board/board';
import type { FurnitureDef, MonsterType } from '../../engine/quest/schema';
import { MONSTER_TYPES, TRAP_KINDS } from '../../engine/quest/schema';
import { Furniture } from '../board/Furniture';
import { Dialog } from '../shared/Frame';
import { color } from '../shared/tokens';
import { MONSTER_LETTER } from '../play/monsterCodes';
import { ThemeScope } from './activeTheme';
import { checkPack, type PictureSize } from './check';
import {
  BoardArt,
  blockPiece,
  doorPiece,
  edgeDoorPiece,
  floorCell,
  squarePiece,
  tilePiece,
  tokenBox,
  tunnelPiece,
} from './draw';
import { expansionLayout, expansionMissing, type ExpansionLayout } from './expansion';
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
import { t } from '../../i18n/t';

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

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
const cellBox = (sx: number, sy: number, w = 1, h = 1): Box => ({
  x: (sx + OX) * U,
  y: (sy + OY) * U,
  w: w * U,
  h: h * U,
});

/** Where the picture of a slot sits in the sample (in board px), or null for a slot the sample does not show. */
function slotBox(id: string): Box | null {
  const [group, key = ''] = id.split('.');
  if (group === 'furniture') {
    const f = SAMPLE_FURNITURE.find((x) => x.type === key);
    if (!f) return null;
    const xs = f.cells.map((c) => c[0]);
    const ys = f.cells.map((c) => c[1]);
    const x0 = Math.min(...xs);
    const y0 = Math.min(...ys);
    return {
      x: x0 * U,
      y: y0 * U,
      w: (Math.max(...xs) - x0 + 1) * U,
      h: (Math.max(...ys) - y0 + 1) * U,
    };
  }
  if (group === 'monster') {
    const i = (MONSTER_TYPES as readonly string[]).indexOf(key);
    return i < 0 ? null : cellBox(i, 7);
  }
  if (group === 'block')
    return key === 'single' ? cellBox(10, 7) : key === 'double' ? cellBox(12, 7, 2, 1) : null;
  if (group === 'door') {
    const sx = ({ closed: 7, open: 8, secret: 9 } as Record<string, number>)[key];
    return sx === undefined ? null : cellBox(sx, 8);
  }
  if (group === 'trap') {
    const i = (TRAP_SAMPLES as readonly string[]).indexOf(key);
    return i < 0 ? null : cellBox(i, 8);
  }
  return null;
}

/** The view that zooms in on a picture: a few squares around it, 3 wide for every 2 high. */
function closeUpView(box: Box, cols = board.width, rows = board.height): string {
  let w = Math.max(6 * U, box.w + 2 * U);
  let h = (w * 2) / 3;
  if (h < box.h + U) {
    h = box.h + U;
    w = h * 1.5;
  }
  // never past the edge of the board, where there is nothing to draw
  const x = Math.min(Math.max(0, box.x + box.w / 2 - w / 2), Math.max(0, cols * U - w));
  const y = Math.min(Math.max(0, box.y + box.h / 2 - h / 2), Math.max(0, rows * U - h));
  return `${x} ${y} ${w} ${h}`;
}

function dataUrl(f: PackFile): string {
  let bin = '';
  for (let i = 0; i < f.bytes.length; i += 0x8000)
    bin += String.fromCharCode(...f.bytes.subarray(i, i + 0x8000));
  return `data:${f.mime};base64,${btoa(bin)}`;
}

/**
 * The sample of an expansion pack: its own slots on plain floor. Enemy tokens and the block, the entry
 * and exit doors on a wall line, the ice tunnel designs, and the tile pictures at their footprint.
 */
function ExpansionSample({
  theme,
  layout,
  selected,
  onSelect,
  view,
}: {
  theme: Theme;
  layout: ExpansionLayout;
  selected: string | null;
  onSelect(id: string): void;
  view?: string | null;
}) {
  const tag = (id: string, node: ReactNode) => (
    <g
      key={id}
      data-slot={id}
      className={selected === id ? 'pv-sel' : undefined}
      style={{ cursor: 'pointer' }}
      onClick={() => onSelect(id)}
    >
      {node}
    </g>
  );
  const nodes: ReactNode[] = [];
  for (let y = 0; y < layout.rows; y++)
    for (let x = 0; x < layout.cols; x++)
      nodes.push(floorCell(theme, x, y, U, false, `f${x},${y}`));
  // tiles first, so the tokens and doors lie over them
  for (const it of layout.items) {
    if (it.kind !== 'tile') continue;
    const cells: [number, number][] = [];
    for (let y = 0; y < it.h; y++) for (let x = 0; x < it.w; x++) cells.push([it.x + x, it.y + y]);
    nodes.push(<g key={`tile-${it.id}-${it.x}-${it.y}`}>{tilePiece(theme, it.key, cells, U)}</g>);
  }
  for (const it of layout.items) {
    if (it.kind === 'enemy') {
      const href = theme.enemy?.[it.id];
      if (!href) continue;
      nodes.push(
        tag(
          `enemy.${it.id}`,
          <image
            href={href}
            {...tokenBox(theme, 'goblin', (it.x + 0.5) * U, (it.y + 0.5) * U, U, it.id)}
            preserveAspectRatio="xMidYMid meet"
          />,
        ),
      );
    } else if (it.kind === 'block') {
      nodes.push(
        tag(
          'block.single',
          squarePiece(theme, { group: 'block', key: 'single' }, it.x, it.y, U, 'block'),
        ),
      );
    } else if (it.kind === 'edgeDoor') {
      const kind = it.id === 'ironEntry' ? 'ironEntry' : 'woodenExit';
      const wx = it.x * U;
      const wy = (it.y + 0.5) * U;
      nodes.push(
        tag(
          `edgeDoor.${kind}`,
          <g>
            <line
              x1={wx}
              y1={it.y * U}
              x2={wx}
              y2={(it.y + 1) * U}
              stroke={color.ink}
              strokeWidth={2.5}
            />
            {edgeDoorPiece(theme, kind, false, wx, wy, 1, 0, U)}
          </g>,
        ),
      );
    } else if (it.kind === 'tunnel') {
      nodes.push(tag(`tunnel.${it.id}`, tunnelPiece(theme, Number(it.id), it.x, it.y, U)));
    }
  }
  return (
    <svg
      viewBox={view ?? `0 0 ${layout.cols * U} ${layout.rows * U}`}
      width="100%"
      role="img"
      aria-label={t('theme.PackPreview.sampleBoard', 'Sample board')}
      data-testid="pack-sample"
      style={{ display: 'block', border: '1.5px solid var(--ink)', background: color.floor }}
    >
      {nodes}
    </svg>
  );
}

/** The sample board: every slot of the theme, with the built-in drawing where the pack has no picture. */
function Sample({
  theme,
  selected,
  onSelect,
  view,
}: {
  theme: Theme;
  selected: string | null;
  onSelect(id: string): void;
  /** A `viewBox` to zoom in with; the whole sample when left out. */
  view?: string | null;
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
      viewBox={view ?? `${OX * U} ${OY * U} ${COLS * U} ${ROWS * U}`}
      width="100%"
      role="img"
      aria-label={t('theme.PackPreview.sampleBoard', 'Sample board')}
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

/**
 * One knob: a slider with - and + buttons (44 px, so a finger can make small steps) and its value. A tap
 * on a button moves it one step (1%); held down it repeats, and after a second it moves in steps of five.
 */
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
  // the repeat reads the value as it is now, not as it was when the button was pressed
  const now = useRef(value);
  useLayoutEffect(() => {
    now.current = value;
  });
  const timer = useRef(0);
  const stop = () => {
    window.clearTimeout(timer.current);
    window.clearInterval(timer.current);
    timer.current = 0;
  };
  useEffect(() => stop, []);
  const hold = (dir: 1 | -1) => {
    stop();
    set(now.current + dir * step);
    let ticks = 0;
    timer.current = window.setTimeout(() => {
      timer.current = window.setInterval(() => {
        ticks += 1;
        set(now.current + dir * step * (ticks > 12 ? 5 : 1));
      }, 70);
    }, 450);
  };
  return (
    <div className="pv-knob">
      <div className="pv-kh">
        <span className="pv-kl">{label}</span>
        <output className="pv-kv">{format(value)}</output>
      </div>
      <div className="pv-kr">
        <button
          className="chip"
          aria-label={`${label}: less`}
          onPointerDown={(e) => {
            e.preventDefault();
            hold(-1);
          }}
          onPointerUp={stop}
          onPointerLeave={stop}
          onPointerCancel={stop}
          onClick={(e) => {
            // a click from the keyboard has no pointer press before it
            if (e.detail === 0) set(now.current - step);
          }}
        >
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
        <button
          className="chip"
          aria-label={`${label}: more`}
          onPointerDown={(e) => {
            e.preventDefault();
            hold(1);
          }}
          onPointerUp={stop}
          onPointerLeave={stop}
          onPointerCancel={stop}
          onClick={(e) => {
            if (e.detail === 0) set(now.current + step);
          }}
        >
          +
        </button>
      </div>
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
  // while a picture is picked the sample zooms in on it (it is hard to judge at the size of the sample)
  const [closeUp, setCloseUp] = useState(true);
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
  // an expansion pack extends a core pack: it is shown with its own slots, and the core slots are not missing
  const expansion = draft.box !== undefined;
  const check = useMemo(() => {
    const c = checkPack(draft, sizes);
    return expansion ? { ...c, missing: expansionMissing(draft) } : c;
  }, [draft, sizes, expansion]);
  const layout = useMemo(() => (expansion ? expansionLayout(theme) : null), [expansion, theme]);
  const boardSize = pack.manifest.board ? sizes[pack.manifest.board] : undefined;

  const slots = useMemo(() => adjustableSlots(draft), [draft]);
  const current = slot && slots.some((s) => s.id === slot) ? slot : null;
  const tune = current ? tuneOfSlot(draft, current) : NO_TUNE;
  const eb = current && layout ? layout.boxes[current] : undefined;
  const box = current
    ? eb
      ? { x: eb.x * U, y: eb.y * U, w: eb.w * U, h: eb.h * U }
      : layout
        ? null
        : slotBox(current)
    : null;
  const view =
    box && closeUp
      ? layout
        ? closeUpView(box, layout.cols, layout.rows)
        : closeUpView(box)
      : null;
  const changed = JSON.stringify(draft) !== JSON.stringify(pack.manifest);
  const change = (next: Partial<SlotTune>) => {
    if (!current) return;
    setDraft((m) => withTune(m, current, { ...tuneOfSlot(m, current), ...next }));
  };
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const sq = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(2)} square`;

  return (
    <Dialog
      title={t('theme.PackPreview.preview', 'Preview: {name}', { name: pack.manifest.name })}
      wide
      onClose={changed ? undefined : onClose}
      foot={
        <>
          {changed && onSave && (
            <span className="pv-unsaved" role="status">
              {t('theme.PackPreview.unsavedChanges', 'Unsaved changes')}
            </span>
          )}
          <button className="btn alt" autoFocus={!changed} onClick={onClose}>
            {changed
              ? t('theme.PackPreview.closeWithoutSaving', 'Close without saving')
              : t('theme.PackPreview.close', 'Close')}
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
              {t('theme.PackPreview.saveChanges', 'Save changes')}
            </button>
          )}
        </>
      }
    >
      <ThemeScope theme={theme}>
        <div data-testid="pack-preview">
          <div className="lbl">{t('theme.PackPreview.check', 'Check')}</div>
          {check.warnings.length === 0 ? (
            <p className="fr-help" role="status">
              {t('theme.PackPreview.noProblemsFoundWith', 'No problems found with the pictures.')}
            </p>
          ) : (
            <div role="status">
              <ul className="pv-warnings">
                {check.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          )}
          {check.missing.length > 0 && (
            <p className="fr-help" data-testid="pack-missing">
              {t(
                'theme.PackPreview.notInThisPack',
                'Not in this pack (the built-in drawing is used): {names}.',
                { names: check.missing.join(', ') },
              )}
            </p>
          )}
          <div
            className={
              onSave && slots.length > 0 ? (current ? 'pv-work pinned' : 'pv-work') : undefined
            }
            data-testid="pack-work"
          >
            <div className="pv-left">
              <div className="pv-views">
                <div className="lbl">
                  {view
                    ? t('theme.PackPreview.closeUp', 'Close-up')
                    : t('theme.PackPreview.onTheBoard', 'On the board')}
                </div>
                {box && (
                  <button
                    className="chip"
                    data-testid="pack-closeup"
                    aria-pressed={closeUp}
                    onClick={() => setCloseUp(!closeUp)}
                  >
                    {closeUp
                      ? t('theme.PackPreview.showTheWholeSample', 'Show the whole sample')
                      : t('theme.PackPreview.closeUp', 'Close-up')}
                  </button>
                )}
              </div>
              {layout ? (
                <ExpansionSample
                  theme={theme}
                  layout={layout}
                  selected={current}
                  onSelect={setSlot}
                  view={view}
                />
              ) : (
                <Sample theme={theme} selected={current} onSelect={setSlot} view={view} />
              )}
            </div>
            {onSave && slots.length > 0 && (
              <div className="pv-adjust" data-testid="pack-adjust">
                <div className="lbl">
                  {t('theme.PackPreview.adjustAPicture', 'Adjust a picture')}
                </div>
                <select
                  className="fr-sel"
                  aria-label={t('theme.PackPreview.pictureToAdjust', 'Picture to adjust')}
                  value={current ?? ''}
                  onChange={(e) => setSlot(e.target.value || null)}
                >
                  <option value="">
                    {t('theme.PackPreview.chooseAPicture', 'Choose a picture')}
                  </option>
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
                {current ? (
                  <>
                    <Knob
                      label={t('theme.PackPreview.size', 'Size')}
                      value={tune.scale}
                      min={SCALE_MIN}
                      max={SCALE_MAX}
                      step={0.01}
                      format={pct}
                      onChange={(v) => change({ scale: v })}
                    />
                    <Knob
                      label={t('theme.PackPreview.right', 'Right')}
                      value={tune.offset[0]}
                      min={-OFFSET_MAX}
                      max={OFFSET_MAX}
                      step={0.01}
                      format={sq}
                      onChange={(v) => change({ offset: [v, tune.offset[1]] })}
                    />
                    <Knob
                      label={t('theme.PackPreview.down', 'Down')}
                      value={tune.offset[1]}
                      min={-OFFSET_MAX}
                      max={OFFSET_MAX}
                      step={0.01}
                      format={sq}
                      onChange={(v) => change({ offset: [tune.offset[0], v] })}
                    />
                    <button
                      className="btn alt"
                      disabled={isNoTune(tune)}
                      onClick={() => change(NO_TUNE)}
                    >
                      {t('theme.PackPreview.resetThisPicture', 'Reset this picture')}
                    </button>
                  </>
                ) : (
                  <p className="fr-help">
                    {t(
                      'theme.PackPreview.chooseAPictureHere',
                      'Choose a picture here, or tap one in the sample.',
                    )}
                  </p>
                )}
              </div>
            )}
          </div>
          <p className="fr-help">
            {layout
              ? t(
                  'theme.PackPreview.squaresAre34PxExpansion',
                  'Squares are 34 px; the real board shows them up to twice as big. Rows: enemy tokens and the block, then the entry and exit doors on a wall line and the ice tunnels, then the tiles at their size. Tap an enemy, door or tunnel to adjust it.',
                )
              : t(
                  'theme.PackPreview.squaresAre34Px',
                  'Squares are 34 px; the real board shows them up to twice as big. Rows: furniture, then monsters with a single block and a double block, then traps (hidden, pit, spear, falling block, chest, scripted) and doors (closed, open, secret, closed in a vertical wall). Tap a picture to adjust it.',
                )}
          </p>
          {pack.manifest.board && (
            <>
              <div className="lbl pv-gap">
                {t('theme.PackPreview.boardPicture', 'Board picture{size}', {
                  size: boardSize ? ` (${boardSize.w} x ${boardSize.h} px)` : '',
                })}
              </div>
              <img
                className="pv-board"
                src={urls[pack.manifest.board] ?? ''}
                alt={t('theme.PackPreview.theBoardPicture', 'The board picture')}
              />
            </>
          )}
        </div>
      </ThemeScope>
    </Dialog>
  );
}
