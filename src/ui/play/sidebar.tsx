/** Pieces of the right column for the notes engine. Presentational. */
import { HERO_NAMES, type Hero } from '../../engine/data/heroes';
import type {
  JournalEntry,
  ManualTrigger,
  NpcView,
  ObjectiveConfirm,
  ObjectivesView,
} from '../../engine/game/view';

export function Objectives({ view, intro }: { view: ObjectivesView; intro: string }) {
  return (
    <section className="goal">
      <div className="lbl">Your goal</div>
      {view.items.length === 0 ? (
        <p>{intro}</p>
      ) : (
        <ul className="goals">
          {view.items.map((o) => (
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
      )}
      {view.goalDone && (
        <p className="goal-done">Goal done. Bring the heroes back to the stairs.</p>
      )}
    </section>
  );
}

export function Helpers({ npcs }: { npcs: readonly NpcView[] }) {
  if (npcs.length === 0) return null;
  return (
    <section>
      <div className="lbl">Companions</div>
      <ul className="npcs">
        {npcs.map((n) => (
          <li key={n.id}>
            <div className="nm">{n.name}</div>
            <div className="st">
              {n.move !== undefined && <>Movement dice {n.move} · </>}
              {n.attack !== undefined && <>Attack dice {n.attack === 0 ? 'N/A' : n.attack} · </>}
              Defend dice {n.defend} · Body {n.body}
            </div>
            {n.text && <p>{n.text}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}

const firstLine = (e: JournalEntry) => {
  const text = e.title ?? e.texts[0] ?? e.choices[0]?.picked ?? '';
  const sentence = text.split(/(?<=[.!?])\s/)[0] ?? text;
  return sentence;
};

export function Journal({
  entries,
  onRead,
}: {
  entries: readonly JournalEntry[];
  onRead(id: string): void;
}) {
  return (
    <section>
      <div className="lbl">Quest notes</div>
      {entries.length === 0 ? (
        <p className="empty">No quest note read yet.</p>
      ) : (
        <ul className="journal">
          {entries.map((e) => (
            <li key={e.id}>
              <button data-hit className="jl" onClick={() => onRead(e.id)}>
                <b>{e.letter ?? '•'}</b>
                {firstLine(e)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function QuestActions({
  actions,
  confirms = [],
  onPress,
  onConfirm,
}: {
  actions: readonly ManualTrigger[];
  /** Confirm buttons of objectives (decision 67). */
  confirms?: readonly ObjectiveConfirm[];
  onPress(note: string): void;
  onConfirm?(objective: string): void;
}) {
  if (actions.length === 0 && confirms.length === 0) return null;
  return (
    <section>
      <div className="lbl">Quest actions</div>
      {actions.map((a) => (
        <button key={a.note} className="btn alt" onClick={() => onPress(a.note)}>
          {a.label}
        </button>
      ))}
      {confirms.map((c) => (
        <button key={c.objective} className="btn alt" onClick={() => onConfirm?.(c.objective)}>
          {c.label}
        </button>
      ))}
    </section>
  );
}

/** One chip per hero of the team. A tap asks "fell?". Only dead or alive is kept (decision 32). */
export function Heroes({
  team,
  dead,
  onTap,
}: {
  team: readonly Hero[];
  dead: readonly Hero[];
  onTap(hero: Hero): void;
}) {
  return (
    <section>
      <div className="lbl">Heroes</div>
      <div className="hero-chips">
        {team.map((h) => {
          const gone = dead.includes(h);
          return (
            <button
              key={h}
              data-hit
              className={'chip' + (gone ? ' fallen' : '')}
              disabled={gone}
              onClick={() => onTap(h)}
              aria-label={gone ? `${HERO_NAMES[h]} fell` : `${HERO_NAMES[h]}, tap if the hero fell`}
            >
              {HERO_NAMES[h]}
            </button>
          );
        })}
      </div>
    </section>
  );
}
