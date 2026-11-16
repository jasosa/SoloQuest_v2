import type { GameEvent } from '../../engine/game/events';
import type { MonsterView } from '../../engine/game/view';
import type { Order } from '../../engine/zargon';
import { NoteCard } from '../shared/NoteCard';
import { leftLabel, tieText, type TurnSequence } from './zargonView';

export interface ZargonDialogProps {
  seq: TurnSequence;
  turn: number;
  codes: ReadonlyMap<string, string>;
  monsters: readonly MonsterView[];
  /** Every hero of the team has fallen: no orders (decision 32). */
  allFallen: boolean;
  dispatch(event: GameEvent): boolean;
  /** An info dialog (stone, fresh wanderer) was read: UI-local, no event. */
  onRead(monster: string): void;
  onClose(): void;
  onEnd(): void;
  onEndQuest(): void;
}

/**
 * Zargon's turn, one monster at a time (decision 34). The dialog only reads the orders of the
 * engine and sends MONSTER_DONE, SPELL_CAST, SPELL_FAILED and ZARGON_TURN_END.
 */
export function ZargonDialog(p: ZargonDialogProps) {
  const back = (
    <button className="btn alt" onClick={p.onClose}>
      Back to the map
    </button>
  );

  if (p.allFallen)
    return (
      <NoteCard light kind="Zargon's turn" title="All heroes have fallen" onClose={p.onClose}>
        <p>There is nobody left for the monsters to attack.</p>
        <button className="btn" onClick={p.onEndQuest}>
          End quest
        </button>
        {back}
      </NoteCard>
    );

  const cur = p.seq.current;
  if (!cur)
    return (
      <NoteCard
        light
        kind={`Zargon's turn · Turn ${p.turn}`}
        title={p.seq.items.length === 0 ? 'No monster to act' : 'All monsters have acted'}
        onClose={p.onClose}
      >
        <p>
          {p.seq.items.length === 0
            ? 'No monster is in sight. Zargon waits.'
            : 'Every monster has carried out its order.'}
        </p>
        <button className="btn" onClick={p.onEnd}>
          End Zargon&apos;s turn
        </button>
        {back}
      </NoteCard>
    );

  const o = cur.order;
  const code = p.codes.get(o.monster) ?? '';
  const view = p.monsters.find((m) => m.id === o.monster);

  if (cur.kind === 'info')
    return (
      <NoteCard
        key={o.monster}
        light
        letter={code}
        kind="Not acting this turn"
        title={o.name}
        onClose={p.onClose}
      >
        <p>{o.note}</p>
        <button className="btn" onClick={() => p.onRead(o.monster)}>
          Next
        </button>
        {back}
      </NoteCard>
    );

  return (
    <NoteCard
      key={o.monster}
      light
      letter={code}
      kind={`Monster ${cur.number} of ${p.seq.actingTotal}`}
      title={o.name}
      onClose={p.onClose}
    >
      {view && (
        <p className="stats">
          Move {view.stats.move} · Att {view.stats.att} · Def {view.stats.def} · Body{' '}
          {view.stats.body} · Mind {view.stats.mind}
        </p>
      )}
      <Entry order={o} />
      {o.spell && (
        <Spell
          order={o}
          onYes={() =>
            p.dispatch({ type: 'SPELL_CAST', monster: o.monster, spell: o.spell!.spell })
          }
          onNo={() =>
            p.dispatch({ type: 'SPELL_FAILED', monster: o.monster, spell: o.spell!.spell })
          }
        />
      )}
      <button
        className="btn"
        onClick={() => p.dispatch({ type: 'MONSTER_DONE', monster: o.monster })}
      >
        Done
      </button>
      {back}
    </NoteCard>
  );
}

function Entry({ order: o }: { order: Order }) {
  return (
    <>
      <dl className="zdl">
        <dt>Target</dt>
        <dd>{o.ruleText}.</dd>
        <dt>Tie</dt>
        <dd>
          <span className="tgt">{tieText(o.tie)}</span>
        </dd>
        {o.plan && (
          <>
            <dt>Plan</dt>
            <dd>{o.plan}</dd>
          </>
        )}
        {o.noTarget && (
          <>
            <dt>Else</dt>
            <dd>{o.noTarget}</dd>
          </>
        )}
        {o.special.length > 0 && (
          <>
            <dt>Special</dt>
            <dd>
              {o.special.map((s, i) => (
                <div key={i}>{s}.</div>
              ))}
            </dd>
          </>
        )}
      </dl>
      {o.spellNote && <p className="rule">{o.spellNote}</p>}
    </>
  );
}

/** A caster's one random spell: "Could it cast it?" Yes sends SPELL_CAST, No sends SPELL_FAILED. */
function Spell({ order: o, onYes, onNo }: { order: Order; onYes(): void; onNo(): void }) {
  const sp = o.spell;
  if (!sp) return null;
  return (
    <div className="spell">
      <div className="sname">
        <b>{sp.name}</b> <span className="x">{leftLabel(sp.left)}</span>
      </div>
      <div className="scond">{sp.effect}</div>
      {o.fallbackPlan && <div className="scond">If it cannot cast: {o.fallbackPlan}</div>}
      {sp.warning && <div className="scond warn">{sp.warning}</div>}
      <div className="sask">
        {sp.questions.length > 1
          ? 'Is any of these true?'
          : (sp.questions[0] ?? 'Could it cast it?')}
      </div>
      {sp.questions.length > 1 && (
        <ul className="squestions">
          {sp.questions.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ul>
      )}
      <div className="row">
        <button className="btn" onClick={onYes}>
          Yes, it cast it
        </button>
        <button className="btn alt" onClick={onNo}>
          No
        </button>
      </div>
    </div>
  );
}
