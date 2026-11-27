/** Pieces of the Quest sheet for the notes engine. Presentational. */
import type { JournalEntry, ObjectivesView } from '../../engine/game/view';
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
