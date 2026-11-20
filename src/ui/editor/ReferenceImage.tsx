/**
 * The reference image of the editor: a local picture (a photo or scan of a map) laid over the board
 * to trace from. It stays on this device: in memory and, per quest, in IndexedDB. It is not part
 * of the quest, so it is never exported or uploaded.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useModal } from '../shared/useModal';
import type { ReferenceStore } from '../../persist/reference';
import { BOARD_H, BOARD_W, U } from './geometry';
import {
  CORNER_NAMES,
  boardCorners,
  isConvexQuad,
  referenceMatrix,
  toMatrix3d,
  type Pt,
} from './reference';
import { t } from '../../i18n/t';

/** The svg of the board draws 2 units of margin around the squares (viewBox starts at -2). */
const PAD = 2;
export const BOARD_VIEW_W = BOARD_W * U + 4;
export const BOARD_VIEW_H = BOARD_H * U + 4;
const MAX_BYTES = 40 * 1024 * 1024;

export interface ReferenceState {
  readonly blob: Blob;
  readonly url: string;
  readonly width: number;
  readonly height: number;
  /** Four corners of the board frame on the image, in image pixels (top left, then clockwise). */
  readonly corners: readonly Pt[] | null;
  readonly opacity: number;
  readonly visible: boolean;
}

export interface ReferenceApi {
  readonly state: ReferenceState | null;
  /** True while the corner picker is open. */
  readonly aligning: boolean;
  setAligning(on: boolean): void;
  /** Read a dropped or chosen file. Returns a plain sentence when it is refused. */
  load(file: File): Promise<string | null>;
  setCorners(corners: readonly Pt[]): void;
  setOpacity(opacity: number): void;
  setVisible(visible: boolean): void;
  clear(): void;
}

function measure(blob: Blob): Promise<ReferenceState> {
  const url = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () =>
      resolve({
        blob,
        url,
        width: img.naturalWidth,
        height: img.naturalHeight,
        corners: null,
        opacity: 0.5,
        visible: true,
      });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('bad image'));
    };
    img.src = url;
  });
}

export function useReference(questId: string, persist?: ReferenceStore): ReferenceApi {
  const [state, setState] = useState<ReferenceState | null>(null);
  const [aligning, setAligning] = useState(false);
  const urlRef = useRef<string | null>(null);
  const loaded = useRef(false);
  /** Set when the user loads a file, so a slower read of the stored image cannot replace it. */
  const picked = useRef(false);

  const put = useCallback((next: ReferenceState | null) => {
    if (urlRef.current && urlRef.current !== next?.url) URL.revokeObjectURL(urlRef.current);
    urlRef.current = next?.url ?? null;
    setState(next);
  }, []);

  // Pick up the image kept for this quest.
  useEffect(() => {
    let live = true;
    loaded.current = false;
    picked.current = false;
    void (async () => {
      const rec = await persist?.load(questId);
      if (rec && live && !picked.current) {
        try {
          const m = await measure(rec.image);
          if (!live || picked.current) return URL.revokeObjectURL(m.url);
          const ok = rec.corners && isConvexQuad(rec.corners);
          put({
            ...m,
            corners: ok ? (rec.corners as Pt[]) : null,
            opacity: rec.opacity,
            visible: rec.visible,
          });
        } catch {
          /* a broken stored image is ignored */
        }
      }
      loaded.current = true;
    })();
    return () => {
      live = false;
    };
  }, [questId, persist, put]);

  // Keep the image on this device (a short pause lets a slider settle).
  useEffect(() => {
    if (!persist || !loaded.current || !state) return;
    const t = setTimeout(() => {
      void persist
        .save({
          questId,
          image: state.blob,
          corners: state.corners
            ? state.corners.map((p) => [p[0], p[1]] as [number, number])
            : null,
          opacity: state.opacity,
          visible: state.visible,
        })
        .catch(() => undefined);
    }, 250);
    return () => clearTimeout(t);
  }, [state, persist, questId]);

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  return {
    state,
    aligning,
    setAligning,
    async load(file) {
      if (!file.type.startsWith('image/')) return 'That file is not an image.';
      if (file.size > MAX_BYTES) return 'That image is too big. Use one under 40 MB.';
      try {
        picked.current = true;
        const m = await measure(file);
        loaded.current = true;
        put(m);
        setAligning(true);
        return null;
      } catch {
        return 'The browser cannot read that image.';
      }
    },
    setCorners: (corners) => setState((s) => (s ? { ...s, corners, visible: true } : s)),
    setOpacity: (opacity) => setState((s) => (s ? { ...s, opacity } : s)),
    setVisible: (visible) => setState((s) => (s ? { ...s, visible } : s)),
    clear() {
      put(null);
      setAligning(false);
      void persist?.remove(questId).catch(() => undefined);
    },
  };
}

/** The image, bent onto the board. It sits above the board art and ignores the pointer. */
export function ReferenceLayer({ api }: { api: ReferenceApi }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const s = api.state;

  useEffect(() => {
    const svg = ref.current?.parentElement?.querySelector('svg');
    if (!svg) return;
    const update = () => setScale(svg.getBoundingClientRect().width / BOARD_VIEW_W || 1);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(svg);
    return () => ro.disconnect();
  }, [s?.url, s?.corners, s?.visible]);

  if (!s || !s.visible || !s.corners) return null;
  const h = referenceMatrix(s.corners, boardCorners(BOARD_W, BOARD_H, U, PAD));
  if (!h) return null;
  return (
    <div
      ref={ref}
      className="ed-ref"
      data-testid="reference-layer"
      style={{ width: BOARD_VIEW_W, height: BOARD_VIEW_H, transform: `scale(${scale})` }}
      aria-hidden="true"
    >
      <img
        src={s.url}
        alt=""
        draggable={false}
        width={s.width}
        height={s.height}
        style={{ opacity: s.opacity, transform: `matrix3d(${toMatrix3d(h).join(',')})` }}
      />
    </div>
  );
}

const ZOOMS = [
  { label: 'Fit', value: 0 },
  { label: '2x', value: 2 },
  { label: '3x', value: 3 },
] as const;

/** Full screen picker: tap the four corners of the map frame on the image. */
export function AlignDialog({ api, say }: { api: ReferenceApi; say(text: string): void }) {
  const s = api.state!;
  const [points, setPoints] = useState<Pt[]>([]);
  const [zoom, setZoom] = useState<number>(0);
  const [problem, setProblem] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const shown = points;

  const alignRef = useRef<HTMLDivElement>(null);
  useModal(alignRef, {
    onEscape: () => api.setAligning(false),
    trap: false,
    focus: 'none',
    restore: false,
  });

  const tap = (e: React.MouseEvent<HTMLImageElement>) => {
    setProblem(null);
    const r = imgRef.current!.getBoundingClientRect();
    const p: Pt = [
      ((e.clientX - r.left) / r.width) * s.width,
      ((e.clientY - r.top) / r.height) * s.height,
    ];
    const next = [...points, p];
    if (next.length < 4) {
      setPoints(next);
      return;
    }
    if (!isConvexQuad(next)) {
      const text = 'Those corners do not make a four sided shape.';
      say(text);
      setProblem(text);
      setPoints([]);
      return;
    }
    setPoints(next);
    api.setCorners(next);
    api.setAligning(false);
  };

  const step = shown.length;
  return (
    <div
      className="ed-align"
      ref={alignRef}
      role="dialog"
      aria-label={t('editor.ReferenceImage.alignTheReferenceImage', 'Align the reference image')}
    >
      <div className="ed-align-bar">
        <p className="ed-align-hint" role="status" data-problem={problem ? 'true' : undefined}>
          {problem ? `${problem} ` : ''}
          {t(
            'editor.ReferenceImage.tapTheCornerOf',
            'Tap the {v1} corner of the map frame. ({v2} of 4)',
            { v1: CORNER_NAMES[step] ?? '', v2: step + 1 },
          )}
        </p>
        <div className="ed-chips">
          {ZOOMS.map((z) => (
            <button
              key={z.label}
              className="chip"
              aria-pressed={zoom === z.value}
              onClick={() => setZoom(z.value)}
            >
              {z.label}
            </button>
          ))}
        </div>
        <button
          className="chip"
          disabled={shown.length === 0}
          onClick={() => setPoints(shown.slice(0, -1))}
        >
          {t('editor.ReferenceImage.undoPoint', 'Undo point')}
        </button>
        <button className="chip" onClick={() => api.setAligning(false)}>
          {s.corners
            ? t('editor.ReferenceImage.keepAsItIs', 'Keep as it is')
            : t('editor.ReferenceImage.cancel', 'Cancel')}
        </button>
      </div>
      <div className="ed-align-view">
        <div
          className="ed-align-stage"
          style={
            zoom
              ? { width: `${zoom * 100}%`, maxWidth: 'none', margin: 0 }
              : { width: `min(100%, calc((100vh - 110px) * ${s.width / s.height}))` }
          }
        >
          <img
            ref={imgRef}
            src={s.url}
            alt={t('editor.ReferenceImage.referenceToAlign', 'Reference to align')}
            draggable={false}
            onClick={tap}
            onError={() => {
              say('The browser could not show that image. Try a PNG or JPG.');
              api.clear();
            }}
          />
          {shown.map((p, i) => (
            <span
              key={i}
              className="ed-align-dot"
              style={{ left: `${(p[0] / s.width) * 100}%`, top: `${(p[1] / s.height) * 100}%` }}
            >
              {i + 1}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** The "Reference image" block of the tools column. */
export function ReferencePanel({
  api,
  say,
  children,
}: {
  api: ReferenceApi;
  say(text: string): void;
  children?: ReactNode;
}) {
  const s = api.state;
  const input = useRef<HTMLInputElement>(null);
  const take = async (file: File | undefined) => {
    if (!file) return;
    const problem = await api.load(file);
    if (problem) say(problem);
  };
  return (
    <div className="ed-ref-panel">
      <div className="lbl ed-gap">
        {t('editor.ReferenceImage.referenceImage', 'Reference image')}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        aria-label={t('editor.ReferenceImage.referenceImageFile', 'Reference image file')}
        data-testid="reference-file"
        onChange={(e) => {
          void take(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <button className="chip" onClick={() => input.current?.click()}>
        {s
          ? t('editor.ReferenceImage.changeImage', 'Change image')
          : t('editor.ReferenceImage.loadImage', 'Load image')}
      </button>
      {!s && (
        <p className="ed-note">
          {t(
            'editor.ReferenceImage.staysOnThisDevice',
            'Stays on this device. Drop a file on the board too.',
          )}
        </p>
      )}
      {s && (
        <>
          <button className="chip" onClick={() => api.setAligning(true)}>
            {s.corners
              ? t('editor.ReferenceImage.alignAgain', 'Align again')
              : t('editor.ReferenceImage.alignCorners', 'Align corners')}
          </button>
          {!s.corners && (
            <p className="ed-note">
              {t('editor.ReferenceImage.alignItToShow', 'Align it to show it on the board.')}
            </p>
          )}
          <button
            className="chip"
            aria-pressed={s.visible}
            disabled={!s.corners}
            onClick={() => api.setVisible(!s.visible)}
          >
            {s.visible
              ? t('editor.ReferenceImage.hideImage', 'Hide image')
              : t('editor.ReferenceImage.showImage', 'Show image')}
          </button>
          <label className="ed-field ed-range">
            Opacity
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              value={s.opacity}
              onChange={(e) => api.setOpacity(Number(e.target.value))}
            />
          </label>
          <button className="chip" onClick={() => api.clear()}>
            {t('editor.ReferenceImage.clearImage', 'Clear image')}
          </button>
        </>
      )}
      {children}
    </div>
  );
}
