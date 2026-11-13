import { useEffect, useMemo, useState } from 'react';
import { useStore } from 'zustand';
import { keyOf } from '../../engine/board/level';
import { MONSTER_NAMES } from '../../engine/data/monsters';
import { monstersInPlay, type MonsterView } from '../../engine/game/view';
import { CELL } from '../board/BoardView';
import { PlayBoard } from '../board/PlayBoard';
import { MarginNote } from '../shared/MarginNote';
import type { GameStore } from '../store/gameStore';
import { monsterCodes } from './monsterCodes';
import { parseSelection, type Selection } from './selection';

const MAP_PAD_X = 28;
const MAP_PAD_Y = 18;
/** The svg viewBox starts at -2, so every board point is shifted by 2 px. */
const toMap = (bx: number, by: number) => ({
  x: MAP_PAD_X + 2 + bx * CELL,
  y: MAP_PAD_Y + 2 + by * CELL,
});

export interface PlayScreenProps {
  store: GameStore;
  onLeave(): void;
  /** Initial selection, for screenshots (`?select=`). */
  initialSelect?: string | null;
}

export function PlayScreen({ store, onLeave, initialSelect = null }: PlayScreenProps) {
  const { level, state, events, fx, toast } = useStore(store);
  const { dispatch, undo, dismissToast } = store.getState();
  const { quest } = level;
  const codes = useMemo(() => monsterCodes(level, state.seenMonsters), [level, state.seenMonsters]);
  const monsters = useMemo(() => monstersInPlay(level, state), [level, state]);
  const [sel, setSel] = useState<Selection | null>(() => parseSelection(initialSelect));

  // Toasts go away on their own.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(dismissToast, 3200);
    return () => clearTimeout(t);
  }, [toast, dismissToast]);

  const monsterOf = (id: string) => monsters.find((m) => m.id === id);
  const cellOfMonster = (id: string) => level.quest.monsters.find((m) => m.id === id)?.cell;

  // A tap on the map (not on a tappable object or a note) closes the note.
  const onRootClick = (e: React.MouseEvent) => {
    if ((e.target as Element).closest('[data-hit],[data-keep]')) return;
    setSel(null);
  };

  const act = (event: Parameters<typeof dispatch>[0]) => {
    setSel(null);
    dispatch(event);
  };

  const alive = monsters.filter((m) => !m.dead);
  const wandering = quest.wandering;

  let note: React.ReactNode = null;
  if (sel?.kind === 'door') {
    const d = level.doors.get(sel.id);
    if (d && state.seenDoors.has(sel.id) && !state.openDoors.has(sel.id)) {
      const vertical = d.a[1] === d.b[1];
      const anchor = toMap(
        vertical ? Math.max(d.a[0], d.b[0]) : d.a[0] + 0.5,
        vertical ? d.a[1] + 0.5 : Math.max(d.a[1], d.b[1]),
      );
      const both = state.seenCells.has(keyOf(d.a)) && state.seenCells.has(keyOf(d.b));
      note = (
        <MarginNote
          anchor={anchor}
          kind="Closed door"
          title="Open this door?"
          onClose={() => setSel(null)}
        >
          <p>{both ? 'Both sides are explored.' : 'Opening is free. You see what is behind it.'}</p>
          <button className="btn" onClick={() => act({ type: 'OPEN_DOOR', door: sel.id })}>
            Open the door
          </button>
        </MarginNote>
      );
    }
  } else if (sel?.kind === 'cell') {
    note = (
      <MarginNote
        anchor={toMap(sel.at[0] + 0.5, sel.at[1] + 0.5)}
        kind="Corridor"
        title="A hero stands here"
        onClose={() => setSel(null)}
      >
        <p>Show everything this hero can see along the corridors.</p>
        <button className="btn" onClick={() => act({ type: 'LOOK_FROM', cell: sel.at })}>
          Look from here
        </button>
      </MarginNote>
    );
  } else if (sel?.kind === 'monster') {
    const m = monsterOf(sel.id);
    const c = cellOfMonster(sel.id);
    if (m && !m.dead && c) {
      note = (
        <MarginNote
          anchor={toMap(c[0] + 0.5, c[1] + 0.5)}
          kind={`${codes.get(m.id)} · ${m.name}`}
          title={`Move ${m.stats.move} · Att ${m.stats.att} · Def ${m.stats.def}`}
          onClose={() => setSel(null)}
        >
          <p>
            Body {m.body} of {m.maxBody} · Mind {m.stats.mind}
          </p>
          {m.maxBody > 1 && (
            <div className="row">
              <button
                className="btn alt"
                disabled={m.body <= 1}
                onClick={() => dispatch({ type: 'MONSTER_DAMAGE', monster: m.id, amount: 1 })}
              >
                Wound -1
              </button>
              <button
                className="btn alt"
                disabled={m.body >= m.maxBody}
                onClick={() => dispatch({ type: 'MONSTER_HEAL', monster: m.id, amount: 1 })}
              >
                Heal +1
              </button>
            </div>
          )}
          <button className="btn" onClick={() => act({ type: 'MONSTER_KILL', monster: m.id })}>
            Slain
          </button>
        </MarginNote>
      );
    }
  }

  return (
    <div className="app play" onClick={onRootClick}>
      <header>
        <span className="qn">Quest {quest.number}</span>
        <h1>{quest.title}</h1>
        <span className="turn">
          Turn <b>{state.turn}</b>
        </span>
        <button className="link" disabled={events.length === 0} onClick={() => undo()}>
          Undo
        </button>
        <button className="link" onClick={onLeave}>
          Quests
        </button>
      </header>

      <div className="map">
        <PlayBoard
          level={level}
          state={state}
          fx={fx}
          codes={codes}
          selection={sel}
          onSelect={setSel}
        />
        {note}
      </div>

      <aside>
        <section className="goal">
          <div className="lbl">Your goal</div>
          {quest.objectives.length > 0 ? (
            quest.objectives.map((o) => <p key={o.id}>{o.text}.</p>)
          ) : (
            <p>{quest.intro.summary}</p>
          )}
        </section>
        {quest.zargonInfo && <p className="zinfo">{quest.zargonInfo}</p>}
        <section>
          <div className="lbl">Monsters in play</div>
          <ul className="roster">
            {monsters.length === 0 && <li className="empty">No monster in sight.</li>}
            {monsters.map((m) => (
              <RosterRow
                key={m.id}
                m={m}
                code={codes.get(m.id) ?? ''}
                fresh={fx?.freshMonsters.includes(m.id) ?? false}
                selected={sel?.kind === 'monster' && sel.id === m.id}
                onTap={() => setSel({ kind: 'monster', id: m.id })}
              />
            ))}
          </ul>
        </section>
        {wandering && (
          <p className="wander">
            Wandering monster:{' '}
            <b>{'monster' in wandering ? MONSTER_NAMES[wandering.monster] : wandering.text}</b>
          </p>
        )}
        {/* M5 replaces this with the Zargon page (orders per monster). For now it ends the turn. */}
        <button className="zargon-btn" onClick={() => dispatch({ type: 'ZARGON_TURN_END' })}>
          Zargon&apos;s turn
          <small>
            {alive.length === 0
              ? 'no monster in sight'
              : `${alive.length} monster${alive.length > 1 ? 's' : ''} to act`}
          </small>
        </button>
      </aside>

      {toast && (
        <div className="toast" role="status" key={toast.id}>
          {toast.text}
          {toast.undo && <button onClick={() => undo()}>Undo</button>}
        </div>
      )}
    </div>
  );
}

function RosterRow({
  m,
  code,
  fresh,
  selected,
  onTap,
}: {
  m: MonsterView;
  code: string;
  fresh: boolean;
  selected: boolean;
  onTap(): void;
}) {
  return (
    <li
      className={[fresh ? 'new' : '', selected ? 'sel' : '', m.dead ? 'dead' : ''].join(' ').trim()}
    >
      <button data-hit disabled={m.dead} onClick={onTap}>
        <span className={'coin' + (m.dead ? ' off' : '')}>{code}</span>
        <span>
          <span className="nm">{m.name}</span>
          <br />
          <span className="st">
            Move {m.stats.move} · Att {m.stats.att} · Def {m.stats.def}
          </span>
        </span>
        <span className="bp">{m.dead ? 'Slain' : `${m.body}/${m.maxBody}`}</span>
      </button>
    </li>
  );
}
