/**
 * Quest tab panels for double quests and merged rooms (design/play-a/DESIGN.md, "Editor: double
 * quests"). Every change is an engine edit operation through the store, so undo works and a
 * refused change shows the engine sentence as a toast.
 */
import { useState } from 'react';
import { useStore } from 'zustand';
import {
  addLink,
  addMap,
  removeAreaMerge,
  removeLink,
  removeMap,
  stairsEnds,
  updateMap,
} from '../../engine/editor';
import { isMultiMap, questMaps } from '../../engine/quest/maps';
import { Fld } from '../shared/Frame';
import type { EditorStore } from './editorStore';
import { mergeTrial } from './mergePick';
import { t } from '../../i18n/t';

const endKey = (map: string, cell: readonly number[]) => `${map}|${cell[0]},${cell[1]}`;

/** The maps of the quest and the links between their stairways. */
export function MapsPanel({ store }: { store: EditorStore }) {
  const { canon, mapId } = useStore(store);
  const st = store.getState();
  const maps = questMaps(canon);
  const multi = isMultiMap(canon);
  const ends = stairsEnds(canon);
  const [first, setFirst] = useState('');
  const [second, setSecond] = useState('');
  const label = (e: { mapName: string; furniture: string }) => `${e.mapName}: ${e.furniture}`;

  const join = () => {
    const pick = (k: string) => ends.find((e) => endKey(e.map, e.cell) === k);
    const a = pick(first);
    const b = pick(second);
    if (!a || !b) {
      st.say(t('editor.MapsPanel.pickTheTwoStairways', 'Pick the two stairways to join.'));
      return;
    }
    if (
      st.applyQuest((q) => addLink(q, { map: a.map, cell: a.cell }, { map: b.map, cell: b.cell }))
    ) {
      setFirst('');
      setSecond('');
    }
  };

  return (
    <div data-testid="maps-panel">
      {multi &&
        maps.map((m) => (
          <div className="ed-row" key={m.id} data-testid="map-row" data-map={m.id}>
            <div className="ed-row-head">
              <span>{m.id}</span>
              <span>
                <button
                  className="chip"
                  aria-pressed={m.id === mapId}
                  aria-label={t('editor.MapsPanel.showMap', 'Show map {id}', { id: m.id })}
                  onClick={() => st.setMap(m.id)}
                >
                  {t('editor.MapsPanel.showOnMap', 'Show on map')}
                </button>{' '}
                <button
                  className="chip"
                  aria-label={t('editor.MapsPanel.deleteMap2', 'Delete map {id}', { id: m.id })}
                  onClick={() => st.applyQuest((q) => removeMap(q, m.id))}
                >
                  {t('editor.MapsPanel.deleteMap', 'Delete map')}
                </button>
              </span>
            </div>
            <div className="fr-row2">
              <Fld label={t('editor.MapsPanel.name', 'Name')}>
                <input
                  className="fr-in"
                  aria-label={t('editor.MapsPanel.mapName', 'Map {id} name', { id: m.id })}
                  key={`${m.id}:n:${m.name ?? ''}`}
                  defaultValue={m.name ?? ''}
                  placeholder={m.id}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v === (m.name ?? '')) return;
                    if (!st.applyQuest((q) => updateMap(q, m.id, { name: v === '' ? null : v })))
                      e.target.value = m.name ?? '';
                  }}
                />
              </Fld>
              <Fld label={t('editor.MapsPanel.id', 'Id')}>
                <input
                  className="fr-in"
                  aria-label={t('editor.MapsPanel.mapId', 'Map {id} id', { id: m.id })}
                  key={`${m.id}:i`}
                  defaultValue={m.id}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v === m.id) return;
                    if (!st.applyQuest((q) => updateMap(q, m.id, { id: v }))) e.target.value = m.id;
                  }}
                />
              </Fld>
            </div>
          </div>
        ))}
      {!multi && (
        <p className="fr-help">
          {t(
            'editor.MapsPanel.thisQuestHasOne',
            'This quest has one map. A double quest has two or more, joined by stairways.',
          )}
        </p>
      )}
      <button
        className="btn"
        data-testid="new-map"
        onClick={() => st.applyQuest((q) => addMap(q, {}))}
      >
        {t('editor.MapsPanel.newMap', 'New map')}
      </button>

      {multi && (
        <>
          <div className="lbl">{t('editor.MapsPanel.links', 'Links')}</div>
          {(canon.links ?? []).length === 0 && (
            <p className="fr-help">
              {t(
                'editor.MapsPanel.noLinksJoinA',
                'No links. Join a stairway of one map to a stairway of another, or the heroes cannot cross.',
              )}
            </p>
          )}
          {(canon.links ?? []).map((l) => (
            <div className="ed-row" key={l.id} data-testid="link-row" data-link={l.id}>
              <div className="ed-row-head">
                <span>
                  {l.id}: {maps.find((m) => m.id === l.a.map)?.name ?? l.a.map} {l.a.cell.join(',')}
                  {t('editor.MapsPanel.to', ' to ')}
                  {maps.find((m) => m.id === l.b.map)?.name ?? l.b.map} {l.b.cell.join(',')}
                </span>
                <button
                  className="chip"
                  aria-label={t('editor.MapsPanel.removeLink', 'Remove link {id}', { id: l.id })}
                  onClick={() => st.applyQuest((q) => removeLink(q, l.id))}
                >
                  {t('editor.MapsPanel.remove', 'Remove')}
                </button>
              </div>
            </div>
          ))}
          <div className="fr-row2" data-testid="link-tool">
            <Fld label={t('editor.MapsPanel.firstStairway', 'First stairway')}>
              <select
                className="fr-sel"
                aria-label={t('editor.MapsPanel.firstStairway', 'First stairway')}
                value={first}
                onChange={(e) => setFirst(e.target.value)}
              >
                <option value="">{t('editor.MapsPanel.pickAStairway', 'Pick a stairway')}</option>
                {ends.map((e) => (
                  <option key={endKey(e.map, e.cell)} value={endKey(e.map, e.cell)}>
                    {label(e)}
                  </option>
                ))}
              </select>
            </Fld>
            <Fld label={t('editor.MapsPanel.secondStairway', 'Second stairway')}>
              <select
                className="fr-sel"
                aria-label={t('editor.MapsPanel.secondStairway', 'Second stairway')}
                value={second}
                onChange={(e) => setSecond(e.target.value)}
              >
                <option value="">{t('editor.MapsPanel.pickAStairway', 'Pick a stairway')}</option>
                {ends.map((e) => (
                  <option key={endKey(e.map, e.cell)} value={endKey(e.map, e.cell)}>
                    {label(e)}
                  </option>
                ))}
              </select>
            </Fld>
          </div>
          <button className="btn" data-testid="join-link" onClick={join}>
            {t('editor.MapsPanel.join', 'Join')}
          </button>
          {ends.length < 2 && (
            <p className="fr-help">
              {t(
                'editor.MapsPanel.putAStairwayFurniture',
                'Put a stairway (furniture) on each map to join them.',
              )}
            </p>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Merge rooms (decision 106), in the right card. Two slots filled by tapping rooms on the board (the
 * first room stays, the second joins it), the Merge button, Clear, one inline error line, and a row
 * per room merged away, with Split. The map on show.
 */
export function MergesPanel({ store }: { store: EditorStore }) {
  const { quest, mergePick, mergeError, mergeRow } = useStore(store);
  const st = store.getState();
  const trial = mergeTrial(quest, mergePick);
  // a refused tap, else why the pair cannot be merged
  const error = mergeError ?? trial.error;
  const { a, joins } = mergePick;
  const slot = (room: string | null, role: string, active: boolean, testId: string) => (
    <div className={active ? 'mg-slot on' : 'mg-slot'} data-testid={testId}>
      {room ? <b>{room}</b> : <i>{t('editor.MapsPanel.tapARoom', 'Tap a room')}</i>}
      <span>{role}</span>
    </div>
  );
  return (
    <div className="mg" data-testid="merges-panel">
      <p className="ed-note">
        {t(
          'editor.MapsPanel.tapTheRoomThat',
          'Tap the room that stays, then every room that joins it. Each must touch.',
        )}
      </p>
      {slot(a, t('editor.MapsPanel.stays', 'Stays'), a === null, 'merge-slot-a')}
      {joins.map((room) => slot(room, t('editor.MapsPanel.joins', 'Joins'), false, 'merge-join'))}
      {slot(null, t('editor.MapsPanel.joins', 'Joins'), a !== null, 'merge-slot-next')}
      {error && (
        <div className="mg-err" role="alert" data-testid="merge-error">
          <span />
          <div>{error}</div>
        </div>
      )}
      <button
        className="btn"
        data-testid="merge-rooms"
        disabled={trial.state !== 'ready'}
        onClick={() => st.mergeNow()}
      >
        {a && joins.length > 0
          ? t('editor.MapsPanel.mergeInto', 'Merge {b} into {a}', { a, b: joins.join(', ') })
          : t('editor.MapsPanel.merge', 'Merge')}
      </button>
      <button
        className="btn alt mg-clear"
        disabled={trial.state === 'empty'}
        onClick={() => st.mergeClear()}
      >
        {t('editor.MapsPanel.clear', 'Clear')}
      </button>
      <div className="lbl mg-head">{t('editor.MapsPanel.mergedRooms', 'Merged rooms')}</div>
      {quest.areaOverrides.length === 0 && (
        <p className="ed-note">{t('editor.MapsPanel.noneYet', 'None yet.')}</p>
      )}
      {quest.areaOverrides.map((m) => (
        <div
          className={mergeRow === m.merge[1] ? 'mg-row on' : 'mg-row'}
          key={m.merge[1]}
          data-testid="merge-row"
        >
          <span className="mg-bar" />
          <button
            className="mg-pick"
            aria-pressed={mergeRow === m.merge[1]}
            onClick={() => st.setMergeRow(mergeRow === m.merge[1] ? null : m.merge[1])}
          >
            <b>
              {t('editor.MapsPanel.isPartOf', '{v1} is part of {v2}', {
                v1: m.merge[1],
                v2: m.merge[0],
              })}
            </b>
            <i>{t('editor.MapsPanel.oneRoomInPlay', 'One room in play.')}</i>
          </button>
          <button
            className="btn alt"
            aria-label={t('editor.MapsPanel.splitRoom', 'Split room {v1}', { v1: m.merge[1] })}
            onClick={() => {
              if (st.apply((q) => removeAreaMerge(q, m.merge[1]))) st.setMergeRow(null);
            }}
          >
            {t('editor.MapsPanel.split', 'Split')}
          </button>
        </div>
      ))}
    </div>
  );
}

/** One chip per map of a double quest, and New map (nothing for a quest with one map). */
export function MapChips({ store }: { store: EditorStore }) {
  const { canon, mapId } = useStore(store);
  if (!isMultiMap(canon)) return null;
  return (
    <div
      className="ed-chips"
      role="tablist"
      aria-label={t('editor.MapsPanel.maps', 'Maps')}
      data-testid="map-tabs"
    >
      {questMaps(canon).map((m) => (
        <button
          key={m.id}
          role="tab"
          className="chip"
          aria-selected={m.id === mapId}
          aria-pressed={m.id === mapId}
          data-map={m.id}
          onClick={() => store.getState().setMap(m.id)}
        >
          {m.name ?? m.id}
        </button>
      ))}
      <button
        className="chip"
        data-testid="tab-new-map"
        onClick={() => store.getState().applyQuest((q) => addMap(q, {}))}
      >
        {t('editor.MapsPanel.newMap', 'New map')}
      </button>
    </div>
  );
}
