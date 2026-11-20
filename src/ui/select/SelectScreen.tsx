import { useEffect, useState } from 'react';
import { buildLevel, type Level } from '../../engine/board/level';
import { exportQuest } from '../../engine/editor/io';
import { labelOf, type TeamMember } from '../../engine/data/team';
import { TeamPicker } from './TeamPicker';
import {
  orphanSaves,
  resume,
  type OrphanSave,
  type Resumed,
  type SaveStore,
} from '../../persist/saves';
import { clearOverride, getOverrides } from '../../persist/questOverrides';
import type { UserQuestStore } from '../../persist/userQuests';
import { useFitMode } from '../FitToScreen';
import { questEntries as bundledEntries } from '../quests';
import { SAVED_GAME_FAILED } from '../store/openSaved';
import { Dialog } from '../shared/Frame';
import { QuestSettingsCard } from '../shared/QuestSettingsCard';
import { CORE_PACK } from '../../engine/pack/registry';
import { packOfQuest, packTabs, packs } from '../packs';

export type StartChoice =
  | { kind: 'new'; level: Level; team: readonly TeamMember[] }
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
  // Edited copies by bundled quest slot. Reload after "Use original".
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
    const level = edited.get(q.slot);
    return level ? { ...q, level } : q;
  });

  /** A quest of this device (made in the editor) is shown with the core game. */
  const inPack = (questId: string) => packOfQuest(questId) ?? CORE_PACK;
  /** The pack of an entry: an edited copy has a new id, so it stays in the pack of the quest it copies. */
  const packOfEntry = (q: { slot: number; level?: Level | undefined }) => {
    const original = bundledEntries.find((b) => b.slot === q.slot)?.level ?? q.level;
    return original ? inPack(original.quest.id) : CORE_PACK;
  };
  const [packId, setPackId] = useState<string>(CORE_PACK);
  const tabs = packTabs(packs, (id) => bundledEntries.some((q) => q.level?.quest.id === id));
  // Saved games that no quest here matches (for example a pack that is not installed).
  const [orphans, setOrphans] = useState<readonly OrphanSave[]>([]);
  useEffect(() => {
    let live = true;
    void (async () => {
      const known = new Set(bundledEntries.flatMap((q) => (q.level ? [q.level.quest.id] : [])));
      for (const id of Object.values(getOverrides())) known.add(id);
      for (const r of (await userStore?.list()) ?? []) known.add(r.id);
      const found = await orphanSaves(
        saves,
        (id) => known.has(id),
        (p) => packs.byId.has(p),
      );
      if (live) setOrphans(found);
    })();
    return () => {
      live = false;
    };
  }, [saves, userStore]);
  const [slot, setSlot] = useState<number | undefined>(
    () => questEntries.find((q) => q.level)?.slot,
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [team, setTeam] = useState<readonly TeamMember[]>([]);
  const [saved, setSaved] = useState<{ id: string; r: Resumed } | undefined>();
  /** The Heroes popup of "New game". */
  const [choosing, setChoosing] = useState(false);

  const shown = questEntries.filter((q) =>
    tabs.length === 0 ? true : q.level ? packOfEntry(q) === packId : packId === CORE_PACK,
  );
  const entry = questEntries.find((q) => q.slot === slot);
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

  // The packs whose heroes and allies the popup offers: the pack of the quest and the ones it needs.
  const questPack = level ? packOfEntry({ slot: slot ?? 0, level }) : CORE_PACK;
  const teamPacks = [...(packs.byId.get(questPack)?.requires ?? []), questPack]
    .map((id) => packs.byId.get(id)?.manifest)
    .filter((m) => m !== undefined);
  const ready = team.some((m) => m.kind === 'hero');

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
        {tabs.length > 0 && (
          <div className="packtabs" role="tablist" aria-label="Quest packs">
            {tabs.map((p) => (
              <button
                key={p.id}
                role="tab"
                className="chip"
                aria-selected={p.id === packId}
                data-testid={`pack-${p.id}`}
                onClick={() => {
                  setPackId(p.id);
                  const first = questEntries.find((q) => q.level && packOfEntry(q) === p.id);
                  if (first) setSlot(first.slot);
                }}
              >
                {p.name}
              </button>
            ))}
          </div>
        )}
        {orphans.map((o) => (
          <p key={o.questId} className="hint orphan" role="status" data-testid="orphan-save">
            {o.message}{' '}
            <button
              className="link"
              onClick={() => {
                void saves
                  .remove(o.questId)
                  .then(() => setOrphans((list) => list.filter((x) => x.questId !== o.questId)));
              }}
            >
              Delete the save
            </button>
          </p>
        ))}

        <div className="pick">
          {shown.map((q) => (
            <button
              key={q.slot}
              className="qcard"
              aria-pressed={q.slot === slot}
              disabled={!q.level}
              onClick={() => {
                setSlot(q.slot);
              }}
            >
              <span className="qnum">Quest {q.number}</span>
              {q.level && <span className="qtitle">{q.level.quest.title}</span>}
              {edited.has(q.slot) && <span className="qnote">Edited</span>}
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
              {level.quest.suggestedPack && (
                <p className="hint" data-testid="suggested-pack">
                  Looks best with the texture pack {level.quest.suggestedPack}.
                </p>
              )}
              {entry && edited.has(entry.slot) && (
                <>
                  <p className="hint">This is your edited copy.</p>
                  <button
                    className="btn alt"
                    onClick={() => {
                      if (entry) clearOverride(entry.slot);
                      setEdited((m) => {
                        const next = new Map(m);
                        if (entry) next.delete(entry.slot);
                        return next;
                      });
                    }}
                  >
                    Use original
                  </button>
                  <button
                    className="btn alt"
                    onClick={() => {
                      const orig = bundledEntries.find((b) => b.slot === entry?.slot);
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
                  Turn {resumed.state.turn} ·{' '}
                  {resumed.team.map((m) => labelOf(resumed.team, m.id)).join(', ')}
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
          <TeamPicker value={team} onChange={setTeam} packs={teamPacks} rule={level.quest.team} />
          <p className="hint" id="team-hint">
            {ready ? 'Pick 1 to 4 heroes.' : 'Pick 1 to 4 heroes to start the quest.'}
          </p>
        </Dialog>
      )}
    </div>
  );
}
