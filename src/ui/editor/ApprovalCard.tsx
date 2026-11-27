import { useState } from 'react';
import { useStore } from 'zustand';
import {
  approveQuest,
  isApproved,
  replaceOriginal,
  replacedSlot,
  withdrawQuest,
} from '../../engine/editor';
import { clearOverride, getOverrides, setOverride } from '../../persist/questOverrides';
import { questEntries } from '../quests';
import { Panel } from '../shared/Frame';
import type { EditorStore } from './editorStore';
import { t } from '../../i18n/t';

/** The bundled quest this one is a copy of, if it is in this app. */
const originalOf = (copyOf: string | undefined) =>
  copyOf === undefined ? undefined : questEntries.find((e) => e.level?.quest.id === copyOf);

/** The label of a bundled quest in a sentence: "Quest 3, The Maze". */
const nameOf = (e: { number: number; level?: { quest: { title: string } } | undefined }) =>
  t('editor.ApprovalCard.questTitle', 'Quest {number}, {title}', {
    number: e.number,
    title: e.level?.quest.title ?? '',
  });

/**
 * The Approval card of the Quest tab (decision 110): whether the quest is in Play a quest, and for a
 * copy of a bundled quest, whether it replaces the original. The rules are the engine's
 * (`approveQuest`, `withdrawQuest`, `replaceOriginal`); this only shows them and saves the result.
 */
export function ApprovalCard({ store }: { store: EditorStore }) {
  const { canon } = useStore(store);
  const approved = isApproved(canon);
  // The refusal belongs to the quest as it was when the button was tapped: the next change clears it.
  const [refusal, setRefusal] = useState<{ quest: unknown; text: string } | null>(null);
  // Counts up when the replace map changes, so the card reads it again.
  const [, setTick] = useState(0);
  const error = refusal && refusal.quest === canon ? refusal.text : null;

  const original = originalOf(canon.copyOf);
  const slot = replacedSlot(getOverrides(), canon);

  const change = async (next: 'approve' | 'withdraw') => {
    if (next === 'approve') {
      const r = approveQuest(canon);
      if (!r.ok) {
        setRefusal({ quest: canon, text: r.error });
        return;
      }
      store.getState().applyQuest(() => r);
    } else {
      store.getState().applyQuest((q) => ({ ok: true, quest: withdrawQuest(q), warnings: [] }));
    }
    // The change counts only once it is saved. A quest with errors cannot be saved.
    const saved = await store.getState().save();
    if (!saved) {
      const text = store.getState().saveErrors?.join(' ') ?? '';
      setRefusal({ quest: store.getState().canon, text });
    }
  };

  const replace = () => {
    if (!original) return;
    const r = replaceOriginal(
      getOverrides(),
      canon,
      (id) => questEntries.find((e) => e.level?.quest.id === id)?.slot,
    );
    if (!r.ok) {
      setRefusal({ quest: canon, text: r.error });
      return;
    }
    setOverride(r.slot, canon.id);
    setTick((n) => n + 1);
  };

  const useOriginal = () => {
    if (slot !== undefined) clearOverride(slot);
    setTick((n) => n + 1);
  };

  return (
    <Panel title={t('editor.ApprovalCard.approval', 'Approval')} testId="quest-approval">
      <p data-testid="approval-status">
        <b>
          {approved
            ? t('editor.ApprovalCard.approved', 'Approved')
            : t('editor.ApprovalCard.notApproved', 'Not approved')}
        </b>
        {'. '}
        {approved
          ? t('editor.ApprovalCard.itIsInPlay', 'It is in Play a quest.')
          : t('editor.ApprovalCard.itIsNotIn', 'It is not in Play a quest.')}
      </p>
      <button
        className={approved ? 'btn alt' : 'btn'}
        data-testid={approved ? 'withdraw' : 'approve'}
        onClick={() => void change(approved ? 'withdraw' : 'approve')}
      >
        {approved
          ? t('editor.ApprovalCard.withdraw', 'Withdraw')
          : t('editor.ApprovalCard.approve', 'Approve')}
      </button>
      <p className="fr-help">
        {approved
          ? t(
              'editor.ApprovalCard.withdrawTakesItOut',
              'Withdraw takes it out of Play a quest. A saved game of it waits until you approve it again.',
            )
          : t(
              'editor.ApprovalCard.approvingSavesTheQuest',
              'Approving saves the quest and adds it to Play a quest.',
            )}
      </p>
      {error && (
        <div className="mg-err" role="alert" data-testid="approval-error">
          <span />
          <div>{error}</div>
        </div>
      )}
      {original && (
        <>
          <p data-testid="replace-status">
            {slot !== undefined
              ? t(
                  'editor.ApprovalCard.thisCopyReplaces',
                  'This copy replaces {name} in Play a quest.',
                  { name: nameOf(original) },
                )
              : t(
                  'editor.ApprovalCard.copyOfPlayAQuest',
                  'Copy of {name}. Play a quest shows the original.',
                  { name: nameOf(original) },
                )}
          </p>
          {slot !== undefined ? (
            <button className="btn alt" data-testid="use-original" onClick={useOriginal}>
              {t('editor.ApprovalCard.useOriginal', 'Use original')}
            </button>
          ) : (
            approved && (
              <button className="btn alt" data-testid="replace-original" onClick={replace}>
                {t('editor.ApprovalCard.replaceTheOriginal', 'Replace the original')}
              </button>
            )
          )}
        </>
      )}
    </Panel>
  );
}
