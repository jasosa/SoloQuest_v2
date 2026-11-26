/**
 * The options of each tool of the Map tab (decisions 104 and 105). The left Tools card holds the
 * tool chips and View; the options of a tool are in the right card, which is named after the tool,
 * in one layout: a small-caps label, chips or fields, one italic note.
 */
import { useStore } from 'zustand';
import { pickTunnelDesign, type MonsterKind } from '../../engine/editor';
import { FURNITURE_TYPES, MONSTER_TYPES } from '../../engine/quest/schema';
import { MONSTER_NAMES } from '../../engine/data/monsters';
import { MAX_TUNNEL_PAIRS } from '../../engine/data/roomTiles';
import { FURNITURE_NAMES } from '../board/furnitureNames';
import { useLibrary } from '../designer/LibraryContext';
import { CheckRow } from '../shared/Frame';
import { useActiveTheme } from '../theme/activeTheme';
import { setEditorTextures, useEditorTextures } from '../theme/editorTextures';
import { CLASSIC_THEME } from '../theme/theme';
import type { DoorTool, EditorStore, Tool } from './editorStore';
import { MergesPanel } from './MapsPanel';
import { TilePalette } from './TilePalette';
import { t } from '../../i18n/t';

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

const Chip = ({ label, on, onClick }: { label: string; on: boolean; onClick(): void }) => (
  <button className="chip" aria-pressed={on} onClick={onClick}>
    {label}
  </button>
);

type P = { store: EditorStore };

function RockOptions({ store }: P) {
  const { opts } = useStore(store);
  const set = store.getState().setOpts;
  return (
    <Chip
      label={t('editor.EditorScreen.wholeRoom', 'Whole room')}
      on={opts.rockRoom}
      onClick={() => set({ rockRoom: !opts.rockRoom })}
    />
  );
}

function DoorOptions({ store }: P) {
  const { opts, quest } = useStore(store);
  const set = store.getState().setOpts;
  return (
    <>
      <div className="lbl">{t('editor.EditorScreen.doorKind', 'Door kind')}</div>
      <div className="ed-chips ed-small">
        {DOOR_TOOLS.map((d) => (
          <Chip
            key={d.kind}
            label={d.label}
            on={opts.doorKind === d.kind}
            onClick={() => set({ doorKind: d.kind })}
          />
        ))}
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
                disabled={quest.tunnels.some((x) => x.design === d)}
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
  );
}

function BlockOptions({ store }: P) {
  const { opts } = useStore(store);
  const set = store.getState().setOpts;
  return (
    <>
      <div className="lbl">{t('editor.EditorScreen.size', 'Size')}</div>
      <div className="ed-chips">
        <Chip label="Single" on={!opts.blockDouble} onClick={() => set({ blockDouble: false })} />
        <Chip label="Double" on={opts.blockDouble} onClick={() => set({ blockDouble: true })} />
      </div>
    </>
  );
}

function FurnitureOptions({ store }: P) {
  const { opts } = useStore(store);
  const set = store.getState().setOpts;
  return (
    <>
      <div className="lbl">{t('editor.EditorScreen.type', 'Type')}</div>
      <div className="ed-chips ed-small">
        {FURNITURE_TYPES.map((f) => (
          <Chip
            key={f}
            label={FURNITURE_NAMES[f]}
            on={opts.furnitureType === f}
            onClick={() => set({ furnitureType: f })}
          />
        ))}
      </div>
      <button
        className="btn alt"
        onClick={() => set({ furnitureTurned: !opts.furnitureTurned })}
        aria-pressed={opts.furnitureTurned}
      >
        {t('editor.EditorScreen.turnR', 'Turn (R)')}
      </button>
    </>
  );
}

function MonsterOptions({ store }: P) {
  const { opts, quest } = useStore(store);
  const set = store.getState().setOpts;
  const library = useLibrary();
  const lib = { abilities: library.abilities, spells: library.spells };
  const mine = new Set(quest.enemyDefs.map((e) => e.id));
  const libEnemies = library.addable.enemies.filter((e) => !mine.has(e.id));
  return (
    <>
      <div className="lbl">{t('editor.EditorScreen.type', 'Type')}</div>
      <div className="ed-chips ed-small">
        {MONSTER_TYPES.map((m: MonsterKind) => (
          <Chip
            key={m}
            label={MONSTER_NAMES[m]}
            on={!opts.monsterEnemy && opts.monsterType === m}
            onClick={() => set({ monsterType: m, monsterEnemy: null })}
          />
        ))}
      </div>
      {(quest.enemyDefs.length > 0 || libEnemies.length > 0) && (
        <>
          <div className="lbl">{t('editor.EditorScreen.customMonsters', 'Custom monsters')}</div>
          <div className="ed-chips ed-small" data-testid="custom-monsters">
            {quest.enemyDefs.map((e) => (
              <Chip
                key={e.id}
                label={e.name}
                on={opts.monsterEnemy?.def.id === e.id && !opts.monsterEnemy.fromLibrary}
                onClick={() => set({ monsterEnemy: { def: e, fromLibrary: false, lib } })}
              />
            ))}
            {libEnemies.map((e) => (
              <Chip
                key={`lib:${e.id}`}
                label={`${e.name} (library)`}
                on={opts.monsterEnemy?.def.id === e.id && opts.monsterEnemy.fromLibrary}
                onClick={() => set({ monsterEnemy: { def: e, fromLibrary: true, lib } })}
              />
            ))}
          </div>
        </>
      )}
    </>
  );
}

function TrapOptions({ store }: P) {
  const { opts } = useStore(store);
  const set = store.getState().setOpts;
  return (
    <>
      <div className="lbl">{t('editor.EditorScreen.kind', 'Kind')}</div>
      <div className="ed-chips ed-small">
        {TRAP_KINDS.map((k) => (
          <Chip
            key={k.kind}
            label={k.label}
            on={opts.trapKind === k.kind}
            onClick={() => set({ trapKind: k.kind })}
          />
        ))}
      </div>
      {opts.trapKind === 'chest' && (
        <p className="ed-note">{t('editor.EditorScreen.clickAChest', 'Click a chest.')}</p>
      )}
    </>
  );
}

function ZoneOptions({ store }: P) {
  const { opts, quest } = useStore(store);
  const set = store.getState().setOpts;
  return (
    <>
      <p className="ed-note">
        {t(
          'editor.EditorScreen.clickSquaresToAdd',
          'Click squares to add them to the zone, or to take them out.',
        )}
      </p>
      <div className="ed-chips" data-testid="zone-chips">
        {quest.zones.map((z) => (
          <Chip
            key={z.id}
            label={z.id}
            on={opts.zoneId === z.id}
            onClick={() => set({ zoneId: z.id })}
          />
        ))}
        <Chip
          label={t('editor.EditorScreen.newZone', 'New zone')}
          on={opts.zoneId === null}
          onClick={() => set({ zoneId: null })}
        />
      </div>
    </>
  );
}

function MarkerOptions({ store }: P) {
  const { opts } = useStore(store);
  const set = store.getState().setOpts;
  return (
    <>
      <label className="ed-field">
        {t('editor.EditorScreen.label', 'Label')}
        <input
          value={opts.markerLabel}
          maxLength={40}
          onChange={(e) => set({ markerLabel: e.target.value })}
        />
      </label>
      <div className="ed-chips">
        <Chip
          label={t('editor.EditorScreen.editorOnly', 'Editor only')}
          on={opts.markerVisible === 'editor'}
          onClick={() => set({ markerVisible: 'editor' })}
        />
        <Chip
          label={t('editor.EditorScreen.playersSee', 'Players see')}
          on={opts.markerVisible === 'players'}
          onClick={() => set({ markerVisible: 'players' })}
        />
      </div>
    </>
  );
}

function MergeOptions({ store }: P) {
  return (
    <>
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
  );
}

function StartOptions() {
  return (
    <p className="ed-note">
      {t('editor.EditorScreen.clickARoomTo', 'Click a room to make it the start.')}
    </p>
  );
}

function OptionsOf({ store, tool }: { store: EditorStore; tool: Tool }) {
  switch (tool) {
    case 'rock':
      return <RockOptions store={store} />;
    case 'doors':
      return <DoorOptions store={store} />;
    case 'blocks':
      return <BlockOptions store={store} />;
    case 'furniture':
      return <FurnitureOptions store={store} />;
    case 'monsters':
      return <MonsterOptions store={store} />;
    case 'traps':
      return <TrapOptions store={store} />;
    case 'zones':
      return <ZoneOptions store={store} />;
    case 'markers':
      return <MarkerOptions store={store} />;
    case 'merge':
      return <MergeOptions store={store} />;
    case 'start':
      return <StartOptions />;
    case 'tiles':
      return <TilePalette store={store} />;
    default:
      return null;
  }
}

/** The options of the picked tool, in the right card. Select has its element, not options. */
export function RightToolOptions({ store }: P) {
  const { tool } = useStore(store);
  if (tool === 'select') return null;
  return (
    <div className="ed-options" data-testid="tool-options">
      <OptionsOf store={store} tool={tool} />
    </div>
  );
}

/** View: Room ids, and Textures when a texture pack is in use. */
export function ViewOptions({ store }: P) {
  const { opts } = useStore(store);
  const set = store.getState().setOpts;
  // the switch only means something when a texture pack is in use
  const packInUse = useActiveTheme().id !== CLASSIC_THEME.id;
  const mapTextures = useEditorTextures();
  return (
    <div className="ed-options">
      <div className="lbl ed-gap">{t('editor.EditorScreen.view', 'View')}</div>
      <CheckRow
        label={t('editor.EditorScreen.roomIds', 'Room ids')}
        on={opts.roomIds}
        onClick={() => set({ roomIds: !opts.roomIds })}
      />
      {packInUse && (
        <CheckRow
          testId="editor-textures"
          on={mapTextures}
          onClick={() => setEditorTextures(!mapTextures)}
          label={t('editor.EditorScreen.textures', 'Textures: {v1}', {
            v1: mapTextures ? 'on' : 'off',
          })}
        />
      )}
    </div>
  );
}
