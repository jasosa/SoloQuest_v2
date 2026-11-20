import { useStore } from 'zustand';
import { renameQuest, setStartArea, setSummary } from '../../engine/editor';
import { board, roomIds } from '../../engine/board/board';
import { Col, Fld, Frame, Panel } from '../shared/Frame';
import { ActionsPanel } from './ActionsPanel';
import type { EditorStore } from './editorStore';
import { ActionForm } from './NotesPanel';
import { FeaturesPanel } from './FeaturesPanel';
import { QuestPanel } from './QuestPanel';
import { MapsPanel } from './MapsPanel';
import { t } from '../../i18n/t';

/**
 * The Quest tab (the mockup of decision 70): the actions of the quest on the left, the general
 * fields and the objectives in the middle, the rules, wandering monster, endings and the quest's
 * own abilities and spells on the right.
 */
export function QuestTab({ store }: { store: EditorStore }) {
  const { quest } = useStore(store);
  const st = store.getState();
  return (
    <Frame>
      <Col label={t('editor.QuestTabs.actions', 'Actions')}>
        <Panel title={t('editor.QuestTabs.actions', 'Actions')} testId="quest-actions">
          <ActionsPanel store={store} />
        </Panel>
      </Col>
      <Col label={t('editor.QuestTabs.general', 'General')}>
        <Panel title={t('editor.QuestTabs.general', 'General')} testId="quest-general">
          <div className="fr-row2">
            <Fld label={t('editor.QuestTabs.title', 'Title')}>
              <input
                className="fr-in"
                aria-label={t('editor.QuestTabs.title', 'Title')}
                key={quest.title}
                defaultValue={quest.title}
                maxLength={80}
                onBlur={(e) => {
                  if (e.target.value === quest.title) return;
                  // an empty title is refused: the field goes back to the title the quest has
                  if (!st.apply((q) => renameQuest(q, e.target.value)))
                    e.target.value = quest.title;
                }}
              />
            </Fld>
            <Fld label={t('editor.QuestTabs.number', 'Number')}>
              <input
                className="fr-in"
                aria-label={t('editor.QuestTabs.number', 'Number')}
                value={quest.number}
                disabled
                readOnly
              />
            </Fld>
          </div>
          <Fld label={t('editor.QuestTabs.startRoom', 'Start room')}>
            {'area' in quest.start ? (
              <select
                className="fr-sel"
                aria-label={t('editor.QuestTabs.startRoom', 'Start room')}
                value={quest.start.area}
                onChange={(e) => st.apply((q) => setStartArea(q, e.target.value))}
              >
                {roomIds(board)
                  .filter((r) => r === quest.start.area || !quest.rock.rooms.includes(r))
                  .map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
              </select>
            ) : (
              <p className="fr-help">
                {t(
                  'editor.QuestTabs.theHeroesStartOutsideAnIron',
                  'The heroes start outside an iron entry door (set on the Map tab).',
                )}
              </p>
            )}
          </Fld>
          <Fld label={t('editor.QuestTabs.summary', 'Summary')}>
            <textarea
              className="fr-ta"
              aria-label={t('editor.QuestTabs.summary', 'Summary')}
              key={quest.intro.summary}
              defaultValue={quest.intro.summary}
              rows={4}
              onBlur={(e) => {
                if (e.target.value !== quest.intro.summary)
                  st.apply((q) => setSummary(q, e.target.value));
              }}
            />
          </Fld>
        </Panel>
        <Panel title={t('editor.QuestTabs.mapsAndLinks', 'Maps and links')} testId="quest-maps">
          <MapsPanel store={store} />
        </Panel>
        <Panel title={t('editor.QuestTabs.objectives', 'Objectives')} testId="quest-objectives">
          <QuestPanel store={store} only="objectives" />
        </Panel>
      </Col>
      <Col label={t('editor.QuestTabs.rules', 'Rules')}>
        <Panel title={t('editor.QuestTabs.rules', 'Rules')}>
          <QuestPanel store={store} only="rules" />
        </Panel>
        <Panel title={t('editor.QuestTabs.wanderingMonster', 'Wandering monster')}>
          <QuestPanel store={store} only="wandering" />
        </Panel>
        <Panel
          title={t('editor.QuestTabs.charactersBringInHelpers', 'Characters (bring-in helpers)')}
        >
          <QuestPanel store={store} only="characters" />
        </Panel>
        <Panel title={t('editor.QuestTabs.ending', 'Ending')}>
          <QuestPanel store={store} only="endings" />
        </Panel>
        <Panel
          title={t('editor.QuestTabs.leavingAndTextures', 'Leaving and textures')}
          testId="quest-features"
        >
          <FeaturesPanel store={store} />
        </Panel>
        <Panel
          title={t('editor.QuestTabs.abilitiesAndSpellsOf', 'Abilities and spells of this quest')}
        >
          <QuestPanel store={store} only="abilities" />
        </Panel>
      </Col>
    </Frame>
  );
}

/**
 * The Actions tab: the list of every action on the left and the selected action beside it, like
 * the Monsters tab (no popup over the text). Elsewhere an action still opens in the popup.
 */
export function ActionsTab({ store }: { store: EditorStore }) {
  const { quest, noteId } = useStore(store);
  const st = store.getState();
  const note = noteId ? quest.notes.find((n) => n.id === noteId) : undefined;
  return (
    <Frame narrow>
      <Col label={t('editor.QuestTabs.actions', 'Actions')}>
        <Panel title={t('editor.QuestTabs.actions', 'Actions')} testId="actions-list">
          <ActionsPanel store={store} />
        </Panel>
      </Col>
      <Col label={t('editor.QuestTabs.action', 'Action')}>
        {note ? (
          <Panel title={t('editor.QuestTabs.action', 'Action')} testId="action-card">
            <ActionForm key={note.id} store={store} note={note} quest={quest} />
            <button className="btn alt" onClick={() => st.setNoteId(null)}>
              {t('editor.QuestTabs.close', 'Close')}
            </button>
          </Panel>
        ) : (
          <Panel title={t('editor.QuestTabs.howActionsWork', 'How actions work')}>
            <p className="fr-help">
              {t(
                'editor.QuestTabs.anActionHappensAt',
                'An action happens at a moment of the quest, on a place, or on an element. Pick one on the left to change it. To add one to an element, select it on the Map or in the Monsters tab and use its Add action button.',
              )}
            </p>
          </Panel>
        )}
      </Col>
    </Frame>
  );
}
