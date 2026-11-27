/**
 * The team strip above the board (decision 115): one coin per hero, mercenary, ally, then the companions
 * (quest people who are not on the team). A tap on a team coin asks "fell?" in a margin note under the coin;
 * a companion's note shows its numbers and quest text. Only dead or alive is kept (decision 32).
 * Presentational: the codes and the matching of quest people are in `teamCodes` and `teamView`.
 */
import { Fragment } from 'react';
import { labelOf, type TeamMember } from '../../engine/data/team';
import { t } from '../../i18n/t';
import { MarginNote } from '../shared/MarginNote';
import { teamCodes, type CodeEntry } from './teamCodes';
import { companionsOf, personOf, type Person } from './teamView';

/** What the open note is about: a member of the team (its id), or a companion (`npc:` and the quest id). */
export const companionKey = (id: string): string => `npc:${id}`;

const NO_ANCHOR = { x: 0, y: 0 };

function numbersOf(p: Person): string {
  const parts = [
    p.move !== undefined &&
      t('play.TeamStrip.movementDice', 'Movement dice {move}', { move: p.move }),
    p.attack !== undefined &&
      t('play.TeamStrip.attackDice', 'Attack dice {dice}', {
        dice: p.attack === 0 ? t('play.TeamStrip.notApplicable', 'N/A') : p.attack,
      }),
    t('play.TeamStrip.defendDiceBody', 'Defend dice {defend} · Body {body}', {
      defend: p.defend,
      body: p.body,
    }),
  ];
  return parts.filter(Boolean).join(' · ');
}

function kindLabel(kind: CodeEntry['kind']): string {
  switch (kind) {
    case 'hero':
      return t('play.TeamStrip.hero', 'Hero');
    case 'mercenary':
      return t('play.TeamStrip.mercenary', 'Mercenary');
    case 'ally':
      return t('play.TeamStrip.ally', 'Ally');
    case 'companion':
      return t('play.TeamStrip.companion', 'Companion');
  }
}

interface Entry {
  readonly key: string;
  readonly code: string;
  readonly name: string;
  readonly kind: CodeEntry['kind'];
  readonly fell: boolean;
  /** The quest person behind an ally, or a companion itself: its numbers and text. */
  readonly person: Person | undefined;
}

export function TeamStrip({
  team,
  dead,
  people,
  inPlay,
  open,
  onOpen,
  onFell,
  onClose,
}: {
  team: readonly TeamMember[];
  dead: readonly string[];
  /** Every quest person, to give an ally its numbers. */
  people: readonly Person[];
  /** The quest people the players can see now. Those not on the team are the companions. */
  inPlay: readonly Person[];
  /** The key of the entry whose note is open. */
  open: string | null;
  onOpen(key: string): void;
  onFell(id: string): void;
  onClose(): void;
}) {
  const companions = companionsOf(inPlay, team);
  const all: CodeEntry[] = [
    ...team.map((m) => ({ id: m.id, name: m.name, kind: m.kind })),
    ...companions.map((c) => ({
      id: companionKey(c.id),
      name: c.name,
      kind: 'companion' as const,
    })),
  ];
  const codes = teamCodes(all);
  const entries: Entry[] = [
    ...team.map((m) => ({
      key: m.id,
      code: codes.get(m.id) ?? '',
      name: labelOf(team, m.id),
      kind: m.kind,
      fell: dead.includes(m.id),
      person: personOf(m, people),
    })),
    ...companions.map((c) => ({
      key: companionKey(c.id),
      code: codes.get(companionKey(c.id)) ?? '',
      name: c.name,
      kind: 'companion' as const,
      fell: false,
      person: c,
    })),
  ];
  const groups = [
    entries.filter((e) => e.kind === 'hero'),
    entries.filter((e) => e.kind === 'mercenary' || e.kind === 'ally'),
    entries.filter((e) => e.kind === 'companion'),
  ].filter((g) => g.length > 0);
  if (entries.length === 0) return null;

  const note = (e: Entry) =>
    e.kind === 'companion' ? (
      <MarginNote
        anchor={NO_ANCHOR}
        below={{ x: 22 }}
        kind={kindLabel(e.kind)}
        title={e.name}
        onClose={onClose}
      >
        {e.person && <p className="nums">{numbersOf(e.person)}</p>}
        {e.person?.text && <p>{e.person.text}</p>}
      </MarginNote>
    ) : (
      <MarginNote
        anchor={NO_ANCHOR}
        below={{ x: 22 }}
        kind={kindLabel(e.kind)}
        title={t('play.TeamStrip.fell', '{name} fell?', { name: e.name })}
        onClose={onClose}
      >
        {e.person && <p className="nums">{numbersOf(e.person)}</p>}
        <div className="row">
          <button className="btn" onClick={() => onFell(e.key)}>
            {t('play.TeamStrip.yesFell', 'Yes, fell')}
          </button>
          <button className="btn alt" onClick={onClose}>
            {t('play.TeamStrip.no', 'No')}
          </button>
        </div>
      </MarginNote>
    );

  return (
    <div className="team-strip" role="group" aria-label={t('play.TeamStrip.team', 'Team')}>
      {groups.map((g, i) => (
        <Fragment key={g[0]!.key}>
          {i > 0 && <i className="hair" aria-hidden="true" />}
          {g.map((e) => {
            const isOpen = open === e.key;
            const label = e.fell
              ? t('play.TeamStrip.codeNameFell', '{code}, {name}, fell', {
                  code: e.code,
                  name: e.name,
                })
              : e.kind === 'companion'
                ? t(
                    'play.TeamStrip.codeNameCompanion',
                    '{code}, {name}, companion, tap for its numbers',
                    {
                      code: e.code,
                      name: e.name,
                    },
                  )
                : t('play.TeamStrip.codeNameTap', '{code}, {name}, tap if it fell', {
                    code: e.code,
                    name: e.name,
                  });
            return (
              <span className="team-slot" key={e.key}>
                <button
                  data-hit
                  className={'team-btn' + (isOpen ? ' sel' : '') + (e.fell ? ' fallen' : '')}
                  disabled={e.fell}
                  aria-expanded={isOpen}
                  aria-label={label}
                  onClick={() => (isOpen ? onClose() : onOpen(e.key))}
                >
                  <span
                    className={
                      'coin team-coin ' +
                      (e.fell
                        ? 'off'
                        : e.kind === 'hero'
                          ? 'hero'
                          : e.kind === 'companion'
                            ? 'npc'
                            : 'helper') +
                      (e.code.length > 2 ? ' long' : '')
                    }
                    aria-hidden="true"
                  >
                    {e.code}
                  </span>
                </button>
                {isOpen && !e.fell && note(e)}
              </span>
            );
          })}
        </Fragment>
      ))}
    </div>
  );
}
