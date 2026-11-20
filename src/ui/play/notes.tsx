/** Bodies of the margin notes for searches and traps. Presentational: no game logic. */
import { useState, type ReactNode } from 'react';
import { nameFromId } from '../../engine/data/team';
import type { Prompt } from '../../engine/game/prompts';
import { TRAP_NAMES, sprungLines, sprungTitle, wanderingLines } from './texts';
import { t } from '../../i18n/t';

export function HeroChips({
  team,
  disabled,
  onPick,
  nameOf = nameFromId,
}: {
  team: readonly string[];
  disabled: (h: string) => boolean;
  onPick(h: string): void;
  nameOf?: ((id: string) => string) | undefined;
}) {
  return (
    <div className="chips">
      {team.map((h) => (
        <button key={h} className="chip" disabled={disabled(h)} onClick={() => onPick(h)}>
          {nameOf(h)}
        </button>
      ))}
    </div>
  );
}

/**
 * A scope of a margin note: what the element can do, what the room can do, what this quest says.
 * The room block of a furniture note (design: `furniture-room-quest-proposal.svg`).
 */
export function RoomScope({ children }: { children: ReactNode }) {
  return (
    <section className="scope" data-scope="room">
      <div className="lbl">{t('play.notes.room', 'Room')}</div>
      <h3>{t('play.notes.searchThisRoom', 'Search this room')}</h3>
      {children}
    </section>
  );
}

export function RoomMenu({
  onTreasure,
  onSecret,
  onEnter,
}: {
  onTreasure(): void;
  onSecret(): void;
  /** Present when a note waits for a hero to enter this room. */
  onEnter: (() => void) | undefined;
}) {
  return (
    <>
      <p>{t('play.notes.oneHeroOneSearch', 'One hero, one search, on their own turn.')}</p>
      {onEnter && (
        <button className="btn" onClick={onEnter}>
          {t('play.notes.aHeroEnters', 'A hero enters')}
        </button>
      )}
      <button className="btn" onClick={onTreasure}>
        {t('play.notes.searchForTreasure', 'Search for treasure')}
      </button>
      <button className="btn alt" onClick={onSecret}>
        {t('play.notes.searchForSecretDoors', 'Search for secret doors')}
      </button>
    </>
  );
}

export function PickHero(props: {
  team: readonly string[];
  /** Heroes that cannot search (they already searched this room for treasure). */
  searched: readonly string[];
  nameOf?: ((id: string) => string) | undefined;
  /** Codes of living monsters in the way, empty when there are none. */
  monsters: readonly string[];
  /** Monsters are in sight but the engine does not say which. */
  blocked: boolean;
  override: boolean;
  onOverride(): void;
  onPick(h: string): void;
}) {
  const warned = props.monsters.length > 0 || props.blocked;
  const guarded = warned && !props.override;
  // When every hero searched this room already, ask before allowing a repeat.
  const [again, setAgain] = useState(false);
  const allSearched = props.team.length > 0 && props.team.every((h) => props.searched.includes(h));
  const askAgain = allSearched && !again;
  return (
    <>
      {askAgain && (
        <p className="warn">
          {t('play.notes.allHeroesSearchedAlready', 'All heroes searched already, search anyway?')}
        </p>
      )}
      {warned && (
        <p className="warn">
          {props.monsters.length > 0
            ? `${props.monsters.join(', ')} still here. A search needs a clear room.`
            : t(
                'play.notes.aMonsterIsIn',
                'A monster is in sight. A search needs a clear corridor.',
              )}
        </p>
      )}
      <HeroChips
        team={props.team}
        disabled={(h) => guarded || (props.searched.includes(h) && !again)}
        onPick={props.onPick}
        nameOf={props.nameOf}
      />
      {(guarded || askAgain) && (
        <button className="btn alt" onClick={guarded ? props.onOverride : () => setAgain(true)}>
          {guarded
            ? t('play.notes.theRoomIsClear', 'The room is clear, search anyway')
            : t('play.notes.searchAnyway', 'Search anyway')}
        </button>
      )}
    </>
  );
}

/** The name and rule of a room tile, for the room note. */
export function TileRule({ tile }: { tile: { name: string; rule: readonly string[] } }) {
  return (
    <div className="tile-rule" data-testid="tile-rule">
      <p className="special-note">{tile.name}</p>
      <p className="hint">
        {t('play.notes.putTheTileOn', 'Put the {name} tile on the board here.', {
          name: tile.name,
        })}
      </p>
      {tile.rule.map((line) => (
        <p key={line} className="hint">
          {line}
        </p>
      ))}
    </div>
  );
}

export function TrapMenu(props: {
  /** The name of a trap that sprang and is still there. */
  kindName?: string | undefined;
  canJump: boolean;
  canDisarm: boolean;
  canStep: boolean;
  sprung: boolean;
  onJump(): void;
  onDisarm(): void;
  onStep(): void;
}) {
  return (
    <>
      <p>
        {props.sprung
          ? t('play.notes.theIsStillHere', 'The {v1} is still here.', {
              v1: props.kindName ?? 'trap',
            })
          : t(
              'play.notes.theKindOfTrap',
              'The kind of trap stays hidden until it springs or is disarmed.',
            )}
      </p>
      <button className="btn" disabled={!props.canJump} onClick={props.onJump}>
        {t('play.notes.jumpOverIt', 'Jump over it')}
      </button>
      <button className="btn alt" disabled={!props.canDisarm} onClick={props.onDisarm}>
        {t('play.notes.tryToDisarmIt', 'Try to disarm it')}
      </button>
      <button className="btn alt" disabled={!props.canStep} onClick={props.onStep}>
        {t('play.notes.stepOntoIt', 'Step onto it')}
      </button>
      {!props.canJump && !props.sprung && (
        <p className="small">
          {t('play.notes.aTrapOnFurniture', 'A trap on furniture can only be disarmed.')}
        </p>
      )}
    </>
  );
}

export type TrapStep = 'jump' | 'who' | 'dwarf' | 'kit';

export function trapStepBody(props: {
  step: TrapStep;
  hasDwarf: boolean;
  onJump(result: 'skull' | 'ok'): void;
  onWho(who: 'dwarf' | 'kit'): void;
  onDisarm(by: 'dwarf' | 'toolkit', result: 'skull' | 'blackShield' | 'other'): void;
}): { kind: string; title: string; body: ReactNode } {
  switch (props.step) {
    case 'jump':
      return {
        kind: 'Jump · needs 2 moves left',
        title: 'Roll 1 combat die',
        body: (
          <>
            <p>{t('play.notes.anythingButASkull', 'Anything but a skull: you jump over.')}</p>
            <div className="row">
              <button className="btn" onClick={() => props.onJump('skull')}>
                {t('play.notes.skull', 'Skull')}
              </button>
              <button className="btn alt" onClick={() => props.onJump('ok')}>
                {t('play.notes.noSkull', 'No skull')}
              </button>
            </div>
          </>
        ),
      };
    case 'who':
      return {
        kind: 'Disarm',
        title: 'Who tries?',
        body: (
          <>
            <p>{t('play.notes.moveOntoTheSquare', 'Move onto the square first.')}</p>
            <button className="btn" disabled={!props.hasDwarf} onClick={() => props.onWho('dwarf')}>
              {t('play.notes.theDwarf', 'The Dwarf')}
            </button>
            <button className="btn alt" onClick={() => props.onWho('kit')}>
              {t('play.notes.aHeroWithA', 'A hero with a tool kit')}
            </button>
          </>
        ),
      };
    case 'dwarf':
      return {
        kind: 'Disarm · Dwarf',
        title: 'Roll 1 combat die',
        body: (
          <>
            <p>
              Only a <b>{t('play.notes.blackShield', 'black shield')}</b> springs the trap.
            </p>
            <div className="row">
              <button className="btn" onClick={() => props.onDisarm('dwarf', 'blackShield')}>
                {t('play.notes.blackShield2', 'Black shield')}
              </button>
              <button className="btn alt" onClick={() => props.onDisarm('dwarf', 'other')}>
                {t('play.notes.other', 'Other')}
              </button>
            </div>
          </>
        ),
      };
    case 'kit':
      return {
        kind: 'Disarm · tool kit',
        title: 'Roll 1 combat die',
        body: (
          <>
            <p>
              A <b>{t('play.notes.skull2', 'skull')}</b> springs the trap.
            </p>
            <div className="row">
              <button className="btn" onClick={() => props.onDisarm('toolkit', 'skull')}>
                {t('play.notes.skull', 'Skull')}
              </button>
              <button className="btn alt" onClick={() => props.onDisarm('toolkit', 'other')}>
                {t('play.notes.shield', 'Shield')}
              </button>
            </div>
          </>
        ),
      };
  }
}

/** The result of a search or a trap: one section per prompt, in the order the engine gave them. */
export function ResultBody({
  prompts,
  onDone,
  onWandering,
  nameOf = nameFromId,
}: {
  nameOf?: ((id: string) => string) | undefined;
  prompts: readonly Prompt[];
  onDone(): void;
  /** Present when a wandering monster can be asked for (after a treasure search). */
  onWandering: (() => void) | undefined;
}) {
  const shown = prompts;
  const draws = shown.some((p) => p.kind === 'drawCard');
  return (
    <>
      {shown.map((p, i) => (
        <section key={i} className="result">
          <Section p={p} heading={i > 0} nameOf={nameOf} />
        </section>
      ))}
      <button className="btn" onClick={onDone}>
        {t('play.notes.done', 'Done')}
      </button>
      {draws && onWandering && (
        <button className="btn alt" onClick={onWandering}>
          {t('play.notes.itWasAWandering', 'It was a wandering monster')}
        </button>
      )}
    </>
  );
}

/** The big heading of a prompt, used as the note title for the first one. */
export function headingOf(p: Prompt, nameOf: (id: string) => string = nameFromId): string {
  switch (p.kind) {
    case 'trapSprung':
      return sprungTitle(p.trapKind);
    case 'trapJumped':
      return 'You land safely';
    case 'trapDisarmed':
      return `It was a ${TRAP_NAMES[p.trapKind]}`;
    case 'tunnelUsed':
      return `Ice tunnel ${p.design}`;
    case 'note':
      return p.letter ? `Quest note ${p.letter}` : 'Quest note';
    case 'drawCard':
      return 'Draw a treasure card';
    case 'wanderingMonster':
      return `It attacks the ${nameOf(p.hero)}!`;
    case 'wanderingText':
      return 'Wandering monster';
    case 'secretDoorsFound':
      return p.doors.length > 1 ? 'Secret doors!' : 'A secret door!';
    case 'nothingFound':
      return 'Nothing found';
    case 'trapFound':
      return 'You found a trap';
    case 'noTrap':
      return 'No trap';
    case 'doorStuck':
      return 'A door that will not open';
    default:
      return '';
  }
}

function lines(p: Prompt, nameOf: (id: string) => string): string[] {
  switch (p.kind) {
    case 'trapSprung':
      return sprungLines(p);
    case 'trapJumped':
      return p.slide
        ? [
            'The trap is still there for the next hero.',
            'The hero saw the whole slide: put the ice slide tile on the board. It ends at the arrow.',
          ]
        : ['The trap is still there for the next hero.'];
    case 'trapDisarmed':
      return ['The square is safe now.'];
    case 'note':
      return [...p.texts];
    case 'drawCard':
      return ['No quest treasure here. Read the card aloud.'];
    case 'tunnelUsed':
      return [
        `The hero comes out at the other square of ice tunnel ${p.design}. If a figure is on it, move that figure to a free square next to it. The move ends here.`,
      ];
    case 'wanderingMonster':
      return wanderingLines(p, nameOf);
    case 'wanderingText':
      return [p.text];
    case 'secretDoorsFound':
      return [`${p.doors.length > 1 ? 'They are' : 'It is'} on the map now, closed. Tap to open.`];
    case 'nothingFound':
      return ['There is no secret door to find here.'];
    case 'trapFound':
      return [
        'You found a trap on this chest. Try to disarm it, or a treasure search here springs it.',
      ];
    case 'noTrap':
      return ['No trap on this chest.'];
    case 'doorStuck':
      return ['This door cannot be opened. Nothing changed.'];
    default:
      return [];
  }
}

/**
 * Prompts for the margin-note result sheet (searches and traps). Quest notes, choices and
 * monsters to place have their own sheets, and other prompts are short toasts.
 */
const RESULT_KINDS: readonly Prompt['kind'][] = [
  'trapSprung',
  'trapJumped',
  'trapDisarmed',
  'drawCard',
  'tunnelUsed',
  'wanderingMonster',
  'wanderingText',
  'secretDoorsFound',
  'nothingFound',
  'trapFound',
  'noTrap',
  'doorStuck',
];
export const resultPrompts = (prompts: readonly Prompt[]) =>
  prompts.filter(
    (p, i) =>
      RESULT_KINDS.includes(p.kind) &&
      // two traps on one chest read as one "you found a trap"
      !(p.kind === 'trapFound' && prompts.findIndex((q) => q.kind === 'trapFound') !== i),
  );

const TRAP_STAGE: Prompt['kind'][] = ['trapSprung', 'trapJumped', 'trapDisarmed'];

/**
 * The result prompts in the order they are told. A trap comes first, alone; after Done the rest
 * of the search follows (a chest trap that springs on a treasure search, then the treasure).
 */
export function resultStages(prompts: readonly Prompt[]): Prompt[][] {
  const shown = resultPrompts(prompts);
  const trap = shown.filter((p) => TRAP_STAGE.includes(p.kind));
  const rest = shown.filter((p) => !TRAP_STAGE.includes(p.kind));
  return [trap, rest].filter((s) => s.length > 0);
}

function Section({
  p,
  heading,
  nameOf,
}: {
  p: Prompt;
  heading: boolean;
  nameOf: (id: string) => string;
}) {
  return (
    <>
      {heading && <h4>{headingOf(p, nameOf)}</h4>}
      {lines(p, nameOf).map((l, i) => (
        <p key={i}>{l}</p>
      ))}
    </>
  );
}

/** Body of the chest note. A chest is searched for traps once, by anyone, with no hero input. */
export function ChestBody(props: {
  searched: boolean;
  trapFound: boolean;
  /** Codes of living monsters in the chest's room. */
  monsters: readonly string[];
  override: boolean;
  onOverride(): void;
  onSearch(): void;
  onDisarm(): void;
}) {
  if (props.trapFound)
    return (
      <>
        <p>
          {t(
            'play.notes.aTrapWasFound',
            'A trap was found on this chest. A treasure search here springs it.',
          )}
        </p>
        <button className="btn" onClick={props.onDisarm}>
          {t('play.notes.tryToDisarmIt', 'Try to disarm it')}
        </button>
      </>
    );
  if (props.searched)
    return (
      <>
        <p>{t('play.notes.alreadySearched', 'Already searched.')}</p>
      </>
    );
  const guarded = props.monsters.length > 0 && !props.override;
  return (
    <>
      <p>{t('play.notes.anyoneCanLookFor', 'Anyone can look for traps on a chest, once.')}</p>
      {props.monsters.length > 0 && (
        <p className="warn">
          {t('play.notes.stillHereASearch', '{v1} still here. A search needs a clear room.', {
            v1: props.monsters.join(', '),
          })}
        </p>
      )}
      <button className="btn" disabled={guarded} onClick={props.onSearch}>
        {t('play.notes.searchForTraps', 'Search for traps')}
      </button>
      {guarded && (
        <button className="btn alt" onClick={props.onOverride}>
          {t('play.notes.theRoomIsClear', 'The room is clear, search anyway')}
        </button>
      )}
    </>
  );
}

/** The secret door search needs no hero. Only the guard is left: monsters in the way. */
export function SecretGuard(props: {
  /** Codes of living monsters in the way (may be empty when the engine only says "in sight"). */
  monsters: readonly string[];
  onOverride(): void;
  /** The words of the button: a room is "clear", a corridor is "free of monsters". */
  clear?: string;
}) {
  return (
    <>
      <p className="warn">
        {props.monsters.length > 0
          ? `${props.monsters.join(', ')} still here. A search needs a clear ${props.clear ? 'corridor' : 'room'}.`
          : t('play.notes.aMonsterIsIn', 'A monster is in sight. A search needs a clear corridor.')}
      </p>
      <button className="btn alt" onClick={props.onOverride}>
        {props.clear ?? t('play.notes.theRoomIsClear', 'The room is clear, search anyway')}
      </button>
    </>
  );
}
