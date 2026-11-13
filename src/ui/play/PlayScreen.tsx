import { useEffect, useMemo, useState } from 'react';
import { useStore } from 'zustand';
import { areaAt } from '../../engine/board/board';
import { keyOf, parseKey } from '../../engine/board/level';
import { HERO_NAMES, type Hero } from '../../engine/data/heroes';
import { MONSTER_NAMES } from '../../engine/data/monsters';
import type { GameEvent } from '../../engine/game/events';
import type { Prompt } from '../../engine/game/prompts';
import {
  chestsInView,
  endSummary,
  enterableAreas,
  journal,
  manualTriggers,
  monstersInPlay,
  npcsInPlay,
  objectivesStatus,
  pendingChoice,
  searchState,
  trapsInView,
  type MonsterView,
} from '../../engine/game/view';
import { CELL } from '../board/BoardView';
import { PlayBoard } from '../board/PlayBoard';
import { MarginNote } from '../shared/MarginNote';
import { NoteCard } from '../shared/NoteCard';
import type { GameStore } from '../store/gameStore';
import { monsterCodes } from './monsterCodes';
import { sheetsOf } from './promptToasts';
import { wanderAskLines } from './texts';
import { Helpers, Journal, Objectives, QuestActions } from './sidebar';
import {
  ChestBody,
  headingOf,
  PickHero,
  ResultBody,
  resultPrompts,
  RoomMenu,
  TrapMenu,
  trapStepBody,
} from './notes';
import { parseSelection, type Selection } from './selection';
import { progressLabel } from './zargonView';
import { ZargonPage } from './ZargonPage';
import { turnProgress } from '../../engine/zargon';

const MAP_PAD_X = 28;
const MAP_PAD_Y = 18;
/** The svg viewBox starts at -2, so every board point is shifted by 2 px. */
const toMap = (bx: number, by: number) => ({
  x: MAP_PAD_X + 2 + bx * CELL,
  y: MAP_PAD_Y + 2 + by * CELL,
});

type Anchor = { x: number; y: number };
type Step =
  | { t: 'menu' }
  | { t: 'pick'; what: 'treasure' | 'secret'; override: boolean; blocked?: boolean }
  | { t: 'jump' | 'who' | 'dwarf' | 'kit' }
  | { t: 'chestOverride' };
interface Result {
  prompts: readonly Prompt[];
  anchor: Anchor;
  hero?: Hero;
  room?: string;
  /** Showing the question "was there a free square?" for a wandering monster. */
  ask?: boolean;
  /** The answer, for the result card. */
  adjacent?: boolean;
}

/** Small heading of a result sheet. */
function resultKind(prompts: readonly Prompt[]): string {
  const has = (...kinds: Prompt['kind'][]) => prompts.some((p) => kinds.includes(p.kind));
  if (has('trapSprung', 'trapJumped', 'trapDisarmed')) return 'Trap';
  if (has('wanderingMonster', 'wanderingText')) return 'Wandering monster';
  if (has('secretDoorsFound', 'nothingFound')) return 'Secret doors';
  if (has('trapFound', 'noTrap')) return 'Chest';
  return 'Treasure';
}

export interface PlayScreenProps {
  store: GameStore;
  onLeave(): void;
  /** Initial selection, for screenshots (`?select=`). */
  initialSelect?: string | null;
}

export function PlayScreen({ store, onLeave, initialSelect = null }: PlayScreenProps) {
  const { level, state, events, fx, toast, team, prompts, promptsSeq } = useStore(store);
  const { dispatch, undo, dismissToast } = store.getState();
  const { quest } = level;
  const codes = useMemo(
    () => monsterCodes(level, state.seenMonsters, state.wanderers),
    [level, state.seenMonsters, state.wanderers],
  );
  const monsters = useMemo(() => monstersInPlay(level, state), [level, state]);
  const traps = useMemo(() => trapsInView(level, state), [level, state]);
  const [sel, setSel] = useState<Selection | null>(() => parseSelection(initialSelect));
  const [step, setStep] = useState<Step>({ t: 'menu' });
  const [res, setRes] = useState<Result | null>(null);
  const [sheetPos, setSheetPos] = useState({ seq: -1, i: 0 });
  const [reread, setReread] = useState<string | null>(null);
  const [endOpen, setEndOpen] = useState(false);
  const [zOpen, setZOpen] = useState(false);
  const progress = useMemo(() => turnProgress(level, state), [level, state]);

  // Sheets from the last event (notes, monsters to place), shown one after the other.
  const sheets = useMemo(() => sheetsOf(prompts), [prompts]);
  const sheetI = sheetPos.seq === promptsSeq ? sheetPos.i : 0;
  const sheet = sheets[sheetI];
  const nextSheet = () => setSheetPos({ seq: promptsSeq, i: sheetI + 1 });
  const pending = pendingChoice(state);
  const end = endSummary(level, state);
  const objectives = useMemo(() => objectivesStatus(level, state), [level, state]);
  const journalEntries = useMemo(() => journal(level, state), [level, state]);
  const npcs = useMemo(() => npcsInPlay(level, state), [level, state]);
  const manual = useMemo(() => manualTriggers(level, state), [level, state]);
  const enterable = useMemo(() => enterableAreas(level, state), [level, state]);

  const choose = (next: Selection | null) => {
    setSel(next);
    setStep({ t: 'menu' });
    setRes(null);
  };
  const closeNote = () => choose(null);

  // Toasts go away on their own.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(dismissToast, 3200);
    return () => clearTimeout(t);
  }, [toast, dismissToast]);

  const monsterOf = (id: string) => monsters.find((m) => m.id === id);
  const cellOfMonster = (id: string) =>
    state.placedMonsterCells[id] ?? level.quest.monsters.find((m) => m.id === id)?.cell;

  // A tap on the map (not on a tappable object or a note) closes the note.
  const onRootClick = (e: React.MouseEvent) => {
    if ((e.target as Element).closest('[data-hit],[data-keep]')) return;
    choose(null);
  };

  const act = (event: GameEvent) => {
    choose(null);
    dispatch(event);
  };

  const roomAnchor = (room: string): Anchor => {
    let x0 = 99;
    let x1 = -1;
    let y0 = 99;
    for (const k of state.seenCells) {
      const [x, y] = parseKey(k);
      if (areaAt(level.board, x, y) !== room) continue;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
    }
    return toMap((x0 + x1 + 1) / 2, y0);
  };

  /** Run an event whose prompts are shown as a result sheet at `anchor`. */
  const run = (
    event: GameEvent,
    anchor: Anchor,
    ctx: { hero?: Hero; room?: string; adjacent?: boolean } = {},
  ) => {
    const ok = dispatch(event);
    if (!ok) return false;
    setSel(null);
    setStep({ t: 'menu' });
    const shown = store.getState().prompts;
    if (resultPrompts(shown).length > 0) setRes({ prompts: shown, anchor, ...ctx });
    return true;
  };

  /** A corridor search was refused because a monster is in sight: ask for the override. */
  const refused = () => {
    if (store.getState().error?.code === 'MONSTERS_IN_ROOM') {
      dismissToast();
      setStep((st) => (st.t === 'pick' ? { ...st, blocked: true } : st));
    }
  };

  const wandering = quest.wandering;

  let note: React.ReactNode = null;
  if (res?.ask && res.hero && res.room) {
    const { hero, room } = res;
    const w = quest.wandering;
    const type = w && 'monster' in w ? w.monster : undefined;
    note = (
      <MarginNote
        anchor={res.anchor}
        kind="Wandering monster"
        title={type ? `A ${MONSTER_NAMES[type]} arrives` : 'A wandering monster'}
        onClose={closeNote}
      >
        {type && wanderAskLines(type, hero).map((l, i) => <p key={i}>{l}</p>)}
        <button
          className="btn"
          onClick={() =>
            run({ type: 'WANDERING_MONSTER', room, hero, adjacent: true }, res.anchor, {
              adjacent: true,
            })
          }
        >
          Placed next to the {HERO_NAMES[hero]}
        </button>
        <button
          className="btn alt"
          onClick={() =>
            run({ type: 'WANDERING_MONSTER', room, hero, adjacent: false }, res.anchor, {
              adjacent: false,
            })
          }
        >
          No free square next to the {HERO_NAMES[hero]}
        </button>
      </MarginNote>
    );
  } else if (res) {
    const { hero, room } = res;
    const w = quest.wandering;
    const askWandering =
      hero && room && res.prompts.some((p) => p.kind === 'drawCard')
        ? () => {
            // A monster asks the placement question first; a text-only wanderer is just shown.
            if (w && 'monster' in w) setRes({ ...res, prompts: [], ask: true });
            else run({ type: 'WANDERING_MONSTER', room, hero }, res.anchor);
          }
        : undefined;
    note = (
      <MarginNote
        anchor={res.anchor}
        kind={resultKind(res.prompts)}
        title={resultPrompts(res.prompts).map((p) => headingOf(p, res.adjacent))[0] ?? 'Done'}
        onClose={closeNote}
      >
        <ResultBody
          prompts={res.prompts}
          onDone={closeNote}
          onWandering={askWandering}
          adjacent={res.adjacent ?? true}
        />
      </MarginNote>
    );
  } else if (sel?.kind === 'door') {
    const d = level.doors.get(sel.id);
    if (d && state.seenDoors.has(sel.id) && !state.openDoors.has(sel.id)) {
      const vertical = d.a[1] === d.b[1];
      const anchor = toMap(
        vertical ? Math.max(d.a[0], d.b[0]) : d.a[0] + 0.5,
        vertical ? d.a[1] + 0.5 : Math.max(d.a[1], d.b[1]),
      );
      const both = state.seenCells.has(keyOf(d.a)) && state.seenCells.has(keyOf(d.b));
      note = (
        <MarginNote anchor={anchor} kind="Closed door" title="Open this door?" onClose={closeNote}>
          <p>{both ? 'Both sides are explored.' : 'Opening is free. You see what is behind it.'}</p>
          <button className="btn" onClick={() => act({ type: 'OPEN_DOOR', door: sel.id })}>
            Open the door
          </button>
        </MarginNote>
      );
    }
  } else if (sel?.kind === 'cell') {
    const anchor = toMap(sel.at[0] + 0.5, sel.at[1] + 0.5);
    if (step.t === 'pick') {
      note = (
        <MarginNote
          anchor={anchor}
          kind="Search for secret doors"
          title="Who searches?"
          onClose={closeNote}
        >
          <PickHero
            team={team}
            searched={[]}
            monsters={[]}
            blocked={step.blocked === true}
            override={step.override}
            onOverride={() => setStep({ ...step, override: true })}
            onPick={(hero) => {
              const ok = run(
                {
                  type: 'SEARCH_SECRET_DOORS',
                  hero,
                  cell: sel.at,
                  ...(step.override ? { override: true } : {}),
                },
                anchor,
                { hero },
              );
              if (!ok) refused();
            }}
          />
        </MarginNote>
      );
    } else {
      note = (
        <MarginNote anchor={anchor} kind="Corridor" title="A hero stands here" onClose={closeNote}>
          <p>Show everything this hero can see along the corridors.</p>
          <button className="btn" onClick={() => act({ type: 'LOOK_FROM', cell: sel.at })}>
            Look from here
          </button>
          <button
            className="btn alt"
            onClick={() => setStep({ t: 'pick', what: 'secret', override: false })}
          >
            Search for secret doors
          </button>
        </MarginNote>
      );
    }
  } else if (sel?.kind === 'room') {
    const anchor = roomAnchor(sel.room);
    const ss = searchState(level, state, sel.room);
    const roomCodes = ss.monstersInRoom.map((id) => codes.get(id) ?? id);
    if (step.t === 'pick') {
      const treasure = step.what === 'treasure';
      note = (
        <MarginNote
          anchor={anchor}
          kind={treasure ? 'Search for treasure' : 'Search for secret doors'}
          title="Who searches?"
          onClose={closeNote}
        >
          <PickHero
            team={team}
            searched={treasure ? ss.searchedBy : []}
            monsters={roomCodes}
            blocked={false}
            override={step.override}
            onOverride={() => setStep({ ...step, override: true })}
            onPick={(hero) => {
              const override = step.override ? { override: true } : {};
              run(
                treasure
                  ? { type: 'SEARCH_TREASURE', room: sel.room, hero, ...override }
                  : { type: 'SEARCH_SECRET_DOORS', hero, area: sel.room, ...override },
                anchor,
                treasure ? { hero, room: sel.room } : { hero },
              );
            }}
          />
        </MarginNote>
      );
    } else {
      note = (
        <MarginNote anchor={anchor} kind="Room" title="Search this room" onClose={closeNote}>
          <RoomMenu
            onTreasure={() => setStep({ t: 'pick', what: 'treasure', override: false })}
            onSecret={() => setStep({ t: 'pick', what: 'secret', override: false })}
            onEnter={
              enterable.includes(sel.room)
                ? () => act({ type: 'AREA_ENTER', area: sel.room })
                : undefined
            }
          />
        </MarginNote>
      );
    }
  } else if (sel?.kind === 'square') {
    note = (
      <MarginNote
        anchor={toMap(sel.at[0] + 0.5, sel.at[1] + 0.5)}
        kind="Square with a note"
        title="Did a hero step here?"
        onClose={closeNote}
      >
        <button className="btn" onClick={() => act({ type: 'SQUARE_TRIGGER', cell: sel.at })}>
          Yes
        </button>
        <button className="btn alt" onClick={closeNote}>
          No
        </button>
      </MarginNote>
    );
  } else if (sel?.kind === 'trap') {
    const tv = traps.find((t) => t.id === sel.id);
    if (tv && tv.onMap) {
      const anchor = toMap(tv.cell[0] + 0.5, tv.cell[1] + 0.5);
      const onFurniture = tv.furniture !== undefined;
      const sprung = tv.state === 'sprung';
      const spring = (event: GameEvent) => run(event, anchor);
      if (step.t === 'jump' || step.t === 'who' || step.t === 'dwarf' || step.t === 'kit') {
        const b = trapStepBody({
          step: step.t,
          hasDwarf: team.includes('dwarf'),
          onJump: (result) => spring({ type: 'TRAP_JUMP', trap: tv.id, result }),
          onWho: (who) => setStep({ t: who }),
          onDisarm: (by, result) => spring({ type: 'TRAP_DISARM', trap: tv.id, by, result }),
        });
        note = (
          <MarginNote anchor={anchor} kind={b.kind} title={b.title} onClose={closeNote}>
            {b.body}
          </MarginNote>
        );
      } else {
        note = (
          <MarginNote
            anchor={anchor}
            kind={sprung ? 'Pit' : 'Trap'}
            title={sprung ? 'Someone fell in here' : 'Something is wrong here'}
            onClose={closeNote}
          >
            <TrapMenu
              sprung={sprung}
              canJump={!onFurniture}
              canDisarm={!sprung}
              canStep={!onFurniture}
              onJump={() => setStep({ t: 'jump' })}
              onDisarm={() => setStep({ t: 'who' })}
              onStep={() => spring({ type: 'TRAP_STEP', trap: tv.id })}
            />
          </MarginNote>
        );
      }
    }
  } else if (sel?.kind === 'chest') {
    const cv = chestsInView(level, state).find((c) => c.id === sel.id);
    if (cv) {
      const xs = cv.cells.map((c) => c[0]);
      const ys = cv.cells.map((c) => c[1]);
      const anchor = toMap(
        (Math.min(...xs) + Math.max(...xs) + 1) / 2,
        (Math.min(...ys) + Math.max(...ys) + 1) / 2,
      );
      const found = traps.find((t) => t.furniture === cv.id && t.state === 'armed');
      const roomCodes = searchState(level, state, cv.room).monstersInRoom.map(
        (id) => codes.get(id) ?? id,
      );
      note = (
        <MarginNote anchor={anchor} kind="Chest" title="Look for traps" onClose={closeNote}>
          <ChestBody
            searched={cv.searched}
            trapFound={cv.trapFound}
            monsters={roomCodes}
            override={step.t === 'chestOverride'}
            onOverride={() => setStep({ t: 'chestOverride' })}
            onSearch={() =>
              run(
                {
                  type: 'SEARCH_TRAPS',
                  furniture: cv.id,
                  ...(step.t === 'chestOverride' ? { override: true } : {}),
                },
                anchor,
              )
            }
            onDisarm={() => {
              if (!found) return;
              setSel({ kind: 'trap', id: found.id });
              setStep({ t: 'who' });
            }}
          />
        </MarginNote>
      );
    }
  } else if (sel?.kind === 'monster') {
    const m = monsterOf(sel.id);
    const c = cellOfMonster(sel.id);
    if (m && !m.dead) {
      note = (
        <MarginNote
          anchor={c ? toMap(c[0] + 0.5, c[1] + 0.5) : { x: 880, y: 120 }}
          kind={`${codes.get(m.id)} · ${m.name}`}
          title={`Move ${m.stats.move} · Att ${m.stats.att} · Def ${m.stats.def}`}
          onClose={closeNote}
        >
          {m.wandering && (
            <p className="warn">
              {m.fresh
                ? `Wandering · next to the ${HERO_NAMES[m.wanderAt as Hero]}`
                : 'Wandering monster'}
            </p>
          )}
          {m.state === 'stone' && (
            <p className="warn">
              {m.stoneTurns !== undefined ? `Stone: ${m.stoneTurns} turns` : 'Stone'}. It does not
              act.
            </p>
          )}
          {m.placeAt && <p className="warn">Placed by a quest note.</p>}
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
        <button className="link" onClick={() => setEndOpen(true)}>
          End quest
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
          onSelect={choose}
          onLetter={(id) => setReread(id)}
          highlight={sheet?.t === 'place' && sheet.p.cell ? [sheet.p.cell] : []}
        />
        {sheet?.t === 'place' && sheet.p.cell ? (
          <MarginNote
            anchor={toMap(sheet.p.cell[0] + 0.5, sheet.p.cell[1] + 0.5)}
            kind="New monster"
            title={`Put ${sheet.p.name} here`}
            onClose={nextSheet}
          >
            <p>Put the {MONSTER_NAMES[sheet.p.monsterType]} on the marked square.</p>
            <button className="btn" onClick={nextSheet}>
              Done
            </button>
          </MarginNote>
        ) : (
          note
        )}
      </div>

      <aside>
        <Objectives view={objectives} intro={quest.intro.summary} />
        <div className="aside-scroll">
          {quest.zargonInfo && <p className="zinfo">{quest.zargonInfo}</p>}
          <Helpers npcs={npcs} />
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
                  acted={state.doneThisTurn.includes(m.id)}
                  selected={sel?.kind === 'monster' && sel.id === m.id}
                  onTap={() => choose({ kind: 'monster', id: m.id })}
                />
              ))}
            </ul>
          </section>
          <Journal entries={journalEntries} onRead={(id) => setReread(id)} />
          <QuestActions
            actions={manual}
            onPress={(note) => dispatch({ type: 'MANUAL_TRIGGER', note })}
          />
        </div>
        {wandering && (
          <p className="wander">
            Wandering monster:{' '}
            <b>{'monster' in wandering ? MONSTER_NAMES[wandering.monster] : wandering.text}</b>
          </p>
        )}
        <button className="zargon-btn" onClick={() => setZOpen(true)}>
          Zargon&apos;s turn
          <small>{progressLabel(progress)}</small>
        </button>
      </aside>

      <ZargonPage
        open={zOpen && !end}
        level={level}
        state={state}
        team={team}
        codes={codes}
        dispatch={dispatch}
        onClose={() => setZOpen(false)}
        onEndTurn={() => {
          setZOpen(false);
          dispatch({ type: 'ZARGON_TURN_END' });
        }}
      />

      {end ? (
        <EndScreen end={end} title={quest.title} onLeave={onLeave} onUndo={() => undo()} />
      ) : sheet?.t === 'note' ? (
        <NoteSheet p={sheet.p} onClose={nextSheet} />
      ) : pending ? (
        <NoteCard kind="Quest note" title="Choose">
          <p>{pending.text}</p>
          {pending.options.map((o, i) => (
            <button
              key={i}
              className={i === 0 ? 'btn' : 'btn alt'}
              onClick={() => dispatch({ type: 'CHOOSE', note: pending.note, option: i })}
            >
              {o.label}
            </button>
          ))}
        </NoteCard>
      ) : reread ? (
        <RereadSheet
          entry={journalEntries.find((e) => e.id === reread)}
          onClose={() => setReread(null)}
        />
      ) : endOpen ? (
        <NoteCard kind="End quest" title="How did the quest end?" onClose={() => setEndOpen(false)}>
          <button
            className="btn"
            onClick={() => {
              setEndOpen(false);
              dispatch({ type: 'END_QUEST', outcome: 'stairs' });
            }}
          >
            Heroes left by the stairs
          </button>
          <button
            className="btn alt"
            onClick={() => {
              setEndOpen(false);
              dispatch({ type: 'END_QUEST', outcome: 'fell' });
            }}
          >
            All heroes fell
          </button>
          <button className="btn alt" onClick={() => setEndOpen(false)}>
            Keep playing
          </button>
        </NoteCard>
      ) : null}

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
  acted,
  selected,
  onTap,
}: {
  m: MonsterView;
  code: string;
  fresh: boolean;
  /** Marked done on the Zargon page this turn. */
  acted: boolean;
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
          <span className="st">{rosterLine(m)}</span>
        </span>
        <span className="bp">
          {acted && !m.dead && (
            <span className="tickdone" title="Done this turn">
              ✓
            </span>
          )}
          {m.dead ? 'Slain' : `${m.body}/${m.maxBody}`}
        </span>
      </button>
    </li>
  );
}

function rosterLine(m: MonsterView): string {
  if (m.state === 'stone')
    return m.stoneTurns !== undefined ? `Stone: ${m.stoneTurns} turns` : 'Stone';
  if (m.wandering && m.fresh) return `Wandering · next to the ${HERO_NAMES[m.wanderAt as Hero]}`;
  if (m.placeAt) return 'Placed by a quest note';
  return `Move ${m.stats.move} · Att ${m.stats.att} · Def ${m.stats.def}`;
}

function NoteSheet({ p, onClose }: { p: Extract<Prompt, { kind: 'note' }>; onClose(): void }) {
  return (
    <NoteCard
      letter={p.letter}
      kind="Quest note"
      title={p.title ?? (p.letter ? `Note ${p.letter}` : 'Quest note')}
      onClose={onClose}
    >
      {p.texts.map((t, i) => (
        <p key={i}>{t}</p>
      ))}
      <button className="btn" onClick={onClose}>
        Continue
      </button>
    </NoteCard>
  );
}

function RereadSheet({
  entry,
  onClose,
}: {
  entry: ReturnType<typeof journal>[number] | undefined;
  onClose(): void;
}) {
  if (!entry) return null;
  return (
    <NoteCard
      letter={entry.letter}
      kind="Quest note"
      title={entry.title ?? 'Read again'}
      onClose={onClose}
    >
      {entry.texts.map((t, i) => (
        <p key={i}>{t}</p>
      ))}
      {entry.choices.map((c, i) => (
        <p key={i} className="extra">
          {c.text} You chose: {c.picked}.{c.texts.length > 0 ? ` ${c.texts.join(' ')}` : ''}
        </p>
      ))}
      <button className="btn" onClick={onClose}>
        Close
      </button>
    </NoteCard>
  );
}

function EndScreen({
  end,
  title,
  onLeave,
  onUndo,
}: {
  end: NonNullable<ReturnType<typeof endSummary>>;
  title: string;
  onLeave(): void;
  onUndo(): void;
}) {
  return (
    <NoteCard kind={title} title={end.won ? 'Quest complete' : 'Quest over, goal not reached'}>
      <p>
        {end.outcome === 'fell' ? 'All the heroes fell.' : 'The heroes left by the stairs.'}{' '}
        {end.goalDone ? 'The goal was done.' : 'The goal was not done.'}
      </p>
      <ul className="goals end-goals">
        {end.objectives.map((o) => (
          <li key={o.id} className={o.done ? 'done' : ''}>
            <span className="tick" aria-hidden="true">
              {o.done ? '✓' : ''}
            </span>
            <span>
              {o.text}
              <span className="sr"> {o.done ? '(done)' : '(not done)'}</span>
            </span>
          </li>
        ))}
      </ul>
      {end.rewards && <p className="extra">Rewards: {end.rewards}</p>}
      <button className="btn" onClick={onLeave}>
        Back to the quests
      </button>
      <button className="btn alt" onClick={onUndo}>
        Undo the ending
      </button>
    </NoteCard>
  );
}
