/** Pieces of the right column for the notes engine. Presentational. */
import { labelOf, type TeamMember } from '../../engine/data/team';
import type { JournalEntry, NpcView, ObjectivesView } from '../../engine/game/view';
import { t } from '../../i18n/t';

export function Objectives({
  view,
  intro,
  goalDoneText = t(
    'play.sidebar.goalDoneBringThe',
    'Goal done. Bring the heroes back to the stairs.',
  ),
}: {
  view: ObjectivesView;
  intro: string;
  goalDoneText?: string;
}) {
  return (
    <section className="goal">
      <div className="lbl">{t('play.sidebar.yourGoal', 'Your goal')}</div>
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
                <span className="sr">
                  {' '}
                  {o.done
                    ? t('play.sidebar.done', '(done)')
                    : t('play.sidebar.notDone', '(not done)')}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {view.goalDone && <p className="goal-done">{goalDoneText}</p>}
    </section>
  );
}

export function Helpers({ npcs }: { npcs: readonly NpcView[] }) {
  if (npcs.length === 0) return null;
  return (
    <section>
      <div className="lbl">{t('play.sidebar.companions', 'Companions')}</div>
      <ul className="npcs">
        {npcs.map((n) => (
          <li key={n.id}>
            <div className="nm">{n.name}</div>
            <div className="st">
              {n.move !== undefined && (
                <>{t('play.sidebar.movementDice', 'Movement dice {move} ·', { move: n.move })} </>
              )}
              {n.attack !== undefined && (
                <>
                  {t('play.sidebar.attackDice', 'Attack dice {v1} ·', {
                    v1: n.attack === 0 ? 'N/A' : n.attack,
                  })}{' '}
                </>
              )}
              {t('play.sidebar.defendDiceBody', 'Defend dice {defend} · Body {body}', {
                defend: n.defend,
                body: n.body,
              })}
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
      <div className="lbl">{t('play.sidebar.questNotes', 'Quest notes')}</div>
      {entries.length === 0 ? (
        <p className="empty">{t('play.sidebar.noQuestNoteRead', 'No quest note read yet.')}</p>
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

/** One chip per entry of the team (decision 38). A tap asks "fell?". Only dead or alive is kept (decision 32). */
export function Heroes({
  team,
  dead,
  onTap,
}: {
  team: readonly TeamMember[];
  dead: readonly string[];
  onTap(id: string): void;
}) {
  return (
    <section>
      <div className="lbl">
        {team.every((m) => m.kind === 'hero')
          ? t('play.sidebar.heroes', 'Heroes')
          : t('play.sidebar.team', 'Team')}
      </div>
      <div className="hero-chips">
        {team.map((m) => {
          const h = m.id;
          const name = labelOf(team, h);
          const gone = dead.includes(h);
          return (
            <button
              key={h}
              data-hit
              className={'chip' + (gone ? ' fallen' : '')}
              disabled={gone}
              onClick={() => onTap(h)}
              aria-label={gone ? `${name} fell` : `${name}, tap if it fell`}
            >
              {name}
            </button>
          );
        })}
      </div>
    </section>
  );
}
