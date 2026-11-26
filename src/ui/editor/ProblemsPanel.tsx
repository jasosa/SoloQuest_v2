/**
 * The Problems tab of the inspector: every issue of the draft, errors first, one 44 px row each.
 * A row jumps to the thing it names (the board selection, the right tab, a short flash).
 * The panel only reads the issues and calls `store.jump`; the checks are the engine's.
 */
import { useStore } from 'zustand';
import type { Issue } from '../../engine/quest/validate';
import type { EditorStore } from './editorStore';
import { refTitle, sortIssues } from './problems';
import { t } from '../../i18n/t';

export function ProblemsPanel({ store, issues }: { store: EditorStore; issues: readonly Issue[] }) {
  const { saveErrors } = useStore(store);
  const sorted = sortIssues(issues);
  const errors = sorted.filter((i) => i.severity === 'error').length;
  return (
    <section data-testid="problems-panel">
      {errors > 0 && (
        <div className="lbl">
          {t('editor.ProblemsPanel.toFixBeforeSaving', '{v1} to fix before saving', { v1: errors })}
        </div>
      )}
      {saveErrors && (
        <p className="ed-note" role="alert">
          {t(
            'editor.ProblemsPanel.cannotSaveYetFix',
            'Cannot save yet. Fix the problems marked below.',
          )}
        </p>
      )}
      {sorted.length === 0 ? (
        <p className="ed-note">{t('editor.ProblemsPanel.noProblems', 'No problems.')}</p>
      ) : (
        <ul className="ed-issues-list">
          {sorted.map((i, n) => (
            <li key={`${n}:${i.message}`} className={i.severity}>
              <button
                className="pr-row"
                data-testid="problem-row"
                data-severity={i.severity}
                aria-label={`${
                  i.severity === 'error'
                    ? t('editor.ProblemsPanel.problem', 'Problem')
                    : t('editor.ProblemsPanel.warning', 'Warning')
                }: ${refTitle(i.ref)}. ${i.message}`}
                onClick={() => store.getState().jump(i.ref, i.message)}
              >
                <span className="pr-bar" />
                <span className="pr-text">
                  <b>{refTitle(i.ref)}</b>
                  <i>{i.message}</i>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
