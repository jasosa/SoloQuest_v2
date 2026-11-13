import { useEffect, useState } from 'react';
import type { Level } from '../../engine/board/level';
import { HEROES, HERO_NAMES, type Hero } from '../../engine/data/heroes';
import { resume, type Resumed, type SaveStore } from '../../persist/saves';
import { questEntries } from '../quests';
import { SAVED_GAME_FAILED } from '../store/openSaved';

export type StartChoice =
  | { kind: 'new'; level: Level; team: readonly Hero[] }
  | { kind: 'resume'; level: Level; resumed: Extract<Resumed, { ok: true }> };

export interface SelectScreenProps {
  saves: SaveStore;
  onStart(choice: StartChoice): void;
  /** A short message to show, for example when a saved game could not be opened. */
  notice?: string | undefined;
  /** Open the quest editor. */
  onEditor?: (() => void) | undefined;
}

export function SelectScreen({ saves, onStart, notice, onEditor }: SelectScreenProps) {
  const [number, setNumber] = useState<number | undefined>(
    () => questEntries.find((q) => q.level)?.number,
  );
  const [team, setTeam] = useState<readonly Hero[]>([]);
  const [saved, setSaved] = useState<{ id: string; r: Resumed } | undefined>();
  const [confirming, setConfirming] = useState(false);

  const entry = questEntries.find((q) => q.number === number);
  const level = entry?.level;
  const questId = level?.quest.id;

  // Is there an autosave for the chosen quest?
  useEffect(() => {
    if (!level) return;
    let live = true;
    void resume(saves, level).then((r) => {
      if (live) setSaved({ id: level.quest.id, r });
    });
    return () => {
      live = false;
    };
  }, [saves, level]);

  const resumed = saved && saved.id === questId && saved.r.ok ? saved.r : undefined;
  const unusable = saved && saved.id === questId && !saved.r.ok && saved.r.reason !== 'none';

  const toggle = (h: Hero) => {
    setConfirming(false);
    setTeam((t) => (t.includes(h) ? t.filter((x) => x !== h) : [...t, h]));
  };
  const ready = team.length >= 1;

  return (
    <div className="app select">
      <header>
        <span className="qn">SoloQuest</span>
        <h1>Choose a quest</h1>
        {onEditor && (
          <button className="link" onClick={onEditor} style={{ marginLeft: 'auto' }}>
            Quest editor
          </button>
        )}
      </header>

      <div className="pick">
        {questEntries.map((q) => (
          <button
            key={q.number}
            className="qcard"
            aria-pressed={q.number === number}
            disabled={!q.level}
            onClick={() => {
              setNumber(q.number);
              setConfirming(false);
            }}
          >
            <span className="qnum">Quest {q.number}</span>
            {q.level && <span className="qtitle">{q.level.quest.title}</span>}
            {!q.level && <span className="qnote">Not encoded yet</span>}
          </button>
        ))}
      </div>

      <aside className="side">
        {level && (
          <>
            <section>
              <div className="lbl">Quest {level.quest.number}</div>
              <h2>{level.quest.title}</h2>
              <p className="summary">{level.quest.intro.summary}</p>
            </section>

            {resumed && (
              <section className="saved">
                <div className="lbl">Saved game</div>
                <p>
                  Turn {resumed.state.turn} · {resumed.team.map((h) => HERO_NAMES[h]).join(', ')}
                </p>
                <button className="btn" onClick={() => onStart({ kind: 'resume', level, resumed })}>
                  Resume
                </button>
              </section>
            )}
            {notice && !unusable && (
              <p className="hint" role="alert">
                {notice}
              </p>
            )}
            {unusable && (
              <p className="hint" role="alert">
                {SAVED_GAME_FAILED}
              </p>
            )}

            <section className="heroes">
              <div className="lbl">Your heroes</div>
              <div className="chips">
                {HEROES.map((h) => (
                  <button
                    key={h}
                    className="chip"
                    aria-pressed={team.includes(h)}
                    onClick={() => toggle(h)}
                  >
                    {HERO_NAMES[h]}
                  </button>
                ))}
              </div>
              <p className="hint">Pick 1 to 4 heroes.</p>
            </section>

            <div className="actions">
              {confirming && resumed ? (
                <div className="confirm" role="alertdialog" aria-label="Replace the saved game?">
                  <p className="hint">
                    Replace the saved game (turn {resumed.state.turn})? It cannot be brought back.
                  </p>
                  <button className="btn" onClick={() => onStart({ kind: 'new', level, team })}>
                    Replace it
                  </button>
                  <button className="btn alt" autoFocus onClick={() => setConfirming(false)}>
                    Keep the saved game
                  </button>
                </div>
              ) : (
                <button
                  className={resumed ? 'btn alt' : 'btn'}
                  disabled={!ready}
                  onClick={() =>
                    resumed ? setConfirming(true) : onStart({ kind: 'new', level, team })
                  }
                >
                  {resumed ? 'New game (replaces the saved one)' : 'Start the quest'}
                </button>
              )}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
