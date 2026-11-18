/** Bodies of the margin notes for searches and traps. Presentational: no game logic. */
import { useState, type ReactNode } from 'react';
import { HERO_NAMES, type Hero } from '../../engine/data/heroes';
import type { Prompt } from '../../engine/game/prompts';
import { TRAP_NAMES, sprungLines, sprungTitle, wanderingLines } from './texts';

export function HeroChips({
  team,
  disabled,
  onPick,
}: {
  team: readonly Hero[];
  disabled: (h: Hero) => boolean;
  onPick(h: Hero): void;
}) {
  return (
    <div className="chips">
      {team.map((h) => (
        <button key={h} className="chip" disabled={disabled(h)} onClick={() => onPick(h)}>
          {HERO_NAMES[h]}
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
      <div className="lbl">Room</div>
      <h3>Search this room</h3>
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
      <p>One hero, one search, on their own turn.</p>
      {onEnter && (
        <button className="btn" onClick={onEnter}>
          A hero enters
        </button>
      )}
      <button className="btn" onClick={onTreasure}>
        Search for treasure
      </button>
      <button className="btn alt" onClick={onSecret}>
        Search for secret doors
      </button>
    </>
  );
}

export function PickHero(props: {
  team: readonly Hero[];
  /** Heroes that cannot search (they already searched this room for treasure). */
  searched: readonly Hero[];
  /** Codes of living monsters in the way, empty when there are none. */
  monsters: readonly string[];
  /** Monsters are in sight but the engine does not say which. */
  blocked: boolean;
  override: boolean;
  onOverride(): void;
  onPick(h: Hero): void;
}) {
  const warned = props.monsters.length > 0 || props.blocked;
  const guarded = warned && !props.override;
  // When every hero searched this room already, ask before allowing a repeat.
  const [again, setAgain] = useState(false);
  const allSearched = props.team.length > 0 && props.team.every((h) => props.searched.includes(h));
  const askAgain = allSearched && !again;
  return (
    <>
      {askAgain && <p className="warn">All heroes searched already, search anyway?</p>}
      {warned && (
        <p className="warn">
          {props.monsters.length > 0
            ? `${props.monsters.join(', ')} still here. A search needs a clear room.`
            : 'A monster is in sight. A search needs a clear corridor.'}
        </p>
      )}
      <HeroChips
        team={props.team}
        disabled={(h) => guarded || (props.searched.includes(h) && !again)}
        onPick={props.onPick}
      />
      {(guarded || askAgain) && (
        <button className="btn alt" onClick={guarded ? props.onOverride : () => setAgain(true)}>
          {guarded ? 'The room is clear, search anyway' : 'Search anyway'}
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
          ? `The ${props.kindName ?? 'trap'} is still here.`
          : 'The kind of trap stays hidden until it springs or is disarmed.'}
      </p>
      <button className="btn" disabled={!props.canJump} onClick={props.onJump}>
        Jump over it
      </button>
      <button className="btn alt" disabled={!props.canDisarm} onClick={props.onDisarm}>
        Try to disarm it
      </button>
      <button className="btn alt" disabled={!props.canStep} onClick={props.onStep}>
        Step onto it
      </button>
      {!props.canJump && !props.sprung && (
        <p className="small">A trap on furniture can only be disarmed.</p>
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
            <p>Anything but a skull: you jump over.</p>
            <div className="row">
              <button className="btn" onClick={() => props.onJump('skull')}>
                Skull
              </button>
              <button className="btn alt" onClick={() => props.onJump('ok')}>
                No skull
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
            <p>Move onto the square first.</p>
            <button className="btn" disabled={!props.hasDwarf} onClick={() => props.onWho('dwarf')}>
              The Dwarf
            </button>
            <button className="btn alt" onClick={() => props.onWho('kit')}>
              A hero with a tool kit
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
              Only a <b>black shield</b> springs the trap.
            </p>
            <div className="row">
              <button className="btn" onClick={() => props.onDisarm('dwarf', 'blackShield')}>
                Black shield
              </button>
              <button className="btn alt" onClick={() => props.onDisarm('dwarf', 'other')}>
                Other
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
              A <b>skull</b> springs the trap.
            </p>
            <div className="row">
              <button className="btn" onClick={() => props.onDisarm('toolkit', 'skull')}>
                Skull
              </button>
              <button className="btn alt" onClick={() => props.onDisarm('toolkit', 'other')}>
                Shield
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
}: {
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
          <Section p={p} heading={i > 0} />
        </section>
      ))}
      <button className="btn" onClick={onDone}>
        Done
      </button>
      {draws && onWandering && (
        <button className="btn alt" onClick={onWandering}>
          It was a wandering monster
        </button>
      )}
    </>
  );
}

/** The big heading of a prompt, used as the note title for the first one. */
export function headingOf(p: Prompt): string {
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
      return `It attacks the ${HERO_NAMES[p.hero]}!`;
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

function lines(p: Prompt): string[] {
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
      return wanderingLines(p);
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

function Section({ p, heading }: { p: Prompt; heading: boolean }) {
  return (
    <>
      {heading && <h4>{headingOf(p)}</h4>}
      {lines(p).map((l, i) => (
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
        <p>A trap was found on this chest. A treasure search here springs it.</p>
        <button className="btn" onClick={props.onDisarm}>
          Try to disarm it
        </button>
      </>
    );
  if (props.searched)
    return (
      <>
        <p>Already searched.</p>
      </>
    );
  const guarded = props.monsters.length > 0 && !props.override;
  return (
    <>
      <p>Anyone can look for traps on a chest, once.</p>
      {props.monsters.length > 0 && (
        <p className="warn">{props.monsters.join(', ')} still here. A search needs a clear room.</p>
      )}
      <button className="btn" disabled={guarded} onClick={props.onSearch}>
        Search for traps
      </button>
      {guarded && (
        <button className="btn alt" onClick={props.onOverride}>
          The room is clear, search anyway
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
          : 'A monster is in sight. A search needs a clear corridor.'}
      </p>
      <button className="btn alt" onClick={props.onOverride}>
        {props.clear ?? 'The room is clear, search anyway'}
      </button>
    </>
  );
}
