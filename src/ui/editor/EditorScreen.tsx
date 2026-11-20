import { useEffect, useMemo, useState } from 'react';
import type { ReferenceStore } from '../../persist/reference';
import { useStore } from 'zustand';
import { board } from '../../engine/board/board';
import {
  lettersMissingNotes,
  tileSizeUsed,
  tileUsage,
  validateQuestIssues,
  type MonsterKind,
} from '../../engine/editor';
import { FURNITURE_TYPES, MONSTER_TYPES } from '../../engine/quest/schema';
import { MONSTER_NAMES } from '../../engine/data/monsters';
import { FURNITURE_NAMES } from '../board/furnitureNames';
import { useFitMode } from '../FitToScreen';
import { EditorBoard } from './EditorBoard';
import type { Quest } from '../../engine/quest/schema';
import type { DoorTool, EditorStore, EditorTabName, Tool } from './editorStore';
import {
  BOARD_TILES,
  BOARD_TILE_TYPES,
  ROOM_TILES,
  ROOM_TILE_TYPES,
  MAX_TUNNEL_PAIRS,
  limitText,
  tileSpec,
} from '../../engine/data/roomTiles';
import { EDITOR_TABS, TopBar } from '../shared/Frame';
import { DesignerBody, type QuestSource, type QuestUpdater } from '../designer/DesignerScreen';
import { useLibrary } from '../designer/LibraryContext';
import type { LibraryStore } from '../../persist/library';
import { ActionsTab, QuestTab } from './QuestTabs';
import { MonstersTab } from './MonstersTab';
import { MapChips, MergesPanel } from './MapsPanel';
import { countLabel } from './problems';
import { AbilityDialog } from './AbilityDialog';
import { ActionDialog } from './ActionDialog';
import { SpellDialog } from './SpellDialog';
import { Inspector } from './Inspector';
import { pickTunnelDesign } from '../../engine/editor';
import { AlignDialog, ReferencePanel, useReference } from './ReferenceImage';
import { ImportButton, exportDraft } from './QuestFile';
import { deleteSelection, rotateSelection } from './selectionActions';
import { anyModalOpen } from '../shared/useModal';
import { FullMessage, ToastBox, toastMs } from '../shared/Toast';
import { ThemeScope, useActiveTheme } from '../theme/activeTheme';
import { setEditorTextures, useEditorTextures } from '../theme/editorTextures';
import { CLASSIC_THEME } from '../theme/theme';
import { t } from '../../i18n/t';

/** "Ice Vault 1 of 2": a tile chip with how many the quest has and the limit of the box. */
function tileChipName(name: string, u: { used: number; max: number | undefined }): string {
  return u.max === undefined ? name : `${name} ${u.used} of ${u.max}`;
}

const TOOLS: readonly { tool: Tool; label: string; key: string }[] = [
  { tool: 'select', label: 'Select', key: 's' },
  { tool: 'rock', label: 'Rock', key: 'k' },
  { tool: 'doors', label: 'Doors', key: 'd' },
  { tool: 'blocks', label: 'Blocks', key: 'b' },
  { tool: 'furniture', label: 'Furniture', key: 'f' },
  { tool: 'tiles', label: 'Tiles', key: 'i' },
  { tool: 'monsters', label: 'Monsters', key: 'm' },
  { tool: 'traps', label: 'Traps', key: 't' },
  { tool: 'markers', label: 'Markers', key: 'l' },
  { tool: 'zones', label: 'Zones', key: 'z' },
  { tool: 'merge', label: t('editor.EditorScreen.mergeRooms', 'Merge rooms'), key: 'g' },
  { tool: 'start', label: 'Start', key: 'h' },
];

const DOOR_TOOLS: readonly { kind: DoorTool; label: string }[] = [
  { kind: 'normal', label: 'Normal' },
  { kind: 'secret', label: 'Secret' },
  { kind: 'false', label: 'False' },
  { kind: 'tunnel', label: t('editor.EditorScreen.iceTunnel', 'Ice tunnel') },
  { kind: 'ironEntry', label: t('editor.EditorScreen.ironEntry', 'Iron entry') },
  { kind: 'woodenExit', label: t('editor.EditorScreen.woodenExit', 'Wooden exit') },
];

const TRAP_KINDS = [
  { kind: 'pit', label: 'Pit' },
  { kind: 'fallingBlock', label: t('editor.EditorScreen.fallingBlock', 'Falling block') },
  { kind: 'spear', label: 'Spear' },
  { kind: 'stalactite', label: 'Stalactite' },
  { kind: 'swingingAxe', label: t('editor.EditorScreen.swingingAxe', 'Swinging axe') },
  {
    kind: 'wanderingTrap',
    label: t('editor.EditorScreen.wanderingMonsters', 'Wandering monsters'),
  },
  { kind: 'slipperyIce', label: t('editor.EditorScreen.slipperyIce', 'Slippery ice') },
  { kind: 'chest', label: 'Chest' },
] as const;

export interface EditorScreenProps {
  store: EditorStore;
  onBack(): void;
  /** Where the reference image is kept on this device. Without it the image lives in memory only. */
  reference?: ReferenceStore;
  /** Play the draft in the real play screen. Nothing is saved. */
  onPlaytest?(quest: Quest): void;
  /** The Designer library and the quests it looks at, for the Designer tab. */
  library: LibraryStore;
  quests?: QuestSource;
  /** Change every quest made here (the Designer's "Update in all quests"). */
  updateQuests?: QuestUpdater;
}

export function EditorScreen({
  store,
  onBack,
  reference,
  onPlaytest,
  library,
  quests,
  updateQuests,
}: EditorScreenProps) {
  useFitMode('width');
  const s = useStore(store);
  const { quest, tool, toast, warnings, saveErrors, tab } = s;
  // The map uses the texture pack in use unless the person turned that off (View > Textures).
  const mapTextures = useEditorTextures();
  /** A message too long for its toast, shown whole. */
  const [fullMessage, setFullMessage] = useState<string | null>(null);
  const ref = useReference(quest.id, reference);
  const dropFile = async (file: File | undefined) => {
    if (!file) return;
    const problem = await ref.load(file);
    if (problem) store.getState().say(problem);
  };
  const issues = useMemo(() => validateQuestIssues(s.canon, board), [s.canon]);
  const errors = issues.filter((i) => i.severity === 'error').length;
  const dirty = s.canon !== s.clean;

  // Toasts go away on their own.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => store.getState().dismissToast(), toastMs(toast.text, 4000));
    return () => clearTimeout(t);
  }, [toast, store]);

  // Shortcuts (documented in DESIGN.md). Ignored while typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('input, textarea, select')) return;
      if (anyModalOpen()) return; // a dialog is open: Esc, Delete and the letters belong to it
      const st = store.getState();
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) st.redo();
        else st.undo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        st.redo();
        return;
      }
      if (mod || e.altKey) return;
      if (e.key === 'Escape') {
        st.setPendingBlock(null);
        if (st.picking) st.setPicking(null);
        else st.select(null);
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // only on the board (or with nothing focused): on a button Backspace must not delete the selection
        const onBoard = el === document.body || Boolean(el.closest('#editor-board'));
        if (st.selection && onBoard) {
          e.preventDefault();
          deleteSelection(store);
        }
        return;
      }
      if (e.key.toLowerCase() === 'r') {
        rotateSelection(store);
        return;
      }
      const t = TOOLS.find((x) => x.key === e.key.toLowerCase());
      if (t) st.setTool(t.tool);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [store]);

  return (
    <div className="app editor fr">
      <TopBar
        tabs={EDITOR_TABS}
        active={tab}
        badges={{ Actions: lettersMissingNotes(quest).length }}
        onTab={(t) => s.setTab(t as EditorTabName)}
      >
        <h1 className="fr-title">{quest.title}</h1>
        <span className="ed-status">
          {dirty
            ? t('editor.EditorScreen.unsavedChanges', 'Unsaved changes')
            : t('editor.EditorScreen.saved', 'Saved')}
        </span>
        {!s.stored && (
          <span className="ed-status ed-nostore" role="alert">
            {t(
              'editor.EditorScreen.thisDeviceCannotKeep',
              'This device cannot keep a draft. Save the quest, or Export it, before you leave.',
            )}
          </span>
        )}
      </TopBar>
      <div className="fr-bar" role="toolbar" aria-label={t('editor.EditorScreen.quest', 'Quest')}>
        <button
          className="chip ed-issues"
          onClick={() => {
            s.select(null);
            s.setTab('Map');
            s.setPanel('problems');
          }}
          data-errors={errors}
        >
          {countLabel(issues)}
        </button>
        {onPlaytest && (
          <button
            className="chip"
            data-testid="playtest"
            disabled={errors > 0}
            title={
              errors > 0
                ? t('editor.EditorScreen.fixTheProblemsFirst', 'Fix the problems first')
                : t('editor.EditorScreen.playThisQuestTo', 'Play this quest to try it')
            }
            onClick={() => onPlaytest(s.canon)}
          >
            {t('editor.EditorScreen.playtest', 'Playtest')}
          </button>
        )}
        <button className="chip" disabled={s.past.length === 0} onClick={() => s.undo()}>
          {t('editor.EditorScreen.undo', 'Undo')}
        </button>
        <button className="chip" disabled={s.future.length === 0} onClick={() => s.redo()}>
          {t('editor.EditorScreen.redo', 'Redo')}
        </button>
        <ImportButton store={store} />
        <button className="chip" data-testid="export" onClick={() => exportDraft(store)}>
          {t('editor.EditorScreen.export', 'Export')}
        </button>
        <button className="chip main" onClick={() => void s.save()}>
          {t('editor.EditorScreen.save', 'Save')}
        </button>
        <button className="link" onClick={onBack}>
          {t('editor.EditorScreen.back', 'Back')}
        </button>
      </div>

      {tab === 'Quest' && <QuestTab store={store} />}
      {tab === 'Actions' && <ActionsTab store={store} />}
      {tab === 'Monsters' && <MonstersTab store={store} />}
      {tab === 'Library' && (
        <DesignerBody store={library} quests={quests} updateQuests={updateQuests} />
      )}
      {tab === 'Map' && (
        <div className="ed-body">
          <nav className="ed-tools" aria-label={t('editor.EditorScreen.tools', 'Tools')}>
            <MapChips store={store} />
            <div className="ed-chips">
              {TOOLS.map((tv) => (
                <button
                  key={tv.tool}
                  className="chip"
                  aria-pressed={tool === tv.tool}
                  title={t('editor.EditorScreen.shortcut', 'Shortcut {v1}', {
                    v1: tv.key.toUpperCase(),
                  })}
                  onClick={() => s.setTool(tv.tool)}
                >
                  {tv.label}
                </button>
              ))}
            </div>
            <ToolOptions store={store} />
            <ReferencePanel api={ref} say={s.say} />
          </nav>

          <main
            className="ed-board"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void dropFile(e.dataTransfer.files[0]);
            }}
          >
            <ThemeScope theme={mapTextures ? undefined : CLASSIC_THEME}>
              <EditorBoard store={store} reference={ref} />
            </ThemeScope>
            {warnings.length > 0 && (
              <div className="ed-warnings" role="status">
                <button className="link" onClick={() => s.dismissWarnings()}>
                  {t('editor.EditorScreen.dismiss', 'Dismiss')}
                </button>
                <ul>
                  {warnings.map((w, i) => (
                    <li key={i}>{w.message}</li>
                  ))}
                </ul>
              </div>
            )}
          </main>

          <aside
            className="ed-inspector"
            aria-label={t('editor.EditorScreen.inspector', 'Inspector')}
          >
            <Inspector store={store} issues={issues} saveErrors={saveErrors} />
          </aside>
        </div>
      )}

      <ActionDialog store={store} />
      <AbilityDialog store={store} />
      <SpellDialog store={store} />

      {ref.aligning && ref.state && <AlignDialog api={ref} say={s.say} />}

      {toast && (
        <ToastBox
          key={toast.id}
          text={toast.text}
          onMore={(text) => {
            setFullMessage(text);
            s.dismissToast();
          }}
        />
      )}
      {fullMessage && <FullMessage text={fullMessage} onClose={() => setFullMessage(null)} />}
    </div>
  );
}

function ToolOptions({ store }: { store: EditorStore }) {
  const { tool, opts, quest } = useStore(store);
  const set = store.getState().setOpts;
  const library = useLibrary();
  const lib = { abilities: library.abilities, spells: library.spells };
  const mine = new Set(quest.enemyDefs.map((e) => e.id));
  const libEnemies = library.addable.enemies.filter((e) => !mine.has(e.id));
  // the switch only means something when a texture pack is in use
  const packInUse = useActiveTheme().id !== CLASSIC_THEME.id;
  const mapTextures = useEditorTextures();
  const chip = (label: string, on: boolean, onClick: () => void) => (
    <button key={label} className="chip" aria-pressed={on} onClick={onClick}>
      {label}
    </button>
  );
  return (
    <div className="ed-options">
      {tool === 'rock' && (
        <>
          <div className="lbl">{t('editor.EditorScreen.rock', 'Rock')}</div>
          {chip(t('editor.EditorScreen.wholeRoom', 'Whole room'), opts.rockRoom, () =>
            set({ rockRoom: !opts.rockRoom }),
          )}
        </>
      )}
      {tool === 'doors' && (
        <>
          <div className="lbl">{t('editor.EditorScreen.doorKind', 'Door kind')}</div>
          <div className="ed-chips ed-small">
            {DOOR_TOOLS.map((d) =>
              chip(d.label, opts.doorKind === d.kind, () => set({ doorKind: d.kind })),
            )}
          </div>
          {opts.doorKind === 'tunnel' && (
            <>
              <div className="lbl">{t('editor.EditorScreen.design', 'Design')}</div>
              <div
                className="ed-chips ed-nums"
                role="group"
                aria-label={t('editor.EditorScreen.nextTunnelDesign', 'Next tunnel design')}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                  <button
                    key={d}
                    className="chip"
                    aria-pressed={pickTunnelDesign(quest, opts.tunnelDesign) === d}
                    disabled={quest.tunnels.some((t) => t.design === d)}
                    onClick={() => set({ tunnelDesign: d })}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <p className="ed-note" data-testid="tunnel-limit">
                {t(
                  'editor.EditorScreen.iceTunnelOfPairs',
                  'Ice tunnel {count} of {MAX_TUNNEL_PAIRS} pairs. Tap end A, then end B.',
                  { count: quest.tunnels.length, MAX_TUNNEL_PAIRS },
                )}
              </p>
            </>
          )}
          {(opts.doorKind === 'ironEntry' || opts.doorKind === 'woodenExit') && (
            <p className="ed-note">
              {t(
                'editor.EditorScreen.tapTheOuterEdge',
                'Tap the outer edge of a square on the board border, or an edge that touches rock.',
              )}
            </p>
          )}
        </>
      )}
      {tool === 'blocks' && (
        <>
          <div className="lbl">{t('editor.EditorScreen.block', 'Block')}</div>
          <div className="ed-chips">
            {chip('Single', !opts.blockDouble, () => set({ blockDouble: false }))}
            {chip('Double', opts.blockDouble, () => set({ blockDouble: true }))}
          </div>
        </>
      )}
      {tool === 'furniture' && (
        <>
          <div className="lbl">{t('editor.EditorScreen.furniture', 'Furniture')}</div>
          <div className="ed-chips ed-small">
            {FURNITURE_TYPES.map((t) =>
              chip(FURNITURE_NAMES[t], opts.furnitureType === t, () => set({ furnitureType: t })),
            )}
          </div>
          <button
            className="btn alt"
            onClick={() => set({ furnitureTurned: !opts.furnitureTurned })}
            aria-pressed={opts.furnitureTurned}
          >
            {t('editor.EditorScreen.turnR', 'Turn (R)')}
          </button>
        </>
      )}
      {tool === 'tiles' && (
        <>
          <div className="lbl">{t('editor.EditorScreen.boardTiles', 'Board tiles')}</div>
          <div className="ed-chips ed-small" data-testid="board-tile-chips">
            {BOARD_TILE_TYPES.map((t) => {
              const u = tileUsage(quest, 'board', t);
              return chip(
                tileChipName(BOARD_TILES[t].name, u),
                opts.tile.group === 'board' && opts.tile.type === t,
                () => set({ tile: { group: 'board', type: t }, tileVariant: 0, tileTurned: false }),
              );
            })}
          </div>
          <div className="lbl">{t('editor.EditorScreen.roomTiles', 'Room tiles')}</div>
          <div className="ed-chips ed-small" data-testid="room-tile-chips">
            {ROOM_TILE_TYPES.map((t) => {
              const u = tileUsage(quest, 'room', t);
              return chip(
                tileChipName(ROOM_TILES[t].name, u),
                opts.tile.group === 'room' && opts.tile.type === t,
                () => set({ tile: { group: 'room', type: t }, tileVariant: 0, tileTurned: false }),
              );
            })}
          </div>
          {(() => {
            const pick = opts.tile;
            const spec = tileSpec(pick.group, pick.type);
            if (!spec || spec.laid)
              return (
                <p className="ed-note">
                  {t(
                    'editor.EditorScreen.tapSquaresToLay',
                    'Tap squares to lay it. Squares that touch make one tile.',
                  )}
                </p>
              );
            return (
              <>
                {spec.footprints.length > 1 && (
                  <>
                    <div className="lbl">{t('editor.EditorScreen.size', 'Size')}</div>
                    <div className="ed-chips" data-testid="tile-sizes">
                      {spec.footprints.map(([w, h], i) => {
                        const full =
                          spec.maxPerSize !== undefined &&
                          tileSizeUsed(quest, pick.group, pick.type, [w, h]) >= spec.maxPerSize;
                        return (
                          <button
                            key={`${w}x${h}`}
                            className="chip"
                            aria-pressed={opts.tileVariant === i}
                            disabled={full}
                            title={
                              full
                                ? t(
                                    'editor.EditorScreen.usedUpTheBox',
                                    'Used up: the box has {v1}',
                                    { v1: limitText(spec) },
                                  )
                                : undefined
                            }
                            onClick={() => set({ tileVariant: i })}
                          >
                            {w} x {h}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
                <button
                  className="btn alt"
                  onClick={() => set({ tileTurned: !opts.tileTurned })}
                  aria-pressed={opts.tileTurned}
                >
                  {t('editor.EditorScreen.turnR', 'Turn (R)')}
                </button>
                <p className="ed-note" data-testid="tile-limit">
                  {t(
                    'editor.EditorScreen.tapASquareFor',
                    '{name}: {v1}. Tap a square for the top left of the tile.',
                    { name: spec.name, v1: limitText(spec) },
                  )}
                </p>
              </>
            );
          })()}
        </>
      )}
      {tool === 'monsters' && (
        <>
          <div className="lbl">{t('editor.EditorScreen.monster', 'Monster')}</div>
          <div className="ed-chips ed-small">
            {MONSTER_TYPES.map((t: MonsterKind) =>
              chip(MONSTER_NAMES[t], !opts.monsterEnemy && opts.monsterType === t, () =>
                set({ monsterType: t, monsterEnemy: null }),
              ),
            )}
          </div>
          {(quest.enemyDefs.length > 0 || libEnemies.length > 0) && (
            <>
              <div className="lbl">
                {t('editor.EditorScreen.customMonsters', 'Custom monsters')}
              </div>
              <div className="ed-chips ed-small" data-testid="custom-monsters">
                {quest.enemyDefs.map((e) =>
                  chip(
                    e.name,
                    opts.monsterEnemy?.def.id === e.id && !opts.monsterEnemy.fromLibrary,
                    () => set({ monsterEnemy: { def: e, fromLibrary: false, lib } }),
                  ),
                )}
                {libEnemies.map((e) =>
                  chip(
                    `${e.name} (library)`,
                    opts.monsterEnemy?.def.id === e.id && opts.monsterEnemy.fromLibrary,
                    () => set({ monsterEnemy: { def: e, fromLibrary: true, lib } }),
                  ),
                )}
              </div>
            </>
          )}
        </>
      )}
      {tool === 'traps' && (
        <>
          <div className="lbl">{t('editor.EditorScreen.trap', 'Trap')}</div>
          <div className="ed-chips ed-small">
            {TRAP_KINDS.map((t) =>
              chip(t.label, opts.trapKind === t.kind, () => set({ trapKind: t.kind })),
            )}
          </div>
          {opts.trapKind === 'chest' && (
            <p className="ed-note">{t('editor.EditorScreen.clickAChest', 'Click a chest.')}</p>
          )}
        </>
      )}
      {tool === 'zones' && (
        <>
          <div className="lbl">{t('editor.EditorScreen.zone', 'Zone')}</div>
          <p className="ed-note">
            {t(
              'editor.EditorScreen.clickSquaresToAdd',
              'Click squares to add them to the zone, or to take them out.',
            )}
          </p>
          <div className="ed-chips" data-testid="zone-chips">
            {quest.zones.map((z) => chip(z.id, opts.zoneId === z.id, () => set({ zoneId: z.id })))}
            {chip(t('editor.EditorScreen.newZone', 'New zone'), opts.zoneId === null, () =>
              set({ zoneId: null }),
            )}
          </div>
        </>
      )}
      {tool === 'markers' && (
        <>
          <div className="lbl">{t('editor.EditorScreen.marker', 'Marker')}</div>
          <label className="ed-field">
            {t('editor.EditorScreen.label', 'Label')}
            <input
              value={opts.markerLabel}
              maxLength={40}
              onChange={(e) => set({ markerLabel: e.target.value })}
            />
          </label>
          <div className="ed-chips">
            {chip(
              t('editor.EditorScreen.editorOnly', 'Editor only'),
              opts.markerVisible === 'editor',
              () => set({ markerVisible: 'editor' }),
            )}
            {chip(
              t('editor.EditorScreen.playersSee', 'Players see'),
              opts.markerVisible === 'players',
              () => set({ markerVisible: 'players' }),
            )}
          </div>
        </>
      )}
      {tool === 'merge' && (
        <>
          <div className="lbl">{t('editor.EditorScreen.mergeRooms', 'Merge rooms')}</div>
          <p className="ed-note">
            {t(
              'editor.EditorScreen.mergeHelp',
              'A tile laid over two rooms makes them one room in this quest. This map only.',
            )}
          </p>
          <div data-testid="map-merges">
            <MergesPanel store={store} />
          </div>
        </>
      )}
      {tool === 'start' && (
        <p className="ed-note">
          {t('editor.EditorScreen.clickARoomTo', 'Click a room to make it the start.')}
        </p>
      )}
      <div className="lbl ed-gap">{t('editor.EditorScreen.view', 'View')}</div>
      {chip(t('editor.EditorScreen.roomIds', 'Room ids'), opts.roomIds, () =>
        set({ roomIds: !opts.roomIds }),
      )}
      {packInUse && (
        <button
          className="chip"
          aria-pressed={mapTextures}
          data-testid="editor-textures"
          onClick={() => setEditorTextures(!mapTextures)}
        >
          {t('editor.EditorScreen.textures', 'Textures: {v1}', { v1: mapTextures ? 'on' : 'off' })}
        </button>
      )}
    </div>
  );
}
