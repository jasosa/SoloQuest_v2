import { useEffect, useMemo, useState } from 'react';
import { HERO_NAMES, type Hero } from '../../engine/data/heroes';
import type { GameEvent } from '../../engine/game/events';
import type { Level } from '../../engine/board/level';
import type { GameState } from '../../engine/game/state';
import { groupOrders, ordersFor, reachOrder, type Order } from '../../engine/zargon';
import { MODE_HELP, displayGroups, leftLabel, tieText } from './zargonView';

type Mode = 'priority' | 'reach';
interface Reach {
  readonly reach: readonly Hero[];
  readonly adj: readonly Hero[];
}

export interface ZargonPageProps {
  open: boolean;
  level: Level;
  state: GameState;
  team: readonly Hero[];
  codes: ReadonlyMap<string, string>;
  dispatch(event: GameEvent): boolean;
  onClose(): void;
  onEndTurn(): void;
}

/**
 * Zargon's turn: a page that slides in from the right over the right column. It only reads the
 * orders of the engine and sends MONSTER_DONE, SPELL_CAST and ZARGON_TURN_END. The "who can it
 * reach?" taps are local state, forgotten when the turn changes.
 */
export function ZargonPage({
  open,
  level,
  state,
  team,
  codes,
  dispatch,
  onClose,
  onEndTurn,
}: ZargonPageProps) {
  const [mode, setMode] = useState<Mode>('priority');
  const [reachState, setReachState] = useState<{ turn: number; by: Record<string, Reach> }>({
    turn: state.turn,
    by: {},
  });

  // Esc closes the page (a note card on top handles its own Esc).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const by = reachState.turn === state.turn ? reachState.by : {};
  const orders = useMemo(() => ordersFor(level, state, team), [level, state, team]);
  const groups = useMemo(() => displayGroups(groupOrders(orders)), [orders]);

  const setReach = (id: string, next: Reach) =>
    setReachState({ turn: state.turn, by: { ...by, [id]: next } });
  const toggle = (id: string, hero: Hero) => {
    const cur = by[id] ?? { reach: [], adj: [] };
    const on = cur.reach.includes(hero);
    setReach(id, {
      reach: on ? cur.reach.filter((h) => h !== hero) : [...cur.reach, hero],
      adj: on ? cur.adj.filter((h) => h !== hero) : cur.adj,
    });
  };
  const toggleAdj = (id: string, hero: Hero) => {
    const cur = by[id] ?? { reach: [], adj: [] };
    setReach(id, {
      reach: cur.reach,
      adj: cur.adj.includes(hero) ? cur.adj.filter((h) => h !== hero) : [...cur.adj, hero],
    });
  };

  const done = (ids: readonly string[]) => {
    for (const id of ids) dispatch({ type: 'MONSTER_DONE', monster: id });
  };
  const code = (id: string) => codes.get(id) ?? '';

  const empty =
    team.length === 0
      ? 'Pick your heroes first, then Zargon has orders.'
      : 'No monster in sight. Zargon waits.';

  return (
    <section
      className={'zpage' + (open ? ' open' : '')}
      aria-label="Zargon's turn"
      aria-hidden={!open}
      {...(open ? {} : { inert: '' as unknown as boolean })}
      data-keep
    >
      <div className="zh">
        <h2>Zargon&apos;s turn</h2>
        <span>Turn {state.turn}</span>
        <button className="link" onClick={onClose}>
          Back to the map
        </button>
      </div>

      <div className="seg" data-mode={mode}>
        <span className="thumb" />
        <button aria-pressed={mode === 'priority'} onClick={() => setMode('priority')}>
          Priority list
        </button>
        <button aria-pressed={mode === 'reach'} onClick={() => setMode('reach')}>
          Who can it reach?
        </button>
      </div>
      <p className="seg-help">{MODE_HELP[mode]}</p>

      <ol className="orders">
        {orders.length === 0 && (
          <li className="order">
            <div />
            <div>
              <i>{empty}</i>
            </div>
          </li>
        )}

        {mode === 'priority' &&
          groups.map(({ group, number, open: openIds }) => {
            const o = group.order;
            const many = group.monsters.length > 1;
            return (
              <li
                key={group.key + group.monsters.join()}
                className={'order' + (group.done ? ' done' : '')}
              >
                <div className="num">{group.done ? '✓' : number}</div>
                <div>
                  <h4>
                    {group.monsters.map((m) => (
                      <span key={m} className="coin">
                        {code(m)}
                      </span>
                    ))}
                    <span>{o.name}</span>
                    {many && <span className="x">× {group.monsters.length}</span>}
                    {o.status === 'act' && !group.done && (
                      <button
                        className="link"
                        onClick={() => done(openIds)}
                        aria-label={`Done: ${o.name}`}
                      >
                        Done
                      </button>
                    )}
                  </h4>
                  {!group.done && <Entry order={o} />}
                  {!group.done && o.status === 'act' && o.spell && (
                    <Spell
                      order={o}
                      members={openIds}
                      code={code}
                      onYes={(m) =>
                        dispatch({ type: 'SPELL_CAST', monster: m, spell: o.spell!.spell })
                      }
                      onNo={(m) =>
                        dispatch({ type: 'SPELL_FAILED', monster: m, spell: o.spell!.spell })
                      }
                    />
                  )}
                </div>
              </li>
            );
          })}

        {mode === 'reach' &&
          orders.map((o) => {
            const r = by[o.monster] ?? { reach: [], adj: [] };
            const res = o.status === 'act' ? reachOrder(o, r.reach, r.adj) : undefined;
            return (
              <li key={o.monster} className={'order' + (o.done ? ' done' : '')}>
                <div className="num">{o.done ? '✓' : ''}</div>
                <div>
                  <h4>
                    <span className="coin">{code(o.monster)}</span>
                    <span>{o.name}</span>
                    {o.status === 'act' && !o.done && (
                      <button
                        className="link"
                        onClick={() => done([o.monster])}
                        aria-label={`Done: ${o.name} ${code(o.monster)}`}
                      >
                        Done
                      </button>
                    )}
                  </h4>
                  {o.status !== 'act' && <p className="rule">{o.note}</p>}
                  {o.status === 'act' && !o.done && (
                    <>
                      <div className="rulehint">{o.ruleText}.</div>
                      <div className="chips">
                        {team.map((h) => (
                          <button
                            key={h}
                            className="chip"
                            aria-pressed={r.reach.includes(h)}
                            onClick={() => toggle(o.monster, h)}
                          >
                            {HERO_NAMES[h]}
                          </button>
                        ))}
                      </div>
                      {r.reach.map((h) => (
                        <button
                          key={h}
                          className="link"
                          aria-pressed={r.adj.includes(h)}
                          onClick={() => toggleAdj(o.monster, h)}
                        >
                          {r.adj.includes(h) ? '✓ ' : ''}Already next to the {HERO_NAMES[h]}
                        </button>
                      ))}
                      {res && (
                        <div className="verdict" aria-live="polite">
                          <div>{res.text}</div>
                          {res.kind === 'rule' && (
                            <div>
                              Tie: <span className="tgt">{tieText(res.tie)}</span>
                            </div>
                          )}
                          <div className="vplan">{res.plan}</div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </li>
            );
          })}
      </ol>

      <div className="zfoot">
        <button className="btn" onClick={onEndTurn}>
          End Zargon&apos;s turn
        </button>
      </div>
    </section>
  );
}

function Entry({ order: o }: { order: Order }) {
  if (o.status !== 'act') return <p className="rule">{o.note}</p>;
  return (
    <>
      <dl>
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
function Spell({
  order: o,
  members,
  code,
  onYes,
  onNo,
}: {
  order: Order;
  members: readonly string[];
  code(id: string): string;
  onYes(monster: string): void;
  onNo(monster: string): void;
}) {
  const sp = o.spell;
  if (!sp) return null;
  return (
    <div className="spell">
      <div className="sname">
        <b>{sp.name}</b> <span className="x">{leftLabel(sp.left)}</span>
      </div>
      <div className="scond">{sp.effect}</div>
      {o.fallbackPlan && <div className="scond">If it cannot cast: {o.fallbackPlan}</div>}
      <div className="sask">Could it cast it?</div>
      {members.map((m) => (
        <div key={m} className="row">
          <button
            className="btn"
            aria-label={members.length > 1 ? `Yes, ${code(m)} cast it` : undefined}
            onClick={() => onYes(m)}
          >
            Yes, it cast it
          </button>
          <button
            className="btn alt"
            aria-label={members.length > 1 ? `No, ${code(m)} could not` : undefined}
            onClick={() => onNo(m)}
          >
            No
          </button>
        </div>
      ))}
    </div>
  );
}
