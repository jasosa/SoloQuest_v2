import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useStore } from 'zustand';
import { areaAt } from '../../engine/board/board';
import { keyOf, parseKey } from '../../engine/board/level';
import { namer } from '../../engine/data/team';
import { MONSTER_NAMES } from '../../engine/data/monsters';
import { MONSTER_TYPES, type MonsterType } from '../../engine/quest/schema';
import type { GameEvent } from '../../engine/game/events';
import { lookHintCells } from '../../engine/game/hints';
import type { Prompt } from '../../engine/game/prompts';
import {
  availableEndings,
  chestsInView,
  endSummary,
  goalDoneText,
  leaveWay,
  enterableAreas,
  journal,
  livingHeroes,
  manualTriggers,
  elementQuest,
  squareMarkers,
  zoneLabels,
  eventLog,
  objectiveConfirms,
  startTexts,
  monstersInPlay,
  npcsInPlay,
  objectivesStatus,
  pendingChoice,
  searchState,
  trapsInView,
  boardTilesAt,
  boardTilesInArea,
  type MonsterView,
} from '../../engine/game/view';
import { CELL } from '../board/BoardView';
import { furnitureName } from '../board/furnitureNames';
import { PlayBoard } from '../board/PlayBoard';
import { MarginNote } from '../shared/MarginNote';
import { NoteCard } from '../shared/NoteCard';
import type { GameStore } from '../store/gameStore';
import { TRAP_NAMES } from './texts';
import { monsterCodes } from './monsterCodes';
import { sheetsOf } from './promptToasts';
import { additionCells } from './additions';
import type { NoteTarget } from '../../engine/quest/schema';
import { BOARD_TILES } from '../../engine/data/roomTiles';
import { unthreatenedMovement } from '../../engine/game/ruleHints';
import { liveMonstersInSight } from '../../engine/game/search';
import { putTilesText, roomTilesAt, roomTilesInArea, startTiles } from '../../engine/game/tiles';
import { useQuestSettings } from '../settings';
import { QuestSettingsCard } from '../shared/QuestSettingsCard';
import { ForThisQuest } from './ForThisQuest';
import { abilityLine, monsterTip } from './monsterTip';
import { useFitMode } from '../FitToScreen';
import { QuestSheet } from './QuestSheet';
import { ZOOM_STRIP, ZoomLayer } from './ZoomLayer';
import { Helpers, Heroes } from './sidebar';
import {
  ChestBody,
  headingOf,
  PickHero,
  SecretGuard,
  ResultBody,
  resultPrompts,
  resultStages,
  RoomMenu,
  RoomScope,
  TileRule,
  TrapMenu,
  trapStepBody,
} from './notes';
import { parseSelection, type Selection } from './selection';
import { progressLabel } from './zargonView';
import { useTheme } from '../theme/activeTheme';
import { FullMessage, ToastBox, toastMs } from '../shared/Toast';
import { useWakeLock } from '../shared/useWakeLock';
import { isThemeToken, monsterPicture } from '../theme/theme';
import { ZargonDialog } from './ZargonDialog';
import { turnSequence } from './zargonView';
import { ordersFor, turnProgress } from '../../engine/zargon';
import { RAIMENT_SETTING, settingOn } from '../../engine/pack/campaign';
import type { CampaignStore } from '../../persist/campaigns';
import { packs } from '../packs';
import { t } from '../../i18n/t';

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
  hero?: string;
  room?: string;
  /** Which part of the result is shown: a trap first, then the rest of the search. */
  stage?: number;
}

/** Small heading of a result sheet. */
function resultKind(prompts: readonly Prompt[]): string {
  const has = (...kinds: Prompt['kind'][]) => prompts.some((p) => kinds.includes(p.kind));
  if (has('trapSprung', 'trapJumped', 'trapDisarmed')) return 'Trap';
  if (has('wanderingMonster', 'wanderingText'))
    return t('play.PlayScreen.wanderingMonster', 'Wandering monster');
  if (has('secretDoorsFound', 'nothingFound'))
    return t('play.PlayScreen.secretDoors', 'Secret doors');
  if (has('doorStuck')) return 'Door';
  if (has('tunnelUsed')) return t('play.PlayScreen.iceTunnel', 'Ice tunnel');
  if (has('trapFound', 'noTrap')) return 'Chest';
  return 'Treasure';
}

export interface PlayScreenProps {
  store: GameStore;
  /** The campaigns of this device, for the campaign settings of the pack (decision 61). */
  campaigns?: CampaignStore | undefined;
  onLeave(): void;
  /** Initial selection, for screenshots (`?select=`). */
  initialSelect?: string | null;
  /** A playtest of a draft quest from the editor: nothing is saved, and "Zargon view" is offered. */
  playtest?: { onBack(): void };
}

export function PlayScreen({
  store,
  campaigns,
  onLeave,
  initialSelect = null,
  playtest,
}: PlayScreenProps) {
  useFitMode('fill');
  useWakeLock(true); // the tablet must not go dark between turns
  const { level, root, state, events, fx, toast, team, prompts, promptsSeq, pack, campaign } =
    useStore(store);
  const { dispatch, undo, dismissToast } = store.getState();
  const { quest } = level;
  const codes = useMemo(
    () => monsterCodes(level, state.seenMonsters, state.wanderers),
    [level, state.seenMonsters, state.wanderers],
  );
  const monsters = useMemo(() => monstersInPlay(level, state), [level, state]);
  /** Slain monsters leave the roster; the journal keeps the kill. */
  const alive = useMemo(() => monsters.filter((m) => !m.dead), [monsters]);
  const traps = useMemo(() => trapsInView(level, state), [level, state]);
  const ruleHintsOn = useQuestSettings(level.quest.id).ruleHints;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const living = useMemo(() => livingHeroes(team, state), [team, state]);
  const nameOf = useMemo(() => namer(team), [team]);
  const hints = useMemo(() => lookHintCells(level, state), [level, state]);
  const [sel, setSel] = useState<Selection | null>(() => parseSelection(initialSelect));
  const [step, setStep] = useState<Step>({ t: 'menu' });
  const [slayAsk, setSlayAsk] = useState<string | null>(null);
  /** A message too long for its toast, shown whole. */
  const [fullMessage, setFullMessage] = useState<string | null>(null);
  const [res, setRes] = useState<Result | null>(null);
  const [sheetPos, setSheetPos] = useState({ seq: -1, i: 0 });
  const [reread, setReread] = useState<string | null>(null);
  const [questOpen, setQuestOpen] = useState(false);
  /** A note was re-read from the Quest sheet: reopen the sheet when it closes. */
  const [backToSheet, setBackToSheet] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [zOpen, setZOpen] = useState(false);
  // Playtest only: show what the heroes cannot see. A view option, never a game event.
  const [zargonView, setZargonView] = useState(false);
  const progress = useMemo(() => turnProgress(level, state), [level, state]);
  // Info dialogs (stone, fresh wanderer) that were read this turn. UI-local, no event.
  const [read, setRead] = useState<{ turn: number; ids: readonly string[] }>({ turn: 0, ids: [] });
  const readIds = useMemo(
    () => new Set(read.turn === state.turn ? read.ids : []),
    [read, state.turn],
  );
  const settings = useQuestSettings(level.quest.id);
  // Campaign settings are kept in the campaign; a change in the popup draws the cards again.
  const [campaignTick, setCampaignTick] = useState(0);
  const manifest = pack ? packs.byId.get(pack)?.manifest : undefined;
  const raiment =
    campaign && manifest
      ? settingOn(manifest, campaigns?.get(manifest.id), RAIMENT_SETTING)
      : false;
  const orders = useMemo(
    () => ordersFor(level, state, team, undefined, { noHugInSolo: settings.soloNoHug, raiment }),
    // campaignTick: the Raiment switch was changed
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [level, state, team, settings.soloNoHug, raiment, campaignTick],
  );
  const seq = useMemo(() => turnSequence(orders, readIds), [orders, readIds]);
  // Every hero fell (decision 32).
  const allFallen = team.length > 0 && livingHeroes(team, state).length === 0;
  // The "All heroes have fallen" card shows once when it happens. After it is dismissed it stays away,
  // whatever else the players do, until an Undo brings a hero back and they fall again.
  const [fallenDismissed, setFallenDismissed] = useState(false);
  if (!allFallen && fallenDismissed) setFallenDismissed(false);

  // Sheets from the last event (notes, monsters to place), shown one after the other.
  const sheets = useMemo(() => sheetsOf(prompts), [prompts]);
  const sheetI = sheetPos.seq === promptsSeq ? sheetPos.i : 0;
  const sheet = sheets[sheetI];
  const nextSheet = () => setSheetPos({ seq: promptsSeq, i: sheetI + 1 });
  const pending = pendingChoice(state);
  const zMonster = seq.current?.order.monster;
  const end = endSummary(level, state);
  const endings = useMemo(() => availableEndings(level), [level]);
  const zActive = zOpen && !end && !sheet && !pending && !reread && !endOpen && !settingsOpen;
  const objectives = useMemo(() => objectivesStatus(level, state), [level, state]);
  const journalEntries = useMemo(() => journal(level, state), [level, state]);
  // A note that is read again can disappear (an Undo takes its event back): there is nothing to show then,
  // and it must not go on blocking the cards after it. (Setting state while rendering is the way to
  // adjust state to what changed.)
  if (reread && !journalEntries.some((e) => e.id === reread)) {
    setReread(null);
    setBackToSheet(false);
  }
  const npcs = useMemo(() => npcsInPlay(level, state), [level, state]);
  const manual = useMemo(() => manualTriggers(level, state), [level, state]);
  const confirms = useMemo(() => objectiveConfirms(level, state), [level, state]);
  /** The start note is shown under "At the start", so it is not listed again as a note read. */
  const sheetNotes = useMemo(() => {
    const starts = new Set(
      level.quest.notes
        .filter((n) => n.trigger.type === 'questStart' && n.letter === undefined)
        .map((n) => n.id),
    );
    return journalEntries.filter((e) => !starts.has(e.id));
  }, [level, journalEntries]);
  const log = useMemo(
    () => eventLog(root, state.seed, events, state.startFlags),
    [root, state.seed, events, state.startFlags],
  );
  const needsYou = confirms.length > 0 || manual.length > 0;
  /** The goal line of the title band: the first objective not done yet. */
  const goalLine = objectives.goalDone
    ? goalDoneText(level)
    : (objectives.items.find((o) => !o.done)?.text ?? '');
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
    const t = setTimeout(dismissToast, toastMs(toast.text));
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

  /** "For this quest" under the normal actions of a margin note (decision 67). */
  /** "Look from here" for a corridor square that can show more (a trap or monster may stand on it). */
  const lookButton = (at: readonly [number, number]) =>
    hints.some((c) => c[0] === at[0] && c[1] === at[1]) ? (
      <button className="btn alt" onClick={() => act({ type: 'LOOK_FROM', cell: [at[0], at[1]] })}>
        {t('play.PlayScreen.lookFromHere', 'Look from here')}
      </button>
    ) : null;
  /** One "For this quest" block for several elements (the furniture and its room). */
  const forQuestMany = (targets: readonly (readonly [NoteTarget['kind'], string])[]) => {
    const views = targets.map(([k, id]) => elementQuest(level, state, k, id));
    const view = {
      read: views.flatMap((v) => v.read),
      waiting: views.flatMap((v) => v.waiting),
      buttons: views.flatMap((v) => v.buttons),
    };
    return (
      <ForThisQuest
        view={view}
        onRead={(note) => {
          choose(null);
          setReread(note);
        }}
        onPress={(note) => act({ type: 'MANUAL_TRIGGER', note })}
      />
    );
  };
  /** Only the buttons of an element, not the notes already read. */
  const forQuestButtons = (kind: NoteTarget['kind'], id: string) => (
    <ForThisQuest
      view={{ ...elementQuest(level, state, kind, id), read: [] }}
      onRead={() => undefined}
      onPress={(note) => act({ type: 'MANUAL_TRIGGER', note })}
    />
  );
  const forQuest = (kind: NoteTarget['kind'], id: string) => (
    <ForThisQuest
      view={elementQuest(level, state, kind, id)}
      onRead={(note) => {
        choose(null);
        setReread(note);
      }}
      onPress={(note) => act({ type: 'MANUAL_TRIGGER', note })}
    />
  );

  /** The buttons of the square a re-read note's letter stands on (the letter covers the square's own tap). */
  const rereadAt = reread ? level.quest.notes.find((n) => n.id === reread)?.at : undefined;
  const rereadButtons = rereadAt ? (
    <ForThisQuest
      view={{ ...elementQuest(level, state, 'square', `${rereadAt[0]},${rereadAt[1]}`), read: [] }}
      onRead={() => undefined}
      onPress={(note) => {
        setReread(null);
        act({ type: 'MANUAL_TRIGGER', note });
      }}
    />
  ) : null;

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
  const run = (event: GameEvent, anchor: Anchor, ctx: { hero?: string; room?: string } = {}) => {
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
      // a corridor search: ask the players to confirm, as a treasure search does in a room
      setStep((st) =>
        st.t === 'pick' ? { ...st, blocked: true } : { t: 'pick', what: 'secret', override: false },
      );
    }
  };

  const wandering = quest.wandering;

  // Adding a monster in play (decision 66): the players choose a type, then tap the square they put
  // it on. A wandering monster asks for its square the same way.
  const [adding, setAdding] = useState<
    | { t: 'type'; type: MonsterType }
    | { t: 'pick'; type: MonsterType }
    | {
        t: 'wander';
        room: string;
        hero: string;
        anchor: Anchor;
        total: number;
        cells: [number, number][];
      }
    | null
  >(null);
  // Show room (decision 66): a free tool, with a warning, that draws a room or corridor without contents.
  const [showRoom, setShowRoom] = useState<'warn' | 'pick' | null>(null);
  const pickedRoom = (cell: readonly [number, number]) => {
    if (dispatch({ type: 'SHOW_LAYOUT', cell: [cell[0], cell[1]] })) setShowRoom(null);
  };
  const pickedCell = (picked: readonly [number, number]) => {
    const cell: [number, number] = [picked[0], picked[1]];
    if (!adding) return;
    if (adding.t === 'pick') {
      if (
        run(
          { type: 'ADD_MONSTER', monsterType: adding.type, cell },
          toMap(cell[0] + 0.5, cell[1] + 0.5),
        )
      )
        setAdding(null);
    } else if (adding.t === 'wander') {
      // One square per monster of the card (the quest's `count`), then one event.
      const cells = [...adding.cells, cell];
      if (cells.length < adding.total) {
        setAdding({ ...adding, cells });
      } else if (
        run(
          { type: 'WANDERING_MONSTER', room: adding.room, hero: adding.hero, cells },
          adding.anchor,
        )
      )
        setAdding(null);
    }
  };

  let note: React.ReactNode = null;
  if (res) {
    const { hero, room } = res;
    // A wandering monster (decision 33): placed next to the hero, attacks at once. No questions.
    const askWandering =
      hero && room && res.prompts.some((p) => p.kind === 'drawCard')
        ? () => {
            // The players put it next to the hero and tell the app the square (decision 66).
            setRes(null);
            setAdding({
              t: 'wander',
              room,
              hero,
              anchor: res.anchor,
              total: wandering && 'monster' in wandering ? (wandering.count ?? 1) : 1,
              cells: [],
            });
          }
        : undefined;
    const stages = resultStages(res.prompts);
    const at = Math.min(res.stage ?? 0, Math.max(stages.length - 1, 0));
    const current = stages[at] ?? [];
    note = (
      <MarginNote
        anchor={res.anchor}
        kind={resultKind(current)}
        title={current.map((p) => headingOf(p, nameOf))[0] ?? t('play.PlayScreen.done', 'Done')}
        onClose={closeNote}
      >
        <ResultBody
          nameOf={nameOf}
          prompts={current}
          onDone={at + 1 < stages.length ? () => setRes({ ...res, stage: at + 1 }) : closeNote}
          onWandering={askWandering}
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
      // A magic door (the teleport rule) never opens: its buttons say what happens (decision 67).
      const magic = level.quest.rules.doorTeleport !== undefined;
      note = magic ? (
        <MarginNote
          anchor={anchor}
          kind={t('play.PlayScreen.door', 'Door')}
          title={t('play.PlayScreen.aMagicDoor', 'A magic door')}
          onClose={closeNote}
        >
          {forQuest('door', sel.id)}
        </MarginNote>
      ) : (
        <MarginNote
          anchor={anchor}
          kind={t('play.PlayScreen.closedDoor', 'Closed door')}
          title={t('play.PlayScreen.openThisDoor', 'Open this door?')}
          onClose={closeNote}
        >
          <p>
            {both
              ? t('play.PlayScreen.bothSidesAreExplored', 'Both sides are explored.')
              : t('play.PlayScreen.freeAction', 'Free action.')}
          </p>
          <button
            className="btn"
            onClick={() =>
              // A false door gives a result sheet here, not a toast.
              d.kind === 'false'
                ? run({ type: 'OPEN_DOOR', door: sel.id }, anchor)
                : act({ type: 'OPEN_DOOR', door: sel.id })
            }
          >
            {t('play.PlayScreen.openTheDoor', 'Open the door')}
          </button>
          {forQuest('door', sel.id)}
        </MarginNote>
      );
    }
  } else if (sel?.kind === 'cell') {
    const anchor = toMap(sel.at[0] + 0.5, sel.at[1] + 0.5);
    const canLook = hints.some((c) => c[0] === sel.at[0] && c[1] === sel.at[1]);
    const search = (override: boolean) => {
      const ok = run(
        {
          type: 'SEARCH_SECRET_DOORS',
          cell: sel.at,
          ...(override ? { override: true } : {}),
        },
        anchor,
      );
      if (!ok) refused();
    };
    if (step.t === 'pick') {
      note = (
        <MarginNote
          anchor={anchor}
          kind={t('play.PlayScreen.searchForSecretDoors', 'Search for secret doors')}
          title={t('play.PlayScreen.aMonsterIsIn', 'A monster is in the way')}
          onClose={closeNote}
        >
          <SecretGuard
            monsters={liveMonstersInSight(level, state, sel.at).map((id) => codes.get(id) ?? id)}
            onOverride={() => search(true)}
            clear={t('play.PlayScreen.theCorridorIsClear', 'The corridor is clear, search anyway')}
          />
        </MarginNote>
      );
    } else {
      note = (
        <MarginNote
          anchor={anchor}
          kind={t('play.PlayScreen.corridor', 'Corridor')}
          title={
            canLook
              ? t('play.PlayScreen.aHeroStandsHere', 'A hero stands here')
              : t('play.PlayScreen.corridorSquare', 'Corridor square')
          }
          onClose={closeNote}
        >
          {roomTilesAt(level, state, sel.at).map((t) => (
            <TileRule key={`rt${t.index}`} tile={t.tile} />
          ))}
          {boardTilesAt(level, state, sel.at).map((t) => (
            <TileRule key={t.index} tile={BOARD_TILES[t.type]} />
          ))}
          {canLook ? (
            <>
              <p>
                {t(
                  'play.PlayScreen.showEverythingAHero',
                  'Show everything a hero can see along the corridors from here.',
                )}
              </p>
              <button className="btn" onClick={() => act({ type: 'LOOK_FROM', cell: sel.at })}>
                {t('play.PlayScreen.lookFromHere', 'Look from here')}
              </button>
            </>
          ) : (
            <p>{t('play.PlayScreen.nothingNewCanBe', 'Nothing new can be seen from here.')}</p>
          )}
          <button className={canLook ? 'btn alt' : 'btn'} onClick={() => search(false)}>
            {t('play.PlayScreen.searchForSecretDoors', 'Search for secret doors')}
          </button>
        </MarginNote>
      );
    }
  } else if (sel?.kind === 'room') {
    const anchor = roomAnchor(sel.room);
    const ss = searchState(level, state, sel.room);
    const roomCodes = ss.monstersInRoom.map((id) => codes.get(id) ?? id);
    const searchSecret = (override: boolean) =>
      run(
        { type: 'SEARCH_SECRET_DOORS', area: sel.room, ...(override ? { override: true } : {}) },
        anchor,
      );
    if (step.t === 'pick' && step.what === 'secret') {
      note = (
        <MarginNote
          anchor={anchor}
          kind={t('play.PlayScreen.searchForSecretDoors', 'Search for secret doors')}
          title={t('play.PlayScreen.aMonsterIsIn', 'A monster is in the way')}
          onClose={closeNote}
        >
          <SecretGuard monsters={roomCodes} onOverride={() => searchSecret(true)} />
        </MarginNote>
      );
    } else if (step.t === 'pick') {
      note = (
        <MarginNote
          anchor={anchor}
          kind={t('play.PlayScreen.searchForTreasure', 'Search for treasure')}
          title={t('play.PlayScreen.whoSearches', 'Who searches?')}
          onClose={closeNote}
        >
          <PickHero
            nameOf={nameOf}
            team={living}
            searched={ss.searchedBy}
            monsters={roomCodes}
            blocked={false}
            override={step.override}
            onOverride={() => setStep({ ...step, override: true })}
            onPick={(hero) =>
              run(
                {
                  type: 'SEARCH_TREASURE',
                  room: sel.room,
                  hero,
                  // a hero that already searched this room may do it again ("Search anyway")
                  ...(step.override || ss.searchedBy.includes(hero) ? { override: true } : {}),
                },
                anchor,
                { hero, room: sel.room },
              )
            }
          />
        </MarginNote>
      );
    } else {
      const menu = (
        <RoomMenu
          onTreasure={() => setStep({ t: 'pick', what: 'treasure', override: false })}
          onSecret={() =>
            roomCodes.length > 0
              ? setStep({ t: 'pick', what: 'secret', override: false })
              : searchSecret(false)
          }
          onEnter={
            enterable.includes(sel.room)
              ? () => act({ type: 'AREA_ENTER', area: sel.room })
              : undefined
          }
        />
      );
      // A furniture note has three scopes: the element, the room, this quest. A furniture piece
      // with no action of its own says so, and the room actions sit under their own heading.
      const roomTiles = roomTilesInArea(level, state, sel.room);
      const terrain = boardTilesInArea(level, state, sel.room).filter(
        (t) => BOARD_TILES[t.type].terrain,
      );
      const fv = sel.furnitureId ? elementQuest(level, state, 'furniture', sel.furnitureId) : null;
      note = sel.furniture ? (
        <MarginNote
          anchor={anchor}
          kind={furnitureName(sel.furniture)}
          title={
            fv && fv.buttons.length > 0
              ? t('play.PlayScreen.actions', 'Actions')
              : t('play.PlayScreen.noActions', 'No actions')
          }
          onClose={closeNote}
        >
          {!(fv && fv.buttons.length > 0) && (
            <p className="hint">
              {t('play.PlayScreen.thisHasNoSpecial', 'This {furniture} has no special action.', {
                furniture: furnitureName(sel.furniture).toLowerCase(),
              })}
            </p>
          )}
          {roomTiles.map((t) => (
            <TileRule key={`rt${t.index}`} tile={t.tile} />
          ))}
          {terrain.map((t) => (
            <TileRule key={t.index} tile={BOARD_TILES[t.type]} />
          ))}
          <RoomScope>{menu}</RoomScope>
          {forQuestMany([
            ...(sel.furnitureId ? [['furniture', sel.furnitureId] as const] : []),
            ['area', sel.room] as const,
          ])}
        </MarginNote>
      ) : (
        <MarginNote
          anchor={anchor}
          kind={roomTiles[0] ? roomTiles[0].tile.name : t('play.PlayScreen.room', 'Room')}
          title={t('play.PlayScreen.searchThisRoom', 'Search this room')}
          onClose={closeNote}
        >
          {roomTiles.map((t) => (
            <TileRule key={`rt${t.index}`} tile={t.tile} />
          ))}
          {terrain.map((t) => (
            <TileRule key={t.index} tile={BOARD_TILES[t.type]} />
          ))}
          {menu}
          {forQuest('area', sel.room)}
        </MarginNote>
      );
    }
  } else if (sel?.kind === 'hero') {
    note = (
      <MarginNote
        anchor={{ x: 880, y: 420 }}
        kind={t('play.PlayScreen.heroes', 'Heroes')}
        title={`${nameOf(sel.hero)} fell?`}
        onClose={closeNote}
      >
        <p>
          {t('play.PlayScreen.onlyTheFactIs', 'Only the fact is kept. It leaves every tie list.')}
        </p>
        <button className="btn" onClick={() => act({ type: 'HERO_DIED', hero: sel.hero })}>
          {t('play.PlayScreen.yesFell', 'Yes, fell')}
        </button>
        <button className="btn alt" onClick={closeNote}>
          {t('play.PlayScreen.no', 'No')}
        </button>
      </MarginNote>
    );
  } else if (sel?.kind === 'zone') {
    const label = zoneLabels(level, state).find((z) => z.zone === sel.id);
    if (label) {
      note = (
        <MarginNote
          // the popup opens at the square that was tapped
          anchor={toMap((sel.at ?? label.cell)[0] + 0.5, (sel.at ?? label.cell)[1] + 0.5)}
          kind={t('play.PlayScreen.zone', 'Zone')}
          title={
            label.enter
              ? t('play.PlayScreen.aHeroEnters', 'A hero enters')
              : t('play.PlayScreen.thisPlace', 'This place')
          }
          onClose={closeNote}
        >
          {label.enter && (
            <>
              <p>
                {t(
                  'play.PlayScreen.pressTheButtonWhen',
                  'Press the button when a hero enters this square.',
                )}
              </p>
              <button className="btn" onClick={() => act({ type: 'ZONE_ENTER', zone: sel.id })}>
                {t('play.PlayScreen.aHeroEnters', 'A hero enters')}
              </button>
            </>
          )}
          {/* while the button is offered, nothing else: no "For this quest" list of what was read */}
          {label.enter ? forQuestButtons('zone', sel.id) : forQuest('zone', sel.id)}
        </MarginNote>
      );
    }
  } else if (sel?.kind === 'square') {
    const marker = squareMarkers(level, state).find(
      (m) => m.cell[0] === sel.at[0] && m.cell[1] === sel.at[1],
    );
    note = (
      <MarginNote
        anchor={toMap(sel.at[0] + 0.5, sel.at[1] + 0.5)}
        kind={t('play.PlayScreen.squareWithANote', 'Square with a note')}
        title={
          marker?.step === false
            ? t('play.PlayScreen.thisSquare', 'This square')
            : t('play.PlayScreen.didAHeroStep', 'Did a hero step here?')
        }
        onClose={closeNote}
      >
        {marker?.step !== false && (
          <>
            <button className="btn" onClick={() => act({ type: 'SQUARE_TRIGGER', cell: sel.at })}>
              {t('play.PlayScreen.yes', 'Yes')}
            </button>
            <button className="btn alt" onClick={closeNote}>
              {t('play.PlayScreen.no', 'No')}
            </button>
          </>
        )}
        {lookButton(sel.at)}
        {forQuest('square', `${sel.at[0]},${sel.at[1]}`)}
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
          hasDwarf: living.includes('dwarf'),
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
            kind={sprung && tv.kind ? TRAP_NAMES[tv.kind] : t('play.PlayScreen.trap', 'Trap')}
            title={
              sprung
                ? t('play.PlayScreen.itSprangHereBefore', 'It sprang here before')
                : t('play.PlayScreen.somethingIsWrongHere', 'Something is wrong here')
            }
            onClose={closeNote}
          >
            <TrapMenu
              sprung={sprung}
              canJump={!onFurniture}
              canDisarm={tv.canDisarm}
              kindName={sprung && tv.kind ? TRAP_NAMES[tv.kind] : undefined}
              canStep={!onFurniture}
              onJump={() => setStep({ t: 'jump' })}
              onDisarm={() => setStep({ t: 'who' })}
              onStep={() => spring({ type: 'TRAP_STEP', trap: tv.id })}
            />
            {lookButton(tv.cell)}
            {forQuest('trap', tv.id)}
          </MarginNote>
        );
      }
    }
  } else if (sel?.kind === 'tunnel') {
    const tv = level.quest.tunnels.find((x) => x.id === sel.id);
    if (tv) {
      const at = tv[sel.end];
      const anchor = toMap(at[0] + 0.5, at[1] + 0.5);
      note = (
        <MarginNote
          anchor={anchor}
          kind={t('play.PlayScreen.iceTunnel', 'Ice tunnel')}
          title={t('play.PlayScreen.tunnel', 'Tunnel {design}', { design: tv.design })}
          onClose={closeNote}
        >
          <p>
            {t(
              'play.PlayScreen.itLeadsToThe',
              'It leads to the other square with the same picture. A hero or monster that lands here comes out there, and the move ends. If that square is taken, move the figure there to a free square next to it.',
            )}
          </p>
          <button
            className="btn"
            onClick={() => run({ type: 'TUNNEL_USE', tunnel: tv.id, from: sel.end }, anchor)}
          >
            {t('play.PlayScreen.aHeroUsedThis', 'A hero used this tunnel')}
          </button>
        </MarginNote>
      );
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
        <MarginNote
          anchor={anchor}
          kind={t('play.PlayScreen.chest', 'Chest')}
          title={t('play.PlayScreen.lookForTraps', 'Look for traps')}
          onClose={closeNote}
        >
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
          {/* the same room scope as any furniture: searching the room from the chest */}
          <RoomScope>
            <RoomMenu
              onTreasure={() => {
                setSel({ kind: 'room', room: cv.room });
                setStep({ t: 'pick', what: 'treasure', override: false });
              }}
              onSecret={() => {
                if (roomCodes.length > 0) {
                  setSel({ kind: 'room', room: cv.room });
                  setStep({ t: 'pick', what: 'secret', override: false });
                } else run({ type: 'SEARCH_SECRET_DOORS', area: cv.room }, anchor);
              }}
              onEnter={
                enterable.includes(cv.room)
                  ? () => act({ type: 'AREA_ENTER', area: cv.room })
                  : undefined
              }
            />
          </RoomScope>
          {forQuestMany([
            ['furniture', cv.id],
            ['area', cv.room],
          ])}
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
          title={t('play.PlayScreen.moveAttDef', 'Move {move} · Att {att} · Def {def}', {
            move: m.stats.move,
            att: m.stats.att,
            def: m.stats.def,
          })}
          onClose={closeNote}
        >
          {m.wandering && (
            <p className="warn">
              {m.fresh && m.wanderAt
                ? t('play.PlayScreen.wanderingNextToThe', 'Wandering · next to the {hero}', {
                    hero: nameOf(m.wanderAt),
                  })
                : t('play.PlayScreen.wanderingMonster', 'Wandering monster')}
            </p>
          )}
          {m.added && (
            <p className="warn">
              {t('play.PlayScreen.addedInPlayThe', 'Added in play. The app never moves it.')}
            </p>
          )}
          {m.state === 'stone' && (
            <p className="warn">
              {t('play.PlayScreen.itDoesNotAct', '{state}. It does not act.', {
                state:
                  m.stoneTurns !== undefined
                    ? t('play.PlayScreen.stoneTurns', 'Stone: {turns} turns', {
                        turns: m.stoneTurns,
                      })
                    : t('play.PlayScreen.stone', 'Stone'),
              })}
            </p>
          )}
          {m.placeAt && (
            <p className="warn">{t('play.PlayScreen.placedByAQuest', 'Placed by a quest note.')}</p>
          )}
          {m.special && (
            <p className="special-note">{t('play.PlayScreen.specialMonster', 'Special monster')}</p>
          )}
          {m.abilities.length > 0 && (
            <ul className="abilities" data-testid="abilities">
              {m.abilities.map((a) => (
                <li key={a.id}>
                  <b>{a.name}.</b> {a.text}
                </li>
              ))}
            </ul>
          )}
          <p>
            {t('play.PlayScreen.bodyOfMind', 'Body {body} of {maxBody} · Mind {mind}', {
              body: m.body,
              maxBody: m.maxBody,
              mind: m.stats.mind,
            })}
          </p>
          {!m.attackOnly && m.maxBody > 1 && (
            <div className="row">
              <button
                className="btn alt"
                disabled={m.body <= 1}
                onClick={() => dispatch({ type: 'MONSTER_DAMAGE', monster: m.id, amount: 1 })}
              >
                {t('play.PlayScreen.wound1', 'Wound -1')}
              </button>
              <button
                className="btn alt"
                disabled={m.body >= m.maxBody}
                onClick={() => dispatch({ type: 'MONSTER_HEAL', monster: m.id, amount: 1 })}
              >
                {t('play.PlayScreen.heal1', 'Heal +1')}
              </button>
            </div>
          )}
          {m.attackOnly ? null : slayAsk === m.id ? (
            <div className="row">
              <button
                className="btn"
                onClick={() => {
                  setSlayAsk(null);
                  act({ type: 'MONSTER_KILL', monster: m.id });
                }}
              >
                {t('play.PlayScreen.yesItIsSlain', 'Yes, it is slain')}
              </button>
              <button className="btn alt" onClick={() => setSlayAsk(null)}>
                {t('play.PlayScreen.notYet', 'Not yet')}
              </button>
            </div>
          ) : (
            <button className="btn" onClick={() => setSlayAsk(m.id)}>
              {t('play.PlayScreen.slain', 'Slain')}
            </button>
          )}
          {m.state === 'passive' && (
            <div className="row">
              <button
                className="btn alt"
                onClick={() => act({ type: 'MONSTER_LEAVE', monster: m.id, reason: 'freed' })}
              >
                {t('play.PlayScreen.itLeft', 'It left')}
              </button>
              <button
                className="btn alt"
                onClick={() => act({ type: 'MONSTER_WAKE', monster: m.id })}
              >
                {t('play.PlayScreen.aHeroAttackedIt', 'A hero attacked it')}
              </button>
            </div>
          )}
          {m.profile === 'thief' && (
            <button
              className="btn alt"
              onClick={() => act({ type: 'MONSTER_LEAVE', monster: m.id, reason: 'escaped' })}
            >
              {t('play.PlayScreen.escaped', 'Escaped')}
            </button>
          )}
          {c && lookButton(c)}
          {forQuest('monster', m.id)}
        </MarginNote>
      );
    }
  }

  return (
    <div className="app play" onClick={onRootClick}>
      <header>
        <div className="titleblock">
          <h1 title={quest.title}>{quest.title}</h1>
          <div className="subline">
            <span className="qn">
              {(playtest
                ? 'Playtest'
                : t('play.PlayScreen.quest', 'Quest {number}', { number: quest.number })) +
                (quest.mapName ? `: ${quest.mapName}` : '')}
            </span>
            {goalLine && (
              <span className="goalline" title={goalLine}>
                <b>{t('play.PlayScreen.goal', 'Goal')}</b> {goalLine}
              </span>
            )}
          </div>
        </div>
        <span className="turn">
          {t('play.PlayScreen.turn', 'Turn')} <b>{state.turn}</b>
        </span>
        <button className="chip hdr" disabled={events.length === 0} onClick={() => undo()}>
          {t('play.PlayScreen.undo', 'Undo')}
        </button>
        <button
          className={'chip hdr' + (needsYou && !questOpen ? ' dot' : '')}
          aria-pressed={questOpen}
          data-testid="quest-chip"
          onClick={() => setQuestOpen((v) => !v)}
        >
          {t('play.PlayScreen.questInfo', 'Quest info')}
        </button>
        <button
          className="chip hdr"
          data-testid="settings-chip"
          onClick={() => setSettingsOpen(true)}
        >
          {t('play.PlayScreen.settings', 'Settings')}
        </button>
        <button className="chip hdr" onClick={() => setEndOpen(true)}>
          {t('play.PlayScreen.endQuest', 'End quest')}
        </button>
        {playtest && (
          <button
            className="chip"
            aria-pressed={zargonView}
            data-testid="zargon-view"
            onClick={() => setZargonView((v) => !v)}
          >
            {t('play.PlayScreen.zargonView', 'Zargon view')}
          </button>
        )}
        <button className="link" onClick={playtest ? playtest.onBack : onLeave}>
          {playtest
            ? t('play.PlayScreen.backToEditor', 'Back to editor')
            : t('play.PlayScreen.quests', 'Quests')}
        </button>
      </header>

      <ZoomLayer
        strip={ZOOM_STRIP}
        notes={
          <>
            {sheet?.t === 'place' && sheet.p.cell ? (
              <MarginNote
                anchor={toMap(sheet.p.cell[0] + 0.5, sheet.p.cell[1] + 0.5)}
                kind={t('play.PlayScreen.newMonster', 'New monster')}
                title={t('play.PlayScreen.putHere', 'Put {name} here', { name: sheet.p.name })}
                onClose={nextSheet}
              >
                <p>
                  {t('play.PlayScreen.putTheOnThe', 'Put the {monster} on the marked square.', {
                    monster: MONSTER_NAMES[sheet.p.monsterType],
                  })}
                </p>
                <button className="btn" onClick={nextSheet}>
                  {t('play.PlayScreen.done', 'Done')}
                </button>
              </MarginNote>
            ) : (
              note
            )}
          </>
        }
      >
        <PlayBoard
          level={level}
          state={state}
          fx={fx}
          codes={codes}
          selection={zActive && zMonster ? { kind: 'monster', id: zMonster } : sel}
          onSelect={choose}
          onLetter={(id) => setReread(id)}
          highlight={[
            ...(sheet?.t === 'place' && sheet.p.cell ? [sheet.p.cell] : []),
            // blocks and secret doors the last event put on the map
            ...additionCells(level, prompts),
            // the other end of a tunnel that was just used
            ...(res?.prompts.flatMap((p) => (p.kind === 'tunnelUsed' ? [p.to] : [])) ?? []),
          ]}
          {...(adding?.t === 'pick' || adding?.t === 'wander' ? { onPickCell: pickedCell } : {})}
          {...(showRoom === 'pick' ? { onPickAny: pickedRoom } : {})}
          zargonView={zargonView}
        />
      </ZoomLayer>

      <aside>
        <Heroes
          team={team}
          dead={state.deadHeroes}
          onTap={(hero) => choose({ kind: 'hero', hero })}
        />
        <div className="aside-scroll">
          <Helpers npcs={npcs} />
          <section className="monsters">
            <div className="lbl">{t('play.PlayScreen.monstersInPlay', 'Monsters in play')}</div>
            <ul className="roster">
              {alive.length === 0 && (
                <li className="empty">
                  {t('play.PlayScreen.noMonsterInSight', 'No monster in sight.')}
                </li>
              )}
              {alive.map((m) => (
                <RosterRow
                  key={m.id}
                  m={m}
                  code={codes.get(m.id) ?? ''}
                  fresh={fx?.freshMonsters.includes(m.id) ?? false}
                  acted={state.doneThisTurn.includes(m.id)}
                  selected={
                    (sel?.kind === 'monster' && sel.id === m.id) || (zActive && zMonster === m.id)
                  }
                  focus={zActive && zMonster === m.id}
                  nameOf={nameOf}
                  onTap={() => choose({ kind: 'monster', id: m.id })}
                />
              ))}
            </ul>
          </section>
        </div>
        <div className="aside-foot">
          {ruleHintsOn && unthreatenedMovement(level, state) && (
            <p className="hint" data-testid="free-move">
              {t(
                'play.PlayScreen.noMonsterIsAwake',
                'No monster is awake: you may move without rolling, counting each red die as 4.',
              )}
            </p>
          )}
          {wandering && (
            <p className="wander">
              {t('play.PlayScreen.wanderingMonster2', 'Wandering monster:')}{' '}
              <b>
                {'monster' in wandering
                  ? ((wandering.enemy
                      ? quest.enemyDefs.find((e) => e.id === wandering.enemy)?.name
                      : undefined) ?? MONSTER_NAMES[wandering.monster])
                  : wandering.text}
              </b>
            </p>
          )}
          {adding?.t === 'type' ? (
            <div className="add-monster" data-testid="add-monster">
              <label>
                {t('play.PlayScreen.monster', 'Monster')}
                <select
                  aria-label={t('play.PlayScreen.monsterToAdd', 'Monster to add')}
                  value={adding.type}
                  onChange={(e) => setAdding({ t: 'type', type: e.target.value as MonsterType })}
                >
                  {MONSTER_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {MONSTER_NAMES[t]}
                    </option>
                  ))}
                </select>
              </label>
              <button className="btn" onClick={() => setAdding({ t: 'pick', type: adding.type })}>
                {t('play.PlayScreen.chooseItsSquare', 'Choose its square')}
              </button>
              <button className="btn alt" onClick={() => setAdding(null)}>
                {t('play.PlayScreen.cancel', 'Cancel')}
              </button>
            </div>
          ) : (
            <button
              className="btn alt add-monster-btn"
              data-testid="add-monster-btn"
              onClick={() => setAdding({ t: 'type', type: 'goblin' })}
            >
              {t('play.PlayScreen.addAMonster', 'Add a monster')}
            </button>
          )}
          {showRoom === 'warn' ? (
            <div className="add-monster" data-testid="show-room-warning">
              <p className="hint">
                {t(
                  'play.PlayScreen.showRoomWarning',
                  'Use this for a spell or a quest note that shows a room. It draws the floor and walls only, not what is inside.',
                )}
              </p>
              <button className="btn" onClick={() => setShowRoom('pick')}>
                {t('play.PlayScreen.chooseASquare', 'Choose a square')}
              </button>
              <button className="btn alt" onClick={() => setShowRoom(null)}>
                {t('play.PlayScreen.cancel', 'Cancel')}
              </button>
            </div>
          ) : (
            <button
              className="btn alt add-monster-btn"
              data-testid="show-room-btn"
              onClick={() => setShowRoom('warn')}
            >
              {t('play.PlayScreen.showRoom', 'Show room')}
            </button>
          )}
          <button className="zargon-btn" onClick={() => setZOpen(true)}>
            {t('play.PlayScreen.zargonsTurn', "Zargon's turn")}
            <small>{progressLabel(progress)}</small>
          </button>
        </div>
      </aside>

      {(adding?.t === 'pick' || adding?.t === 'wander') && (
        <div className="pick-banner" role="status" data-testid="pick-banner">
          {adding.t === 'pick'
            ? t(
                'play.PlayScreen.tapTheSquareWhere',
                'Tap the square where you put the {monster}.',
                {
                  monster: MONSTER_NAMES[adding.type],
                },
              )
            : adding.total > 1
              ? t(
                  'play.PlayScreen.tapTheSquareWhere2',
                  'Tap the square where you put wandering monster {number} of {total}, {where} the {hero}.',
                  {
                    number: adding.cells.length + 1,
                    total: adding.total,
                    where:
                      adding.cells.length === 0
                        ? t('play.PlayScreen.nextTo', 'next to')
                        : t('play.PlayScreen.asCloseAs', 'as close as you can to'),
                    hero: nameOf(adding.hero),
                  },
                )
              : t(
                  'play.PlayScreen.tapTheSquareWhere3',
                  'Tap the square where you put the wandering monster, next to the {hero}.',
                  { hero: nameOf(adding.hero) },
                )}
          <button className="link" onClick={() => setAdding(null)}>
            {t('play.PlayScreen.cancel', 'Cancel')}
          </button>
        </div>
      )}

      {showRoom === 'pick' && (
        <div className="pick-banner" role="status" data-testid="show-room-banner">
          {t(
            'play.PlayScreen.tapASquareOfThe',
            'Tap a square of the room or corridor to show. Rock has nothing to show.',
          )}
          <button className="link" onClick={() => setShowRoom(null)}>
            {t('play.PlayScreen.cancel', 'Cancel')}
          </button>
        </div>
      )}

      {questOpen && !end && (
        <QuestSheet
          goalDoneText={goalDoneText(level)}
          number={playtest ? 'playtest' : quest.number}
          title={quest.title}
          intro={quest.intro.summary}
          startTexts={[
            ...startTexts(level),
            ...(startTiles(level).length > 0 ? [putTilesText(startTiles(level))] : []),
          ]}
          objectives={objectives}
          confirms={confirms}
          actions={manual}
          notes={sheetNotes}
          log={log}
          onClose={() => setQuestOpen(false)}
          onConfirm={(objective) => {
            setQuestOpen(false);
            dispatch({ type: 'CONFIRM_OBJECTIVE', objective });
          }}
          onPress={(note) => {
            setQuestOpen(false);
            dispatch({ type: 'MANUAL_TRIGGER', note });
          }}
          onRead={(id) => {
            setQuestOpen(false);
            setBackToSheet(true);
            setReread(id);
          }}
        />
      )}

      {settingsOpen && (
        <QuestSettingsCard
          questId={level.quest.id}
          title={quest.title}
          solo={quest.team?.solo === true}
          campaign={
            campaign && campaigns && manifest
              ? {
                  store: campaigns,
                  pack: manifest,
                  onChange: () => setCampaignTick((n) => n + 1),
                }
              : undefined
          }
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {end ? (
        <EndScreen
          end={end}
          title={quest.title}
          onLeave={playtest ? playtest.onBack : onLeave}
          leaveLabel={
            playtest
              ? t('play.PlayScreen.backToEditor', 'Back to editor')
              : t('play.PlayScreen.backToTheQuests', 'Back to the quests')
          }
          leave={leaveWay(level)}
          onUndo={() => undo()}
        />
      ) : sheet?.t === 'note' ? (
        <NoteSheet p={sheet.p} onClose={nextSheet} />
      ) : sheet?.t === 'goal' ? (
        <NoteCard
          kind={t('play.PlayScreen.objectiveDone', 'Objective done')}
          title={sheet.p.text}
          onClose={nextSheet}
        >
          <p>
            {sheet.all
              ? t(
                  'play.PlayScreen.allObjectivesAreDone',
                  'All objectives are done. {next}, then end the quest.',
                  {
                    next: level.quest.leave
                      ? t('play.PlayScreen.theHeroesLeave', 'The heroes leave {way}', {
                          way: level.quest.leave,
                        })
                      : t('play.PlayScreen.bringHeroesBack', 'Bring the heroes back to the stairs'),
                  },
                )
              : t(
                  'play.PlayScreen.thisObjectiveIsDone',
                  'This objective is done. The quest goes on.',
                )}
          </p>
          <button className="btn" onClick={nextSheet}>
            {t('play.PlayScreen.continue', 'Continue')}
          </button>
        </NoteCard>
      ) : pending ? (
        <NoteCard
          kind={t('play.PlayScreen.questNote', 'Quest note')}
          title={t('play.PlayScreen.choose', 'Choose')}
        >
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
          onClose={() => {
            setReread(null);
            if (backToSheet) setQuestOpen(true);
            setBackToSheet(false);
          }}
        >
          {rereadButtons}
        </RereadSheet>
      ) : endOpen ? (
        <NoteCard
          kind={t('play.PlayScreen.endQuest', 'End quest')}
          title={t('play.PlayScreen.howDidTheQuest', 'How did the quest end?')}
          onClose={() => setEndOpen(false)}
        >
          <button
            className="btn"
            onClick={() => {
              setEndOpen(false);
              dispatch({ type: 'END_QUEST', outcome: 'stairs' });
            }}
          >
            {t('play.PlayScreen.heroesLeft', 'Heroes left {way}', { way: leaveWay(level) })}
          </button>
          {endings.map((e) => (
            <button
              key={e.id}
              className="btn alt"
              onClick={() => {
                setEndOpen(false);
                dispatch({ type: 'END_QUEST', outcome: 'ending', ending: e.id });
              }}
            >
              {e.label}
            </button>
          ))}
          <button
            className="btn alt"
            onClick={() => {
              setEndOpen(false);
              dispatch({ type: 'END_QUEST', outcome: 'fell' });
            }}
          >
            {t('play.PlayScreen.allHeroesFell', 'All heroes fell')}
          </button>
          <button className="btn alt" onClick={() => setEndOpen(false)}>
            {t('play.PlayScreen.keepPlaying', 'Keep playing')}
          </button>
        </NoteCard>
      ) : allFallen && !endOpen && !fallenDismissed ? (
        <NoteCard
          kind={t('play.PlayScreen.theHeroes', 'The heroes')}
          title={t('play.PlayScreen.allHeroesHaveFallen', 'All heroes have fallen')}
          onClose={() => setFallenDismissed(true)}
        >
          <p>
            {t(
              'play.PlayScreen.thereIsNobodyLeft',
              'There is nobody left to play. End the quest, or undo the last fall.',
            )}
          </p>
          <button className="btn" onClick={() => setEndOpen(true)}>
            {t('play.PlayScreen.endQuest', 'End quest')}
          </button>
          <button className="btn alt" onClick={() => setFallenDismissed(true)}>
            {t('play.PlayScreen.backToTheMap', 'Back to the map')}
          </button>
        </NoteCard>
      ) : zActive ? (
        <ZargonDialog
          seq={seq}
          turn={state.turn}
          codes={codes}
          monsters={monsters}
          allFallen={allFallen}
          dispatch={dispatch}
          onRead={(id) =>
            setRead({ turn: state.turn, ids: [...(read.turn === state.turn ? read.ids : []), id] })
          }
          onClose={() => setZOpen(false)}
          onEnd={() => {
            setZOpen(false);
            dispatch({ type: 'ZARGON_TURN_END' });
          }}
          onEndQuest={() => {
            setZOpen(false);
            setEndOpen(true);
          }}
        />
      ) : null}

      {toast && (
        <ToastBox
          key={toast.id}
          text={toast.text}
          onMore={(text) => {
            setFullMessage(text);
            dismissToast();
          }}
        >
          {toast.undo && (
            <button onClick={() => undo()}>{t('play.PlayScreen.undo', 'Undo')}</button>
          )}
        </ToastBox>
      )}
      {fullMessage && <FullMessage text={fullMessage} onClose={() => setFullMessage(null)} />}
    </div>
  );
}

function RosterRow({
  m,
  code,
  fresh,
  acted,
  selected,
  focus,
  nameOf,
  onTap,
}: {
  nameOf: (id: string) => string;
  m: MonsterView;
  code: string;
  fresh: boolean;
  /** Marked done in Zargon's turn. */
  acted: boolean;
  selected: boolean;
  /** Zargon's turn is on this monster: bring the row into view. */
  focus: boolean;
  onTap(): void;
}) {
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (focus) ref.current?.scrollIntoView({ block: 'nearest' });
  }, [focus]);
  const theme = useTheme();
  const pic = monsterPicture(theme, m.image, m.pictureType);
  const whole = isThemeToken(theme, m.image, m.pictureType);
  return (
    <li
      ref={ref}
      className={[
        fresh ? 'new' : '',
        selected ? 'sel' : '',
        m.dead ? 'dead' : '',
        pic ? 'has-pic' : '',
      ]
        .join(' ')
        .trim()}
      title={monsterTip(m, code)}
    >
      <button data-hit disabled={m.dead} onClick={onTap}>
        <span
          className={
            'coin' +
            (m.dead ? ' off' : '') +
            // i18n-ok: a box name
            (m.box === 'Frozen Horror' ? ' ice' : '') +
            (pic ? ' pic' : '') +
            (pic && whole ? ' whole' : '')
          }
          style={pic ? { backgroundImage: `url(${pic})` } : undefined}
          data-coin-image={pic ? m.id : undefined}
        >
          {code}
        </span>
        <span>
          <span className="nm">
            {m.name}
            {m.special && (
              <span
                className="star"
                role="img"
                aria-label={t('play.PlayScreen.specialMonster', 'Special monster')}
                data-special-row
              >
                ★
              </span>
            )}
          </span>
          <br />
          <span className="st">{rosterLine(m, nameOf)}</span>
          {m.abilities.length > 0 && (
            <>
              <br />
              <span className="ab">{abilityLine(m)}</span>
            </>
          )}
        </span>
        <span className="bp">
          {acted && !m.dead && (
            <span className="tickdone" title={t('play.PlayScreen.doneThisTurn', 'Done this turn')}>
              ✓
            </span>
          )}
          {m.dead ? t('play.PlayScreen.slain', 'Slain') : `${m.body}/${m.maxBody}`}
        </span>
      </button>
    </li>
  );
}

function rosterLine(m: MonsterView, nameOf: (id: string) => string): string {
  if (m.state === 'stone')
    return m.stoneTurns !== undefined ? `Stone: ${m.stoneTurns} turns` : 'Stone';
  if (m.added) return t('play.PlayScreen.addedInPlay', 'Added in play');
  if (m.wandering && m.fresh && m.wanderAt)
    return t('play.PlayScreen.wanderingNextToThe', 'Wandering · next to the {hero}', {
      hero: nameOf(m.wanderAt),
    });
  if (m.placeAt) return t('play.PlayScreen.placedByAQuest2', 'Placed by a quest note');
  return t('play.PlayScreen.moveAttDef', 'Move {move} · Att {att} · Def {def}', {
    move: m.stats.move,
    att: m.stats.att,
    def: m.stats.def,
  });
}

function NoteSheet({ p, onClose }: { p: Extract<Prompt, { kind: 'note' }>; onClose(): void }) {
  return (
    <NoteCard
      letter={p.letter}
      kind={t('play.PlayScreen.questNote', 'Quest note')}
      title={
        p.title ??
        (p.letter
          ? t('play.PlayScreen.note', 'Note {letter}', { letter: p.letter })
          : t('play.PlayScreen.questNote', 'Quest note'))
      }
      onClose={onClose}
    >
      {p.texts.map((t, i) => (
        <p key={i}>{t}</p>
      ))}
      {p.blocksSearch && (
        <p className="extra">
          {t(
            'play.PlayScreen.theSearchWasNot',
            'The search was not used. The hero keeps the action.',
          )}
        </p>
      )}
      <button className="btn" onClick={onClose}>
        {t('play.PlayScreen.continue', 'Continue')}
      </button>
    </NoteCard>
  );
}

function RereadSheet({
  entry,
  onClose,
  children,
}: {
  entry: ReturnType<typeof journal>[number] | undefined;
  onClose(): void;
  /** The buttons of the square the letter stands on (the letter covers the square's own tap). */
  children?: ReactNode;
}) {
  if (!entry) return null;
  return (
    <NoteCard
      letter={entry.letter}
      kind={t('play.PlayScreen.questNote', 'Quest note')}
      title={entry.title ?? t('play.PlayScreen.readAgain', 'Read again')}
      onClose={onClose}
    >
      {entry.texts.map((t, i) => (
        <p key={i}>{t}</p>
      ))}
      {entry.choices.map((c, i) => (
        <p key={i} className="extra">
          {t('play.PlayScreen.youChose', '{text} You chose: {picked}.{extra}', {
            text: c.text,
            picked: c.picked,
            extra: c.texts.length > 0 ? ` ${c.texts.join(' ')}` : '',
          })}
        </p>
      ))}
      {children}
      <button className="btn" onClick={onClose}>
        {t('play.PlayScreen.close', 'Close')}
      </button>
    </NoteCard>
  );
}

function EndScreen({
  end,
  title,
  onLeave,
  leaveLabel,
  leave,
  onUndo,
}: {
  end: NonNullable<ReturnType<typeof endSummary>>;
  /** "by the stairs" or "through the exit door". */
  leave: string;
  title: string;
  onLeave(): void;
  leaveLabel: string;
  onUndo(): void;
}) {
  return (
    <NoteCard
      kind={title}
      title={
        end.outcome === 'ending'
          ? t('play.PlayScreen.questOver', 'Quest over')
          : end.won
            ? t('play.PlayScreen.questComplete', 'Quest complete')
            : t('play.PlayScreen.questOverGoalNot', 'Quest over, goal not reached')
      }
    >
      {end.outcome === 'ending' ? (
        <>
          <p>
            <b>{end.ending?.label ?? t('play.PlayScreen.theQuestEnded', 'The quest ended')}</b>
          </p>
          {end.ending?.text && <p>{end.ending.text}</p>}
          <p>
            {end.goalDone
              ? t('play.PlayScreen.theGoalWasDone', 'The goal was done.')
              : t('play.PlayScreen.theGoalWasNot', 'The goal was not done.')}
          </p>
        </>
      ) : (
        <p>
          {end.outcome === 'fell'
            ? t('play.PlayScreen.allTheHeroesFell', 'All the heroes fell.')
            : t('play.PlayScreen.theHeroesLeft', 'The heroes left {leave}.', { leave })}{' '}
          {end.goalDone
            ? t('play.PlayScreen.theGoalWasDone', 'The goal was done.')
            : t('play.PlayScreen.theGoalWasNot', 'The goal was not done.')}
        </p>
      )}
      <ul className="goals end-goals">
        {end.objectives.map((o) => (
          <li key={o.id} className={o.done ? 'done' : ''}>
            <span className="tick" aria-hidden="true">
              {o.done ? '✓' : ''}
            </span>
            <span>
              {o.text}
              <span className="sr">
                {' '}
                {o.done
                  ? t('play.PlayScreen.done2', '(done)')
                  : t('play.PlayScreen.notDone', '(not done)')}
              </span>
            </span>
          </li>
        ))}
      </ul>
      {end.rewards && (
        <p className="extra">
          {t('play.PlayScreen.rewards', 'Rewards: {rewards}', { rewards: end.rewards })}
        </p>
      )}
      {end.endNotes.map((t, i) => (
        <p key={i} className="extra" data-testid="end-note">
          {t}
        </p>
      ))}
      {end.endText && <p className="extra">{end.endText}</p>}
      <button className="btn" onClick={onLeave}>
        {leaveLabel}
      </button>
      <button className="btn alt" onClick={onUndo}>
        {t('play.PlayScreen.undoTheEnding', 'Undo the ending')}
      </button>
    </NoteCard>
  );
}
