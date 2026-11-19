import { useState } from 'react';
import { useStore } from 'zustand';
import {
  addBoardTile,
  addEdgeDoor,
  addTunnel,
  parseCells,
  removeBoardTile,
  removeEdgeDoor,
  removeTunnel,
  setDoorFlags,
  setLeave,
  setRoomTile,
  setStart,
} from '../../engine/editor';
import {
  BOARD_TILES,
  BOARD_TILE_TYPES,
  ROOM_TILES,
  ROOM_TILE_TYPES,
} from '../../engine/data/roomTiles';
import { EDGE_DOOR_KINDS } from '../../engine/quest/schema';
import type { EditorStore } from './editorStore';

const EDGE_NAMES = { ironEntry: 'Iron entry door', woodenExit: 'Wooden exit door' } as const;
const cellText = (c: readonly number[]) => `${c[0]},${c[1]}`;

/**
 * The board features of expansion quests (Frozen Horror), typed as squares: the way the heroes
 * leave, ice tunnels, tiles on squares, tiles in rooms, edge doors with the start, and door flags.
 */
export function FeaturesPanel({ store }: { store: EditorStore }) {
  const { quest } = useStore(store);
  const st = store.getState();

  const [tunnel, setTunnel] = useState({ design: '1', a: '', b: '' });
  const [tile, setTile] = useState({
    type: BOARD_TILE_TYPES[0] as (typeof BOARD_TILE_TYPES)[number],
    cells: '',
    hiddenWhen: '',
    blocks: false,
  });
  const [room, setRoom] = useState({
    area: '',
    type: ROOM_TILE_TYPES[0] as (typeof ROOM_TILE_TYPES)[number],
  });
  const [edge, setEdge] = useState({
    cell: '',
    side: 'w' as 'n' | 'e' | 's' | 'w',
    kind: EDGE_DOOR_KINDS[0] as (typeof EDGE_DOOR_KINDS)[number],
  });
  const [bad, setBad] = useState('');

  const one = (text: string) => {
    const c = parseCells(text);
    return c && c.length === 1 ? c[0] : undefined;
  };

  return (
    <div className="ed-quest" data-testid="features-panel">
      <section>
        <div className="lbl">How the heroes leave</div>
        <label className="ed-field">
          Words, for example "through the cave". Empty: by the stairs.
          <input
            aria-label="Leave"
            key={quest.leave ?? ''}
            defaultValue={quest.leave ?? ''}
            onBlur={(e) => {
              if (e.target.value.trim() !== (quest.leave ?? ''))
                st.apply((q) => setLeave(q, e.target.value));
            }}
          />
        </label>
      </section>

      <section>
        <div className="lbl">Ice tunnels</div>
        {quest.tunnels.map((t) => (
          <div className="ed-row-head" key={t.id} data-testid="tunnel-row">
            <span>
              Design {t.design}: {cellText(t.a)} to {cellText(t.b)}
            </span>
            <button
              className="chip"
              aria-label={`Remove tunnel ${t.design}`}
              onClick={() => st.apply((q) => removeTunnel(q, t.id))}
            >
              Remove
            </button>
          </div>
        ))}
        <div className="ed-row">
          <label className="ed-field">
            Design (1 to 9)
            <input
              aria-label="Tunnel design"
              value={tunnel.design}
              onChange={(e) => setTunnel({ ...tunnel, design: e.target.value })}
            />
          </label>
          <label className="ed-field">
            End A (x,y)
            <input
              aria-label="Tunnel end A"
              value={tunnel.a}
              onChange={(e) => setTunnel({ ...tunnel, a: e.target.value })}
            />
          </label>
          <label className="ed-field">
            End B (x,y)
            <input
              aria-label="Tunnel end B"
              value={tunnel.b}
              onChange={(e) => setTunnel({ ...tunnel, b: e.target.value })}
            />
          </label>
          <button
            className="btn"
            onClick={() => {
              const a = one(tunnel.a);
              const b = one(tunnel.b);
              if (!a || !b) return setBad('Type each end as x,y.');
              setBad('');
              if (st.apply((q) => addTunnel(q, { design: Number(tunnel.design), a, b })))
                setTunnel({ design: String(Number(tunnel.design) + 1), a: '', b: '' });
            }}
          >
            Add a tunnel
          </button>
        </div>
      </section>

      <section>
        <div className="lbl">Tiles on squares</div>
        {quest.boardTiles.map((t, i) => (
          <div className="ed-row-head" key={i} data-testid="tile-row">
            <span>
              {BOARD_TILES[t.type].name}: {t.cells.length} squares
              {t.hiddenWhen ? `, gone when ${t.hiddenWhen}` : ''}
              {t.blocks ? ', blocks' : ''}
            </span>
            <button
              className="chip"
              aria-label={`Remove tile ${i + 1}`}
              onClick={() => st.apply((q) => removeBoardTile(q, i))}
            >
              Remove
            </button>
          </div>
        ))}
        <div className="ed-row">
          <label className="ed-field">
            Tile
            <select
              aria-label="Tile type"
              value={tile.type}
              onChange={(e) => setTile({ ...tile, type: e.target.value as typeof tile.type })}
            >
              {BOARD_TILE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {BOARD_TILES[t].name}
                </option>
              ))}
            </select>
          </label>
          <label className="ed-field">
            Squares (x,y x,y or x0,y0-x1,y1)
            <input
              aria-label="Tile squares"
              value={tile.cells}
              onChange={(e) => setTile({ ...tile, cells: e.target.value })}
            />
          </label>
          <label className="ed-field">
            Gone when this flag is set (optional)
            <input
              aria-label="Tile flag"
              value={tile.hiddenWhen}
              onChange={(e) => setTile({ ...tile, hiddenWhen: e.target.value })}
            />
          </label>
          <label className="ed-field">
            <span>
              <input
                type="checkbox"
                aria-label="Tile blocks"
                checked={tile.blocks}
                onChange={(e) => setTile({ ...tile, blocks: e.target.checked })}
              />{' '}
              Blocks sight and squares until then
            </span>
          </label>
          <button
            className="btn"
            onClick={() => {
              const cells = parseCells(tile.cells);
              if (!cells) return setBad('Type squares as x,y, or a block as x0,y0-x1,y1.');
              setBad('');
              if (
                st.apply((q) =>
                  addBoardTile(q, {
                    type: tile.type,
                    cells,
                    hiddenWhen: tile.hiddenWhen,
                    blocks: tile.blocks,
                  }),
                )
              )
                setTile({ ...tile, cells: '' });
            }}
          >
            Add a tile
          </button>
        </div>
      </section>

      <section>
        <div className="lbl">Tiles in rooms</div>
        {quest.roomTiles.map((t) => (
          <div className="ed-row-head" key={t.area} data-testid="room-tile-row">
            <span>
              {t.area}: {ROOM_TILES[t.type].name}
            </span>
            <button
              className="chip"
              aria-label={`Remove the tile of ${t.area}`}
              onClick={() => st.apply((q) => setRoomTile(q, t.area, null))}
            >
              Remove
            </button>
          </div>
        ))}
        <div className="ed-row">
          <label className="ed-field">
            Room (R01 to R22)
            <input
              aria-label="Tile room"
              value={room.area}
              onChange={(e) => setRoom({ ...room, area: e.target.value.toUpperCase() })}
            />
          </label>
          <label className="ed-field">
            Tile
            <select
              aria-label="Room tile type"
              value={room.type}
              onChange={(e) => setRoom({ ...room, type: e.target.value as typeof room.type })}
            >
              {ROOM_TILE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {ROOM_TILES[t].name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="btn"
            onClick={() => {
              if (st.apply((q) => setRoomTile(q, room.area, room.type))) setBad('');
            }}
          >
            Put the tile in the room
          </button>
        </div>
      </section>

      <section>
        <div className="lbl">Edge doors and the start</div>
        {quest.edgeDoors.map((e) => (
          <div className="ed-row-head" key={e.id} data-testid="edge-row">
            <span>
              {EDGE_NAMES[e.kind]} at {cellText(e.cell)}, side {e.side}
              {quest.start.door === e.id ? ' (the heroes start outside it)' : ''}
            </span>
            {e.kind === 'ironEntry' && quest.start.door !== e.id && (
              <button
                className="chip"
                aria-label={`Start outside ${e.id}`}
                onClick={() => st.apply((q) => setStart(q, { door: e.id }))}
              >
                Start here
              </button>
            )}
            <button
              className="chip"
              aria-label={`Remove edge door ${e.id}`}
              onClick={() => st.apply((q) => removeEdgeDoor(q, e.id))}
            >
              Remove
            </button>
          </div>
        ))}
        <div className="ed-row">
          <label className="ed-field">
            Door square (x,y)
            <input
              aria-label="Edge door square"
              value={edge.cell}
              onChange={(e) => setEdge({ ...edge, cell: e.target.value })}
            />
          </label>
          <label className="ed-field">
            Board edge
            <select
              aria-label="Edge door side"
              value={edge.side}
              onChange={(e) => setEdge({ ...edge, side: e.target.value as typeof edge.side })}
            >
              <option value="n">North</option>
              <option value="e">East</option>
              <option value="s">South</option>
              <option value="w">West</option>
            </select>
          </label>
          <label className="ed-field">
            Kind
            <select
              aria-label="Edge door kind"
              value={edge.kind}
              onChange={(e) => setEdge({ ...edge, kind: e.target.value as typeof edge.kind })}
            >
              {EDGE_DOOR_KINDS.map((k) => (
                <option key={k} value={k}>
                  {EDGE_NAMES[k]}
                </option>
              ))}
            </select>
          </label>
          <button
            className="btn"
            onClick={() => {
              const cell = one(edge.cell);
              if (!cell) return setBad('Type the door square as x,y.');
              setBad('');
              if (st.apply((q) => addEdgeDoor(q, { cell, side: edge.side, kind: edge.kind })))
                setEdge({ ...edge, cell: '' });
            }}
          >
            Add an edge door
          </button>
        </div>
      </section>

      <section>
        <div className="lbl">Door flags</div>
        <p className="ed-note">
          A hidden door is not drawn, and a locked door will not open, until the flag is set by an
          action.
        </p>
        {quest.doors.map((d) => (
          <div
            className="ed-row"
            key={`${d.id}:${d.hiddenUntil ?? ''}:${d.lockedUntil ?? ''}`}
            data-testid="door-flag-row"
          >
            <span>Door {d.id}</span>
            <label className="ed-field">
              Hidden until
              <input
                aria-label={`Door ${d.id} hidden until`}
                defaultValue={d.hiddenUntil ?? ''}
                onBlur={(e) => {
                  if (e.target.value.trim() !== (d.hiddenUntil ?? ''))
                    st.apply((q) => setDoorFlags(q, d.id, { hiddenUntil: e.target.value }));
                }}
              />
            </label>
            <label className="ed-field">
              Locked until
              <input
                aria-label={`Door ${d.id} locked until`}
                defaultValue={d.lockedUntil ?? ''}
                onBlur={(e) => {
                  if (e.target.value.trim() !== (d.lockedUntil ?? ''))
                    st.apply((q) => setDoorFlags(q, d.id, { lockedUntil: e.target.value }));
                }}
              />
            </label>
          </div>
        ))}
      </section>

      {bad && (
        <p className="ed-note" role="alert">
          {bad}
        </p>
      )}
    </div>
  );
}
