/**
 * The right card of the Monsters tool (concept `editor-map-monsters-concept.html`): a list of kinds
 * (Core game, each expansion, This quest, My library), a kind opened as monster cards under a header
 * with a Back button, and a "Placing" row while a monster is picked. The grouping is
 * `monsterKinds.ts`; the colours are the box colours of My collection.
 */
import { useState, type CSSProperties } from 'react';
import { useStore } from 'zustand';
import { CORE_PACK } from '../../engine/pack/registry';
import { useBoxColors } from '../collection';
import { expansionOf } from '../designer/expansions';
import { useLibrary } from '../designer/LibraryContext';
import { packs } from '../packs';
import type { EditorStore } from './editorStore';
import { kindOfPick, monsterKinds, type Kind, type KindItem } from './monsterKinds';
import { t } from '../../i18n/t';

const BackIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12.5 4.5L7 10l5.5 5.5" />
  </svg>
);

export function MonsterKinds({ store }: { store: EditorStore }) {
  const { opts, quest } = useStore(store);
  const set = store.getState().setOpts;
  const library = useLibrary();
  const lib = { abilities: library.abilities, spells: library.spells };
  const [open, setOpen] = useState<string | null>(null);

  const installed = packs.packs.map((p) => p.manifest.id);
  const colors = useBoxColors(installed);
  /** The colour of a kind: its box, or the base game when it has none (This quest, My library). */
  const colorOf = (kind: Kind): string => {
    const pack =
      kind.expansion === undefined
        ? undefined
        : packs.packs.find((p) => p.manifest.name === kind.expansion);
    return colors[pack?.manifest.id ?? CORE_PACK] ?? 'var(--ink)';
  };
  const bar = (kind: Kind) => ({ '--box': colorOf(kind) }) as CSSProperties;

  const kinds = monsterKinds({
    questEnemies: quest.enemyDefs,
    libraryEnemies: library.addable.enemies,
    expansionOf: (e) => expansionOf('enemy', e.id, e),
  });
  const current = opts.monsterEnemy
    ? { enemy: opts.monsterEnemy.def, fromLibrary: opts.monsterEnemy.fromLibrary }
    : { type: opts.monsterType };
  const placing = opts.monsterPicked ? kindOfPick(kinds, current) : undefined;
  const isPicked = (it: KindItem): boolean =>
    opts.monsterPicked &&
    ('type' in it.pick
      ? !opts.monsterEnemy && opts.monsterType === it.pick.type
      : opts.monsterEnemy?.def.id === it.pick.enemy.id);
  const pick = (it: KindItem) =>
    'type' in it.pick
      ? set({ monsterType: it.pick.type, monsterEnemy: null, monsterPicked: true })
      : set({
          monsterEnemy: { def: it.pick.enemy, fromLibrary: it.pick.fromLibrary, lib },
          monsterPicked: true,
        });

  const kind = open ? kinds.find((k) => k.key === open) : undefined;

  return (
    <div className="mk" data-testid="monster-kinds">
      {placing && (
        <div className="mk-placing" style={bar(placing.kind)} data-testid="placing">
          <span className="mk-ptext">
            <b>{t('editor.MonsterKinds.placing', 'Placing {name}', { name: placing.item.name })}</b>
            <i>{t('editor.MonsterKinds.tapASquareToPlace', 'Tap a square to place it.')}</i>
          </span>
          <button className="btn alt" onClick={() => set({ monsterPicked: false })}>
            {t('editor.MonsterKinds.clear', 'Clear')}
          </button>
        </div>
      )}
      {!kind ? (
        <>
          <div className="mk-list" data-testid="monster-kind-list">
            {kinds.map((k) => (
              <button
                key={k.key}
                className="box-pick"
                style={bar(k)}
                data-kind={k.key}
                onClick={() => setOpen(k.key)}
              >
                <span>{k.label}</span>
                <span className="box-count">{k.items.length}</span>
              </button>
            ))}
          </div>
          <p className="ed-note">
            {opts.monsterPicked
              ? t(
                  'editor.MonsterKinds.stillPicked',
                  'Tap a square to place it, or pick another monster.',
                )
              : t(
                  'editor.MonsterKinds.pickAKindThen',
                  'Pick a kind, then a monster, then tap a square.',
                )}
          </p>
        </>
      ) : (
        <>
          <div className="mk-head" data-testid="monster-kind-open">
            <button
              className="mk-back"
              aria-label={t('editor.MonsterKinds.backToTheKinds', 'Back to the kinds')}
              onClick={() => setOpen(null)}
            >
              <BackIcon />
            </button>
            <div className="box-pick" aria-pressed="true" style={bar(kind)}>
              <span>{kind.label}</span>
              <span className="box-count">{kind.items.length}</span>
            </div>
          </div>
          {kind.items.length > 0 && (
            <div className="lbl">
              {t('editor.MonsterKinds.statsLine', 'Move · Att · Def · Body · Mind')}
            </div>
          )}
          <div className="mk-cards">
            {kind.items.map((it) => (
              <button
                key={it.id}
                className="mk-card"
                style={bar(kind)}
                aria-pressed={isPicked(it)}
                onClick={() => pick(it)}
              >
                <span className="mk-kind">{kind.label}</span>
                <span className="mk-name">{it.name}</span>
                <span className="mk-stats">{it.stats}</span>
              </button>
            ))}
          </div>
          {kind.key === 'mine' && (
            <p className="ed-note" data-testid="make-enemies">
              {t('editor.MonsterKinds.makeEnemiesInThe', 'Make enemies in the')}{' '}
              <button className="link mk-link" onClick={() => store.getState().setTab('Library')}>
                {t('editor.MonsterKinds.library', 'Library')}
              </button>
              {t('editor.MonsterKinds.theyAreListedHere', '. They are listed here.')}
            </p>
          )}
          <p className="ed-note">
            {opts.monsterPicked
              ? t('editor.MonsterKinds.tapASquareForMore', 'Tap a square for more.')
              : t('editor.MonsterKinds.pickAMonsterThen', 'Pick a monster, then tap a square.')}
          </p>
        </>
      )}
    </div>
  );
}
