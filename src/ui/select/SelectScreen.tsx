import { useEffect, useState } from 'react';
import { buildLevel, type Level } from '../../engine/board/level';
import { exportQuest } from '../../engine/editor/io';
import { HEROES, HERO_NAMES, type Hero } from '../../engine/data/heroes';
import { resume, type Resumed, type SaveStore } from '../../persist/saves';
import { clearOverride, getOverrides } from '../../persist/questOverrides';
import type { UserQuestStore } from '../../persist/userQuests';
import { useFitMode } from '../FitToScreen';
import { questEntries as bundledEntries } from '../quests';
import { SAVED_GAME_FAILED } from '../store/openSaved';
import { Dialog } from '../shared/Frame';
import { QuestSettingsCard } from '../shared/QuestSettingsCard';
import { CORE_PACK } from '../../engine/pack/registry';
import { packOfQuest, packs } from '../packs';

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
  /** Open the texture packs dialog. */
  onTextures?: (() => void) | undefined;
  /** The name of the texture pack in use, or null/undefined for the built-in look. */
  textureName?: string | null | undefined;
  /** Edited copies of bundled quests replace them in the list. */
  userStore?: UserQuestStore | undefined;
}

/** Save the edited quest as a file for the bundled folder (admin: publish for everyone). */
function downloadForPublishing(edited: Level, bundledId: string): void {
  try {
    const text = exportQuest({ ...edited.quest, id: bundledId });
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${bundledId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    /* nothing to do: the browser blocked the download */
  }
}

export function SelectScreen({
  saves,
  onStart,
  notice,
  onEditor,
  onTextures,
  textureName,
  userStore,
}: SelectScreenProps) {
  useFitMode('width');
  // Edited copies by bundled quest number. Reload after "Use original".
  const [edited, setEdited] = useState<ReadonlyMap<number, Level>>(new Map());
  useEffect(() => {
    if (!userStore) return;
    let live = true;
    void (async () => {
      const map = new Map<number, Level>();
      for (const [n, id] of Object.entries(getOverrides())) {
        try {
          // The editor autosaves a draft; Save removes it. A draft is the newest version, so play it.
          let level: Level | undefined;
          try {
            const draft = await userStore.loadDraft(id);
            if (draft) level = buildLevel(draft.quest);
          } catch {
            /* a draft that cannot be built is ignored: the saved copy is played */
          }
          if (!level) {
            const quest = await userStore.load(id);
            if (quest) level = buildLevel(quest);
          }
          if (level) map.set(Number(n), level);
        } catch {
          /* a broken copy is ignored: the original is played */
        }
      }
      if (live) setEdited(map);
    })();
    return () => {
      live = false;
    };
  }, [userStore]);
  const questEntries = bundledEntries.map((q) => {
    const level = edited.get(q.number);
    return level ? { ...q, level } : q;
  });

  /** A quest of this device (made in the editor) is shown with the core game. */
  const inPack = (questId: string) => packOfQuest(questId) ?? CORE_PACK;
  const [packId, setPackId] = useState<string>(CORE_PACK);
  const [number, setNumber] = useState<number | undefined>(
    () => questEntries.find((q) => q.level)?.number,
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [team, setTeam] = useState<readonly Hero[]>([]);
  const [saved, setSaved] = useState<{ id: string; r: Resumed } | undefined>();
  /** The Heroes popup of "New game". */
  const [choosing, setChoosing] = useState(false);

  const shown = questEntries.filter((q) =>
    q.level ? inPack(q.level.quest.id) === packId : packId === CORE_PACK,
  );
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

  const toggle = (h: Hero) =>
    setTeam((t) => (t.includes(h) ? t.filter((x) => x !== h) : [...t, h]));
  const ready = team.length >= 1;

  return (
    <div className="app select">
      <header>
        <span className="qn">SoloQuest</span>
        <h1>Choose a quest</h1>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {level && (
            <button
              className="link"
              data-testid="quest-settings"
              onClick={() => setSettingsOpen(true)}
            >
              Quest settings
            </button>
          )}
          {onTextures && (
            <button
              className="link"
              onClick={onTextures}
              data-testid="textures-link"
              aria-label={textureName ? `Textures: ${textureName} in use` : 'Textures'}
            >
              {textureName ? (
                <>
                  Textures: <b className="tex-name">{textureName}</b>
                </>
              ) : (
                'Textures'
              )}
            </button>
          )}
          {onEditor && (
            <button className="link" onClick={onEditor}>
              Quest editor
            </button>
          )}
        </span>
      </header>

      <div className="pickcol">
        <div className="packtabs" role="tablist" aria-label="Quest packs">
          {packs.packs.map((p) => (
            <button
              key={p.manifest.id}
              role="tab"
              className="chip"
              aria-selected={p.manifest.id === packId}
              data-testid={`pack-${p.manifest.id}`}
              onClick={() => {
                setPackId(p.manifest.id);
                const first = questEntries.find(
                  (q) => q.level && inPack(q.level.quest.id) === p.manifest.id,
                );
                if (first) setNumber(first.number);
              }}
            >
              {p.manifest.id === CORE_PACK ? 'Core game' : p.manifest.name}
            </button>
          ))}
        </div>

        <div className="pick">
          {shown.map((q) => (
            <button
              key={q.number}
              className="qcard"
              aria-pressed={q.number === number}
              disabled={!q.level}
              onClick={() => {
                setNumber(q.number);
              }}
            >
              <span className="qnum">Quest {q.number}</span>
              {q.level && <span className="qtitle">{q.level.quest.title}</span>}
              {edited.has(q.number) && <span className="qnote">Edited</span>}
              {!q.level && <span className="qnote">Not encoded yet</span>}
            </button>
          ))}
        </div>
      </div>

      <aside className="side">
        {level && (
          <>
            <section>
              <div className="lbl">Quest {level.quest.number}</div>
              <h2>{level.quest.title}</h2>
              {/* the story comes right under the title */}
              <p className="summary">{level.quest.intro.summary}</p>
              {edited.has(level.quest.number) && (
                <>
                  <p className="hint">This is your edited copy.</p>
                  <button
                    className="btn alt"
                    onClick={() => {
                      clearOverride(level.quest.number);
                      setEdited((m) => {
                        const next = new Map(m);
                        next.delete(level.quest.number);
                        return next;
                      });
                    }}
                  >
                    Use original
                  </button>
                  <button
                    className="btn alt"
                    onClick={() => {
                      const orig = bundledEntries.find((b) => b.number === level.quest.number);
                      if (orig?.level) downloadForPublishing(level, orig.level.quest.id);
                    }}
                  >
                    Export to publish (admin)
                  </button>
                </>
              )}
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

            <div className="actions">
              <button
                className={resumed ? 'btn alt' : 'btn'}
                data-testid="new-game"
                onClick={() => setChoosing(true)}
              >
                New game
              </button>
            </div>
          </>
        )}
      </aside>

      {settingsOpen && level && (
        <QuestSettingsCard
          questId={level.quest.id}
          title={level.quest.title}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {choosing && level && (
        <Dialog
          title="Choose your heroes"
          onClose={() => setChoosing(false)}
          foot={
            <>
              <button className="btn alt" autoFocus onClick={() => setChoosing(false)}>
                {resumed ? 'Keep the saved game' : 'Cancel'}
              </button>
              <button
                className="btn"
                disabled={!ready}
                aria-describedby={ready ? undefined : 'team-hint'}
                onClick={() => {
                  setChoosing(false);
                  onStart({ kind: 'new', level, team });
                }}
              >
                {resumed ? 'Replace it and start' : 'Start the quest'}
              </button>
            </>
          }
        >
          {resumed && (
            <p className="hint" role="alert">
              This replaces the saved game (turn {resumed.state.turn}). It cannot be brought back.
            </p>
          )}
          <div className="pick-heroes" role="group" aria-label="Heroes">
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
          <p className="hint" id="team-hint">
            {ready ? 'Pick 1 to 4 heroes.' : 'Pick 1 to 4 heroes to start the quest.'}
          </p>
        </Dialog>
      )}
    </div>
  );
}
