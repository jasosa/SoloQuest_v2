import { useState } from 'react';
import type { QuestRecord } from '../../persist/history';
import { t } from '../../i18n/t';
import { MiniMap } from './HomePage';
import { PageHeader, type Playable } from './parts';
import { QuestGrid, type QuestCardData } from './StartPages';

/** One entry of the box list on the left. */
export interface BoxEntry {
  readonly id: string;
  readonly name: string;
  readonly count: number;
  readonly color: string;
}

/** The pseudo box that lists the quests made on this device. */
export const MINE = 'mine';

/** "Played 2 times. Last time: won." */
function playedLine(r: QuestRecord | undefined): string {
  if (!r) return t('select.notPlayedYet', 'Not played yet.');
  const times =
    r.plays === 1
      ? t('select.playedOnce', 'Played once.')
      : t('select.playedTimes', 'Played {count} times.', { count: r.plays });
  const last =
    r.last === 'won'
      ? t('select.lastTimeWon', 'Last time: won.')
      : t('select.lastTimeNotFinished', 'Last time: not finished.');
  return `${times} ${last}`;
}

/** Play a quest: the boxes, the quests of the box, and the quest chosen (concept: "Play a quest"). */
export function PlayQuestPage({
  boxes,
  box,
  cards,
  records,
  boxName,
  onBox,
  onChoose,
  onBack,
}: {
  boxes: readonly BoxEntry[];
  box: string;
  cards: readonly QuestCardData[];
  /** The history of each quest, by quest id. */
  records: ReadonlyMap<string, QuestRecord>;
  boxName: string;
  onBox(id: string): void;
  onChoose(playable: Playable): void;
  onBack(): void;
}) {
  const [picked, setPicked] = useState<string | undefined>();
  const chosen = cards.find((c) => c.playable && c.playable.key === picked);
  const p = chosen?.playable;
  const marked = cards.map((c) => ({
    ...c,
    selected: c.playable !== undefined && c.playable.key === picked,
    note: c.note ?? (c.playable && records.get(c.playable.key)?.last === 'won' ? '✓' : undefined),
  }));
  return (
    <>
      <PageHeader
        title={t('select.playAQuest', 'Play a quest')}
        hint={t('select.oneQuestNothingCarried', 'One quest, nothing carried over.')}
        onBack={onBack}
      />
      <main className="stage play-quest">
        <nav className="box-list" aria-label={t('select.boxes', 'Boxes')}>
          {boxes.map((b) => (
            <button
              key={b.id}
              className="box-pick"
              aria-pressed={b.id === box}
              data-testid={`pack-${b.id}`}
              style={{ '--box': b.color } as React.CSSProperties}
              onClick={() => {
                setPicked(undefined);
                onBox(b.id);
              }}
            >
              <span className="box-name">{b.name}</span>
              <span className="box-count">{b.count}</span>
            </button>
          ))}
        </nav>
        <div className="quest-col">
          {cards.length === 0 && box === MINE && (
            <p className="hint">
              {t('select.questsYouMakeIn', 'Quests you make in the editor are listed here.')}
            </p>
          )}
          <QuestGrid cards={marked} onPick={(c) => c.playable && setPicked(c.playable.key)} />
        </div>
        <aside className="detail" data-testid="quest-detail">
          {p ? (
            <>
              <div className="lbl">
                {p.number === undefined
                  ? boxName
                  : t('select.boxQuest', '{box} · Quest {number}', {
                      box: boxName,
                      number: p.number,
                    })}
              </div>
              <h2>{p.level.quest.title}</h2>
              <MiniMap level={p.level} width={250} />
              <p className="summary">{p.level.quest.intro.summary}</p>
              <p className="hint" data-testid="quest-played">
                {playedLine(records.get(p.key))}
              </p>
              <button className="btn" data-testid="choose-heroes" onClick={() => onChoose(p)}>
                {t('select.chooseHeroes', 'Choose heroes')}
              </button>
            </>
          ) : (
            <p className="hint">{t('select.selectAQuest', 'Select a quest.')}</p>
          )}
        </aside>
      </main>
    </>
  );
}
