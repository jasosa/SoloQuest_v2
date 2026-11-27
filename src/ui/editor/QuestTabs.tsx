import { useStore } from 'zustand';
import { renameQuest, setStartArea, setSummary } from '../../engine/editor';
import { board, roomIds } from '../../engine/board/board';
import { Col, DetailCard, Fld, Frame, Panel, Split } from '../shared/Frame';
import { ApprovalCard } from './ApprovalCard';
import { ActionsPanel } from './ActionsPanel';
import type { EditorStore } from './editorStore';
import { ActionCard } from './ActionCard';
import { FeaturesPanel } from './FeaturesPanel';
import { QuestPanel } from './QuestPanel';
import { MapsPanel } from './MapsPanel';
import { t } from '../../i18n/t';

/**
 * The Quest tab (concept screen 3): three numbered cards, 1 General, 2 Objectives and maps (with the
 * wandering monster) and 3 Rules. Under them, without a number: the characters (left), the ending
 * (middle), leaving and textures and the quest's own abilities and spells (right). Actions are only
 * in the Actions tab.
 */
export function QuestTab({ store }: { store: EditorStore }) {
  const { quest } = useStore(store);
  const st = store.getState();
  return (
    <Frame numbered>
      <Col label={t('editor.QuestTabs.general', 'General')}>
        <Panel num title={t('editor.QuestTabs.general', 'General')} testId="quest-general">
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
        <ApprovalCard store={store} />
        <Panel
          title={t('editor.QuestTabs.charactersBringInHelpers', 'Characters (bring-in helpers)')}
        >
          <QuestPanel store={store} only="characters" />
        </Panel>
      </Col>
      <Col label={t('editor.QuestTabs.objectivesAndMaps', 'Objectives and maps')}>
        <Panel num title={t('editor.QuestTabs.objectivesAndMaps', 'Objectives and maps')}>
          <div data-testid="quest-objectives">
            <QuestPanel store={store} only="objectives" />
          </div>
          <div className="fr-sub">{t('editor.QuestTabs.mapsAndLinks', 'Maps and links')}</div>
          <div data-testid="quest-maps">
            <MapsPanel store={store} />
          </div>
          <div className="fr-sub">
            {t('editor.QuestTabs.wanderingMonster', 'Wandering monster')}
          </div>
          <QuestPanel store={store} only="wandering" />
        </Panel>
        <Panel title={t('editor.QuestTabs.ending', 'Ending')}>
          <QuestPanel store={store} only="endings" />
        </Panel>
      </Col>
      <Col label={t('editor.QuestTabs.rules', 'Rules')}>
        <Panel num title={t('editor.QuestTabs.rules', 'Rules')}>
          <QuestPanel store={store} only="rules" />
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
 * The Actions tab (concept screen 4): the list of every action on the left and the picked action
 * in a detail card on the right, like the Monsters tab. The card edits a draft: "Save action"
 * writes it, "Cancel" drops it. On the other tabs an action opens in a popup with the same card.
 */
export function ActionsTab({ store }: { store: EditorStore }) {
  const { noteDraft } = useStore(store);
  return (
    <Split>
      <div className="fr-picks-col" data-testid="actions-list">
        <ActionsPanel store={store} />
      </div>
      {noteDraft ? (
        <ActionCard store={store} />
      ) : (
        <DetailCard
          label={t('editor.QuestTabs.action', 'Action')}
          title={t('editor.QuestTabs.howActionsWork', 'How actions work')}
        >
          <p className="hintp">
            {t(
              'editor.QuestTabs.anActionHappensAt',
              'An action happens at a moment of the quest, on a place, or on an element. Pick one on the left to change it. To add one to an element, select it on the Map or in the Monsters tab and use its Add action button.',
            )}
          </p>
        </DetailCard>
      )}
    </Split>
  );
}
