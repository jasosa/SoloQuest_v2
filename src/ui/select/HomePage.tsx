import type { Level } from '../../engine/board/level';
import { cellKey } from '../../engine/board/level';
import { t } from '../../i18n/t';
import { PageHeader, type Playable } from './parts';
import type { LastGame } from './StartPages';

const CIRCLES: Record<string, readonly (readonly [number, number, number])[]> = {
  campaign: [
    [5, 7, 2],
    [12, 4, 2],
    [19, 7, 2],
  ],
  settings: [[12, 12, 4]],
};

/** A line drawing for a card: a sheet, a route, a pencil, a box, a sun. 28 px, ink strokes. */
export function Icon({ name }: { name: 'quest' | 'campaign' | 'editor' | 'box' | 'settings' }) {
  const paths: Record<string, string> = {
    quest: 'M7 3h10l4 4v14H7zM17 3v4h4M10 11h8M10 15h8M10 19h5',
    campaign: 'M3 20c3-8 6-10 9-10s6 2 9 10',
    editor: 'M4 20l1-5L16 4l4 4L9 19zM14 6l4 4',
    box: 'M12 3l8 4v10l-8 4-8-4V7zM4 7l8 4 8-4M12 11v10',
    settings: 'M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2',
  };
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
      {CIRCLES[name]?.map(([cx, cy, r]) => (
        <circle key={`${cx},${cy}`} cx={cx} cy={cy} r={r} />
      ))}
    </svg>
  );
}

/** The quest's board in miniature: rock in rose, the rest in paper. Squares are not tracked here. */
export function MiniMap({ level, width = 166 }: { level: Level; width?: number }) {
  const w = level.board.cells[0]?.length ?? 26;
  const h = level.board.cells.length;
  const cell = width / w;
  const rock: JSX.Element[] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (level.rock.has(cellKey(x, y)))
        rock.push(
          <rect
            key={`${x},${y}`}
            x={x * cell}
            y={y * cell}
            width={cell}
            height={cell}
            fill="var(--rock)"
          />,
        );
  return (
    <svg
      className="mini-map"
      width={width}
      height={cell * h}
      viewBox={`0 0 ${width} ${cell * h}`}
      role="img"
      aria-label={t('select.smallMapOfTheQuest', 'Small map of the quest')}
    >
      <rect width={width} height={cell * h} fill="var(--floor)" />
      {rock}
    </svg>
  );
}

export interface HomeCounts {
  readonly quests: number;
  readonly boxes: number;
  readonly campaignsInProgress: number;
  readonly own: number;
}

export function HomePage({
  last,
  counts,
  notice,
  orphans,
  onSingle,
  onCampaign,
  onContinue,
  onSettings,
  onCollection,
  onEditor,
  onDeleteOrphan,
}: {
  /** `undefined` while it is being looked for, `null` when there is none. */
  last: LastGame | null | undefined;
  counts: HomeCounts;
  notice: string | undefined;
  orphans: readonly { questId: string; message: string }[];
  onSingle(): void;
  onCampaign(): void;
  onContinue(): void;
  onSettings(): void;
  onCollection(): void;
  onEditor?: (() => void) | undefined;
  onDeleteOrphan(questId: string): void;
}) {
  const lastPlayable: Playable | undefined = last?.playable;
  return (
    <>
      <PageHeader title="">
        <button className="btn alt head-btn" data-testid="home-collection" onClick={onCollection}>
          <Icon name="box" />
          {t('select.myCollection', 'My collection')}
        </button>
        <button
          className="btn alt head-btn icon-only"
          data-testid="home-settings"
          aria-label={t('select.settings', 'Settings')}
          onClick={onSettings}
        >
          <Icon name="settings" />
        </button>
      </PageHeader>
      <main className="stage home">
        {last && lastPlayable ? (
          <section className="continue" data-testid="home-continue-card">
            <MiniMap level={lastPlayable.level} />
            <div className="continue-text">
              <div className="lbl">{t('select.continue', 'Continue')}</div>
              <h2>{lastPlayable.level.quest.title}</h2>
              <p className="hint" data-testid="home-continue-caption">
                {lastPlayable.number === undefined
                  ? t('select.lastGameOther', '{title}, turn {turn}', {
                      title: lastPlayable.level.quest.title,
                      turn: last.resumed.state.turn,
                    })
                  : t('select.lastGame', 'Quest {number}, {title}, turn {turn}', {
                      number: lastPlayable.number,
                      title: lastPlayable.level.quest.title,
                      turn: last.resumed.state.turn,
                    })}
              </p>
            </div>
            <button className="btn" data-testid="home-continue" onClick={onContinue}>
              {t('select.continue', 'Continue')}
            </button>
          </section>
        ) : (
          <p className="hint" data-testid="home-continue-none">
            {t('select.noSavedGameYet', 'No saved game yet.')}
          </p>
        )}
        <div className="home-cards">
          <button className="home-card" data-testid="home-single" onClick={onSingle}>
            <Icon name="quest" />
            <h2>{t('select.playAQuest', 'Play a quest')}</h2>
            <p>
              {t('select.playAQuestText', 'One quest from any of your boxes, or one of your own.')}
            </p>
            <span className="home-foot">
              {t('select.questsInBoxes', '{quests} quests in {boxes} boxes', {
                quests: counts.quests,
                boxes: counts.boxes,
              })}
            </span>
          </button>
          <button className="home-card" data-testid="home-campaign" onClick={onCampaign}>
            <Icon name="campaign" />
            <h2>{t('select.campaigns', 'Campaigns')}</h2>
            <p>
              {t(
                'select.campaignsText',
                'Play a box from the first quest to the last. Skip or replay any quest.',
              )}
            </p>
            <span className="home-foot">
              {t('select.campaignsInProgress', '{count} in progress', {
                count: counts.campaignsInProgress,
              })}
            </span>
          </button>
          {onEditor && (
            <button className="home-card" data-testid="home-editor" onClick={onEditor}>
              <Icon name="editor" />
              <h2>{t('select.questEditor', 'Quest editor')}</h2>
              <p>
                {t(
                  'select.questEditorText',
                  'Make your own quests and campaigns, or check a printed one.',
                )}
              </p>
              <span className="home-foot">
                {t('select.questsOfYourOwn', '{count} quests of your own', { count: counts.own })}
              </span>
            </button>
          )}
        </div>
        {notice && (
          <p className="hint" role="alert">
            {notice}
          </p>
        )}
        {orphans.map((o) => (
          <p key={o.questId} className="hint orphan" role="status" data-testid="orphan-save">
            {o.message}{' '}
            <button className="link" onClick={() => onDeleteOrphan(o.questId)}>
              {t('select.deleteTheSave', 'Delete the save')}
            </button>
          </p>
        ))}
      </main>
    </>
  );
}

export interface BoxRow {
  readonly id: string;
  readonly name: string;
  readonly quests: number;
  readonly always: boolean;
  readonly owned: boolean;
}

/** My collection: tick the boxes you own. Quests, heroes and editor pieces follow this list. */
export function CollectionPage({
  boxes,
  onToggle,
  onBack,
}: {
  boxes: readonly BoxRow[];
  onToggle(id: string, owned: boolean): void;
  onBack(): void;
}) {
  const ticked = boxes.filter((b) => b.owned).length;
  return (
    <>
      <PageHeader title={t('select.myCollection', 'My collection')} onBack={onBack}>
        <span className="hint head-hint">
          {t(
            'select.tickTheBoxesYou',
            'Tick the boxes you own. Quests, heroes and editor pieces follow this list.',
          )}
        </span>
      </PageHeader>
      <main className="stage collection">
        <div className="box-grid">
          {boxes.map((b) => (
            <label key={b.id} className={`box-row${b.owned ? ' on' : ''}`} data-box={b.id}>
              <span
                className={`box-bar box-${b.id === 'core' ? 'core' : 'other'}`}
                aria-hidden="true"
              />
              <span className="box-text">
                <span className="box-name">{b.name}</span>
                <span className="box-sub">
                  {b.always
                    ? t('select.nQuestsAlwaysOn', '{count} quests, always on', { count: b.quests })
                    : t('select.nQuestsCount', '{count} quests', { count: b.quests })}
                </span>
              </span>
              <input
                type="checkbox"
                checked={b.owned}
                disabled={b.always}
                data-testid={`own-${b.id}`}
                onChange={(e) => onToggle(b.id, e.target.checked)}
              />
            </label>
          ))}
        </div>
        <p className="hint">
          {t('select.boxesTicked', '{count} boxes ticked.', { count: ticked })}
        </p>
        <button className="btn" data-testid="collection-done" onClick={onBack}>
          {t('select.done', 'Done')}
        </button>
      </main>
    </>
  );
}
