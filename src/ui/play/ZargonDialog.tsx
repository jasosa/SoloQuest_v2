import type { GameEvent } from '../../engine/game/events';
import type { MonsterView } from '../../engine/game/view';
import type { Order } from '../../engine/zargon';
import { NoteCard } from '../shared/NoteCard';
import { leftLabel, tieText, type TurnSequence } from './zargonView';
import { t } from '../../i18n/t';

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
      {t('play.ZargonDialog.backToTheMap', 'Back to the map')}
    </button>
  );

  if (p.allFallen)
    return (
      <NoteCard
        light
        kind="Zargon's turn"
        title={t('play.ZargonDialog.allHeroesHaveFallen', 'All heroes have fallen')}
        onClose={p.onClose}
      >
        <p>
          {t(
            'play.ZargonDialog.thereIsNobodyLeft',
            'There is nobody left for the monsters to attack.',
          )}
        </p>
        <button className="btn" onClick={p.onEndQuest}>
          {t('play.ZargonDialog.endQuest', 'End quest')}
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
        title={
          p.seq.items.length === 0
            ? t('play.ZargonDialog.noMonsterToAct', 'No monster to act')
            : t('play.ZargonDialog.allMonstersHaveActed', 'All monsters have acted')
        }
        onClose={p.onClose}
      >
        <p>
          {p.seq.items.length === 0
            ? t('play.ZargonDialog.noMonsterIsIn', 'No monster is in sight. Zargon waits.')
            : t(
                'play.ZargonDialog.everyMonsterHasCarried',
                'Every monster has carried out its order.',
              )}
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
          {t('play.ZargonDialog.next', 'Next')}
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
          {t(
            'play.ZargonDialog.moveAttDefBody',
            'Move {move} · Att {att} · Def {def} · Body {body} · Mind {mind}',
            {
              move: view.stats.move,
              att: view.stats.att,
              def: view.stats.def,
              body: view.stats.body,
              mind: view.stats.mind,
            },
          )}
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
      <Tie order={o} />
      <button
        className="btn"
        onClick={() => p.dispatch({ type: 'MONSTER_DONE', monster: o.monster })}
      >
        {t('play.ZargonDialog.done', 'Done')}
      </button>
      {back}
    </NoteCard>
  );
}

function Entry({ order: o }: { order: Order }) {
  return (
    <>
      <dl className="zdl">
        <dt>{t('play.ZargonDialog.target', 'Target')}</dt>
        <dd>{o.ruleText}.</dd>
        {o.plan && (
          <>
            <dt>{t('play.ZargonDialog.plan', 'Plan')}</dt>
            <dd>{o.plan}</dd>
          </>
        )}
        {o.noTarget && (
          <>
            <dt>{t('play.ZargonDialog.else', 'Else')}</dt>
            <dd>{o.noTarget}</dd>
          </>
        )}
        {o.special.length > 0 && (
          <>
            <dt>{t('play.ZargonDialog.special', 'Special')}</dt>
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

/** The tie list is the last thing on the card, after the spell of a caster too (owner). */
function Tie({ order: o }: { order: Order }) {
  return (
    <dl className="zdl" data-testid="zargon-tie">
      <dt>{t('play.ZargonDialog.tie', 'Tie')}</dt>
      <dd>
        <span className="tgt">{tieText(o.tie, o.tieNames)}</span>
      </dd>
    </dl>
  );
}

/**
 * A caster tries a spell first (decision 72). The dialog says when in its turn it casts, then
 * lists when the spell works. Yes sends SPELL_CAST. No sends SPELL_FAILED and shows the next
 * spell, and when none is left the normal plan.
 */
function Spell({ order: o, onYes, onNo }: { order: Order; onYes(): void; onNo(): void }) {
  const sp = o.spell;
  if (!sp) return null;
  return (
    <div className="spell">
      <div className="sname">
        <b>{sp.name}</b> <span className="x">{leftLabel(sp.left)}</span>
        {sp.of > 1 && (
          <span className="x">
            {' '}
            {t('play.ZargonDialog.spellOf', '· spell {place} of {of}', {
              place: sp.place,
              of: sp.of,
            })}
          </span>
        )}
      </div>
      <div className="scond">{sp.effect}</div>
      <div className="scond">{sp.timing}</div>
      {sp.warning && <div className="scond warn">{sp.warning}</div>}
      <div className="sask">
        {sp.questions.length > 1
          ? t('play.ZargonDialog.itCastsThisSpell', 'It casts this spell if any of these is true:')
          : t('play.ZargonDialog.itCastsThisSpell2', 'It casts this spell if:')}
      </div>
      <ul className="squestions">
        {sp.questions.map((q) => (
          <li key={q}>{q}</li>
        ))}
      </ul>
      <div className="scond">
        {sp.place < sp.of
          ? t('play.ZargonDialog.ifNoneIsTrue', 'If none is true, try the next spell.')
          : t('play.ZargonDialog.ifNoneIsTrue2', 'If none is true, no spell this turn: {v1}', {
              v1: o.fallbackPlan ?? 'use the normal plan',
            })}
      </div>
      <div className="row">
        <button className="btn" onClick={onYes}>
          {t('play.ZargonDialog.yesItCastsIt', 'Yes, it casts it')}
        </button>
        <button className="btn alt" onClick={onNo}>
          {sp.place < sp.of
            ? t('play.ZargonDialog.noNextSpell', 'No, next spell')
            : t('play.ZargonDialog.noUseThePlan', 'No, use the plan')}
        </button>
      </div>
    </div>
  );
}
