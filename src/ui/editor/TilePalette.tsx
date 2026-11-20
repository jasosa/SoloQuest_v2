/**
 * The Tiles tool options (design/play-a/DESIGN.md, "Tiles tool"): one palette "Board tiles" with
 * every physical tile, room tiles and board tiles together. It works like the furniture palette:
 * pick a tile, pick one of its shapes (each shape once: a 3 x 2 is the same tile as a 2 x 3 turned),
 * Turn (R), then tap the board. The shapes sit in a row right under the picked chip, so nothing
 * is further down the screen.
 */
import { useStore } from 'zustand';
import { TILE_PALETTE, limitText, tileSpec } from '../../engine/data/roomTiles';
import { tileSizeUsed, tileUsage } from '../../engine/editor';
import { t } from '../../i18n/t';
import type { EditorStore } from './editorStore';

export function TilePalette({ store }: { store: EditorStore }) {
  const { quest, opts } = useStore(store);
  const set = store.getState().setOpts;
  const picked = TILE_PALETTE.findIndex(
    (p) => p.group === opts.tile.group && p.type === opts.tile.type,
  );
  // the shapes go after the last chip of the picked chip's row (two chips per row)
  const rowEnd = picked < 0 ? -1 : Math.min(picked - (picked % 2) + 1, TILE_PALETTE.length - 1);
  const spec = picked < 0 ? undefined : tileSpec(opts.tile.group, opts.tile.type);
  const fp = spec?.footprints[opts.tileVariant];
  const canTurn = fp !== undefined && fp[0] !== fp[1];

  const shapes = spec && (spec.footprints.length > 1 || canTurn) && (
    <div className="ed-palette-shapes" key="shapes">
      {spec.footprints.length > 1 && (
        <div className="ed-shapes" data-testid="tile-sizes">
          {spec.footprints.map(([w, h], i) => {
            const full =
              spec.maxPerSize !== undefined &&
              tileSizeUsed(quest, opts.tile.group, opts.tile.type, [w, h]) >= spec.maxPerSize;
            return (
              <button
                key={`${w}x${h}`}
                className="chip"
                aria-pressed={opts.tileVariant === i}
                disabled={full}
                title={
                  full
                    ? t('editor.EditorScreen.usedUpTheBox', 'Used up: the box has {v1}', {
                        v1: limitText(spec),
                      })
                    : undefined
                }
                onClick={() => set({ tileVariant: i })}
              >
                {w} x {h}
              </button>
            );
          })}
        </div>
      )}
      {canTurn && (
        <button
          className="chip ed-turn"
          onClick={() => set({ tileTurned: !opts.tileTurned })}
          aria-pressed={opts.tileTurned}
        >
          {t('editor.EditorScreen.turnR', 'Turn (R)')}
        </button>
      )}
    </div>
  );

  return (
    <>
      <div className="lbl">{t('editor.EditorScreen.boardTiles', 'Board tiles')}</div>
      <div className="ed-chips ed-palette" data-testid="tile-palette">
        {TILE_PALETTE.flatMap((p, i) => {
          const s = tileSpec(p.group, p.type)!;
          const u = tileUsage(quest, p.group, p.type);
          const chip = (
            <button
              key={`${p.group}:${p.type}`}
              className="chip"
              aria-pressed={i === picked}
              onClick={() => set({ tile: p, tileVariant: 0, tileTurned: false })}
            >
              {s.name}
              {u.used > 0 && u.max !== undefined && (
                <small data-full={u.used >= u.max ? '' : undefined}>
                  {' '}
                  {u.used} of {u.max}
                </small>
              )}
            </button>
          );
          return i === rowEnd ? [chip, shapes] : [chip];
        })}
      </div>
      {spec && (
        <p className="ed-note" data-testid="tile-limit">
          {t(
            'editor.EditorScreen.tapASquareFor',
            '{name}: {v1}. Tap a square for the top left of the tile.',
            { name: spec.name, v1: limitText(spec) },
          )}
        </p>
      )}
    </>
  );
}
