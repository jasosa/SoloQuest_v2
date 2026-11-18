import { useRef, useState } from 'react';
import { useModal } from '../shared/useModal';
import type {
  JournalEntry,
  LogEntry,
  ManualTrigger,
  ObjectiveConfirm,
  ObjectivesView,
} from '../../engine/game/view';

const LOG_SHOWN = 12;

export interface QuestSheetProps {
  number: number | string;
  title: string;
  /** The quest summary shown on the quest list, so it can be read again in play. */
  intro: string;
  startTexts: readonly string[];
  objectives: ObjectivesView;
  confirms: readonly ObjectiveConfirm[];
  /** Buttons of notes that belong to no element. */
  actions: readonly ManualTrigger[];
  notes: readonly JournalEntry[];
  /** Oldest first, as `eventLog` gives it. */
  log: readonly LogEntry[];
  onClose(): void;
  onConfirm(objective: string): void;
  onPress(note: string): void;
  onRead(note: string): void;
}

const firstLine = (e: JournalEntry) => {
  const text = e.title ?? e.texts[0] ?? e.choices[0]?.picked ?? '';
  return text.split(/(?<=[.!?])\s/)[0] ?? text;
};

/**
 * The Quest sheet (decision 67): a panel on the right with the start instruction, the goal and
 * the quest intro, its confirm buttons (each under its objective), the Quest actions (buttons of notes with no element), the notes read and the log.
 * The board stays visible beside it. Esc or Close shuts it.
 */
export function QuestSheet(p: QuestSheetProps) {
  const sheet = useRef<HTMLDivElement>(null);
  const [all, setAll] = useState(false);
  // the board stays usable beside the sheet, so Tab is not trapped; focus goes to its title and comes back
  useModal(sheet, { onEscape: p.onClose, trap: false, focus: 'title' });

  const log = [...p.log].reverse();
  const shown = all ? log : log.slice(0, LOG_SHOWN);

  return (
    <div className="qsheet" ref={sheet} role="dialog" aria-label="Quest sheet" data-keep>
      <div className="qh">
        <div>
          <div className="kind">Quest {p.number}</div>
          <h2>{p.title}</h2>
        </div>
        <button className="x" aria-label="Close quest sheet" onClick={p.onClose}>
          ×
        </button>
      </div>

      <section data-testid="quest-intro">
        <div className="lbl">About this quest</div>
        <p>{p.intro}</p>
      </section>

      {p.startTexts.length > 0 && (
        <section>
          <div className="lbl">At the start</div>
          {p.startTexts.map((t, i) => (
            <p key={i}>{t}</p>
          ))}
        </section>
      )}

      <section>
        <div className="lbl">Goal</div>
        <ul className="goals">
          {p.objectives.items.map((o) => (
            <li key={o.id} className={o.done ? 'done' : ''}>
              <span className="tick" aria-hidden="true">
                {o.done ? '✓' : ''}
              </span>
              <span>
                {o.text}
                <span className="sr"> {o.done ? '(done)' : '(not done)'}</span>
                {/* the button that confirms this objective sits under it */}
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
        {p.objectives.goalDone && (
          <p className="goal-done">Goal done. Bring the heroes back to the stairs.</p>
        )}
      </section>

      {p.actions.length > 0 && (
        <section>
          <div className="lbl">Quest actions</div>
          {p.actions.map((a) => (
            <div key={a.note}>
              {a.hint && <p className="hint">{a.hint}</p>}
              <button className="btn alt" onClick={() => p.onPress(a.note)}>
                {a.label}
              </button>
            </div>
          ))}
        </section>
      )}

      <section>
        <div className="lbl">Notes read</div>
        {p.notes.length === 0 ? (
          <p className="empty">No quest note read yet.</p>
        ) : (
          <ul className="journal">
            {p.notes.map((e) => (
              <li key={e.id}>
                <button data-hit className="jl" onClick={() => p.onRead(e.id)}>
                  <b>{e.letter ?? '•'}</b>
                  {firstLine(e)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="lbl">What happened</div>
        <ul className="log">
          {shown.map((l, i) => (
            <li key={`${log.length - i}`}>
              <i>Turn {l.turn}</i>
              {l.note ? (
                <button className="jl" onClick={() => p.onRead(l.note!)}>
                  {l.text}
                </button>
              ) : (
                <span>{l.text}</span>
              )}
            </li>
          ))}
        </ul>
        {!all && log.length > LOG_SHOWN && (
          <button className="more" onClick={() => setAll(true)}>
            Show all
          </button>
        )}
      </section>
    </div>
  );
}
