import type { EndingView, ObjectiveConfirm, ObjectivesView } from '../../engine/game/view';
import { t } from '../../i18n/t';
import { NoteCard } from '../shared/NoteCard';

/** A way to end the quest, before the players have confirmed it. */
export type EndChoice =
  | { readonly outcome: 'stairs'; readonly finished: boolean }
  | { readonly outcome: 'fell' }
  | { readonly outcome: 'ending'; readonly ending: EndingView };

export interface EndSheetProps {
  objectives: ObjectivesView;
  /** Confirm buttons that can be pressed now. */
  confirms: readonly ObjectiveConfirm[];
  endings: readonly EndingView[];
  /** "by the stairs", "through the exit door", or the quest's own words. */
  way: string;
  onConfirm(objective: string): void;
  onChoose(choice: EndChoice): void;
  onClose(): void;
}

/**
 * The one sheet that ends a quest: the objectives as a checklist with their confirm buttons, then
 * the ways to end. Choosing a way only asks (`EndAsk`); the engine event is sent there.
 */
export function EndSheet(p: EndSheetProps) {
  const { goalDone, items } = p.objectives;
  return (
    <NoteCard
      kind={t('play.EndSheet.theQuest', 'The quest')}
      title={t('play.EndSheet.goalAndEnding', 'Goal and ending')}
      onClose={p.onClose}
    >
      {items.length > 0 && (
        <ul className="goals" data-testid="end-goals">
          {items.map((o) => (
            <li key={o.id} className={o.done ? 'done' : ''}>
              <span className="tick" aria-hidden="true">
                {o.done ? '✓' : ''}
              </span>
              <span>
                {o.text}
                <span className="sr">
                  {' '}
                  {o.done
                    ? t('play.EndSheet.done', '(done)')
                    : t('play.EndSheet.notDone', '(not done)')}
                </span>
                {p.confirms
                  .filter((c) => c.objective === o.id)
                  .map((c) => (
                    <button
                      key={c.objective}
                      className="btn alt"
                      onClick={() => p.onConfirm(c.objective)}
                    >
                      {c.label}
                    </button>
                  ))}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="endways">
        {goalDone ? (
          <button
            className="btn"
            data-testid="end-finish"
            onClick={() => p.onChoose({ outcome: 'stairs', finished: true })}
          >
            {t('play.EndSheet.finishTheQuest', 'Finish the quest')}
          </button>
        ) : (
          <button
            className="btn alt"
            data-testid="end-leave"
            onClick={() => p.onChoose({ outcome: 'stairs', finished: false })}
          >
            {items.length > 0
              ? t('play.EndSheet.leaveWithoutFinishing', 'Leave without finishing')
              : t('play.EndSheet.heroesLeft', 'Heroes left {way}', { way: p.way })}
          </button>
        )}
        {p.endings.map((e) => (
          <button
            key={e.id}
            className="btn alt"
            onClick={() => p.onChoose({ outcome: 'ending', ending: e })}
          >
            {e.label}
          </button>
        ))}
        <button className="btn alt" onClick={() => p.onChoose({ outcome: 'fell' })}>
          {t('play.EndSheet.allHeroesFell', 'All heroes fell')}
        </button>
        <button className="btn alt" onClick={p.onClose}>
          {t('play.EndSheet.keepPlaying', 'Keep playing')}
        </button>
      </div>
    </NoteCard>
  );
}

export interface EndAskProps {
  choice: EndChoice;
  way: string;
  onYes(): void;
  onBack(): void;
}

/** The one confirmation before a quest ends. Undo of the ending stays on the end card. */
export function EndAsk(p: EndAskProps) {
  const c = p.choice;
  const title =
    c.outcome === 'stairs'
      ? c.finished
        ? t('play.EndSheet.finishTheQuestAsk', 'Finish the quest?')
        : t('play.EndSheet.leaveWithoutFinishingAsk', 'Leave without finishing?')
      : c.outcome === 'fell'
        ? t('play.EndSheet.allHeroesFellAsk', 'All heroes fell?')
        : t('play.EndSheet.endingAsk', '{label}?', { label: c.ending.label });
  const text =
    c.outcome === 'stairs'
      ? c.finished
        ? t('play.EndSheet.heroesLeftDone', 'The heroes left {way}.', { way: p.way })
        : t(
            'play.EndSheet.heroesLeftNotDone',
            'The heroes left {way}. The goal is not done, so the quest does not count as won.',
            { way: p.way },
          )
      : c.outcome === 'fell'
        ? t('play.EndSheet.noHeroLeft', 'No hero is left standing.')
        : (c.ending.text ?? '');
  return (
    <NoteCard kind={t('play.EndSheet.endQuest', 'End quest')} title={title} onClose={p.onBack}>
      {text && <p>{text}</p>}
      <button className="btn" data-testid="end-confirm" onClick={p.onYes}>
        {t('play.EndSheet.yesEndTheQuest', 'Yes, end the quest')}
      </button>
      <button className="btn alt" onClick={p.onBack}>
        {t('play.EndSheet.back', 'Back')}
      </button>
    </NoteCard>
  );
}
