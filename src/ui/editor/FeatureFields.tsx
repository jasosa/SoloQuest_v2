/**
 * Inspector fields of the Frozen Horror board features: a tile, a room tile, a tunnel end, an
 * exterior door, and the hidden and locked flags of a door. Every change is an engine edit
 * operation through the store (undo and redo work); a refused change shows its sentence as a toast.
 */
import { useStore } from 'zustand';
import {
  knownFlags,
  removeBoardTileCell,
  resizeBoardTile,
  resizeRoomTile,
  roomTileSizes,
  rotateRoomTile,
  tileUsage,
  rotateBoardTile,
  setBoardTileFlags,
  setDoorFlags,
  setEdgeDoorKind,
  setStart,
  setTunnelDesign,
  tileBox,
  tileSizes,
} from '../../engine/editor';
import {
  BOARD_TILES,
  ROOM_TILES,
  footprintText,
  sizesText,
  tileSpec,
} from '../../engine/data/roomTiles';
import { roomTileCells } from '../../engine/quest/roomTileCells';
import { Toggle } from '../shared/Frame';
import type { EditorStore } from './editorStore';

const EDGE_NAMES = { ironEntry: 'Iron entry', woodenExit: 'Wooden exit' } as const;
const SIDE_NAMES = { n: 'north', e: 'east', s: 'south', w: 'west' } as const;

/** A flag name field with the flags the actions set as suggestions. Saves when it loses focus. */
function FlagField({
  label,
  value,
  onSave,
  flags,
  listId,
}: {
  label: string;
  value: string;
  onSave(v: string): void;
  flags: readonly string[];
  listId: string;
}) {
  return (
    <label className="ed-field">
      {label}
      <input
        key={value}
        aria-label={label}
        list={listId}
        defaultValue={value}
        maxLength={40}
        onBlur={(e) => {
          if (e.target.value.trim() !== value) onSave(e.target.value);
        }}
      />
      <datalist id={listId}>
        {flags.map((f) => (
          <option key={f} value={f} />
        ))}
      </datalist>
    </label>
  );
}

/** "Hidden until flag" and "Locked until flag" of a normal, secret or false door. */
export function DoorFlagFields({
  store,
  door,
}: {
  store: EditorStore;
  door: { id: string; hiddenUntil?: string; lockedUntil?: string };
}) {
  const { quest } = useStore(store);
  const st = store.getState();
  const flags = knownFlags(quest);
  return (
    <>
      <FlagField
        label="Hidden until flag"
        value={door.hiddenUntil ?? ''}
        flags={flags}
        listId={`flags-h-${door.id}`}
        onSave={(v) => st.apply((q) => setDoorFlags(q, door.id, { hiddenUntil: v }))}
      />
      <FlagField
        label="Locked until flag"
        value={door.lockedUntil ?? ''}
        flags={flags}
        listId={`flags-l-${door.id}`}
        onSave={(v) => st.apply((q) => setDoorFlags(q, door.id, { lockedUntil: v }))}
      />
      <p className="ed-note">
        A hidden door is not drawn, and a locked door will not open, until an action sets the flag.
        Empty means always.
      </p>
    </>
  );
}

export function TileFields({ store, index }: { store: EditorStore; index: number }) {
  const { quest } = useStore(store);
  const st = store.getState();
  const tile = quest.boardTiles[index];
  if (!tile) return null;
  const def = BOARD_TILES[tile.type];
  const box = tileBox(tile.cells);
  const flags = knownFlags(quest);
  return (
    <>
      <p className="ed-note" data-testid="tile-size">
        {def.name},{' '}
        {def.shape === 'fixed'
          ? `${box.w} x ${box.h}`
          : `${tile.cells.length} ${tile.cells.length === 1 ? 'square' : 'squares'}`}
        . Comes as {footprintText(def)}.
        {def.maxPerSize !== undefined &&
          ` ${tileUsage(quest, 'board', tile.type).used} of ${tileUsage(quest, 'board', tile.type).max} in this quest (${tileUsage(quest, 'board', tile.type).text}).`}
      </p>
      {def.shape === 'fixed' && (
        <>
          <div className="lbl">Size</div>
          <div className="ed-chips" role="group" aria-label="Tile size">
            {tileSizes(tile.type).map(([w, h]) => (
              <button
                key={`${w}x${h}`}
                className="chip"
                aria-pressed={box.w === w && box.h === h}
                onClick={() => st.apply((q) => resizeBoardTile(q, index, [w, h]))}
              >
                {w} x {h}
              </button>
            ))}
          </div>
          <button className="btn alt" onClick={() => st.apply((q) => rotateBoardTile(q, index))}>
            Turn
          </button>
        </>
      )}
      <FlagField
        label="Gone when this flag is set"
        value={tile.hiddenWhen ?? ''}
        flags={flags}
        listId={`flags-t-${index}`}
        onSave={(v) => st.apply((q) => setBoardTileFlags(q, index, { hiddenWhen: v }))}
      />
      <Toggle
        label="Blocks sight and squares until then"
        on={tile.blocks === true}
        onChange={(on) => st.apply((q) => setBoardTileFlags(q, index, { blocks: on }))}
      />
      {def.shape === 'laid' && (
        <>
          <p className="ed-note">
            Laid square by square. With the Tiles tool, tap a square next to it to add to it.
          </p>
          <button
            className="btn alt"
            onClick={() => {
              const c = tile.cells[tile.cells.length - 1];
              if (!c) return;
              st.apply((q) => removeBoardTileCell(q, index, [c[0], c[1]]));
              if (tile.cells.length === 1) st.select(null);
            }}
          >
            Remove the last square
          </button>
        </>
      )}
    </>
  );
}

export function RoomTileFields({ store, index }: { store: EditorStore; index: number }) {
  const { quest } = useStore(store);
  const st = store.getState();
  const t = quest.roomTiles[index];
  if (!t) return null;
  const def = ROOM_TILES[t.type];
  const box = tileBox(roomTileCells(quest, t));
  const usage = tileUsage(quest, 'room', t.type);
  return (
    <>
      <p className="ed-note" data-testid="room-tile-info">
        {def.name}, {box.w} x {box.h}. Comes as {sizesText(tileSpec('room', t.type)!)}. {usage.used}{' '}
        of {usage.max} in this quest ({usage.text}).
      </p>
      <div className="lbl">Size</div>
      <div className="ed-chips" role="group" aria-label="Tile size">
        {roomTileSizes(t.type).map(([w, h]) => (
          <button
            key={`${w}x${h}`}
            className="chip"
            aria-pressed={box.w === w && box.h === h}
            onClick={() => st.apply((q) => resizeRoomTile(q, index, [w, h]))}
          >
            {w} x {h}
          </button>
        ))}
      </div>
      <button className="btn alt" onClick={() => st.apply((q) => rotateRoomTile(q, index))}>
        Turn
      </button>
      {def.rule.map((line, i) => (
        <p className="ed-note" key={i}>
          {line}
        </p>
      ))}
    </>
  );
}

export function TunnelFields({
  store,
  id,
  end,
}: {
  store: EditorStore;
  id: string;
  end: 'a' | 'b';
}) {
  const { quest } = useStore(store);
  const st = store.getState();
  const t = quest.tunnels.find((x) => x.id === id);
  if (!t) return null;
  const used = new Set(quest.tunnels.filter((x) => x.id !== id).map((x) => x.design));
  const other = end === 'a' ? t.b : t.a;
  return (
    <>
      <p className="ed-note" data-testid="tunnel-info">
        Ice tunnel, design {t.design}, end {end.toUpperCase()}. It leads to {other[0]}, {other[1]}.
      </p>
      <div className="lbl">Design</div>
      <div className="ed-chips ed-nums" role="group" aria-label="Tunnel design">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
          <button
            key={d}
            className="chip"
            aria-pressed={t.design === d}
            disabled={used.has(d)}
            onClick={() => st.apply((q) => setTunnelDesign(q, id, d))}
          >
            {d}
          </button>
        ))}
      </div>
      <p className="ed-note">Delete removes both ends.</p>
    </>
  );
}

export function ExteriorDoorFields({ store, id }: { store: EditorStore; id: string }) {
  const { quest } = useStore(store);
  const st = store.getState();
  const e = quest.edgeDoors.find((x) => x.id === id);
  if (!e) return null;
  const isStart = quest.start.door === id;
  return (
    <>
      <div className="ed-chips" role="group" aria-label="Exterior door kind">
        {(['ironEntry', 'woodenExit'] as const).map((k) => (
          <button
            key={k}
            className="chip"
            aria-pressed={e.kind === k}
            onClick={() => st.apply((q) => setEdgeDoorKind(q, id, k))}
          >
            {EDGE_NAMES[k]}
          </button>
        ))}
      </div>
      <p className="ed-note">
        On the {SIDE_NAMES[e.side]} edge of square {e.cell[0]}, {e.cell[1]}.
      </p>
      {e.kind === 'ironEntry' && (
        <button
          className="btn alt"
          aria-pressed={isStart}
          disabled={isStart}
          onClick={() => st.apply((q) => setStart(q, { door: id }))}
        >
          The heroes start here
        </button>
      )}
      {e.kind === 'woodenExit' && (
        <p className="ed-note">Heroes leave through this door when the quest ends.</p>
      )}
    </>
  );
}
