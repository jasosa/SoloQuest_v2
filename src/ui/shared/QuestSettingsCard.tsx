import { NoteCard } from './NoteCard';
import { setQuestSetting, useQuestSettings } from '../settings';

/**
 * The settings of one quest, in a popup. Opened from the quest list and from the play header; the
 * choices are kept on this device for that quest only.
 */
export function QuestSettingsCard({
  questId,
  title,
  onClose,
}: {
  questId: string;
  title: string;
  onClose(): void;
}) {
  const s = useQuestSettings(questId);
  return (
    <NoteCard kind="Quest settings" title={title} onClose={onClose}>
      <p>
        Rule hints are short reminders of rules the app does not enforce: the rule of a terrain the
        first time it is seen, and moving without rolling when no monster is awake.
      </p>
      <button
        className={s.ruleHints ? 'btn' : 'btn alt'}
        role="switch"
        aria-checked={s.ruleHints}
        data-testid="rule-hints"
        onClick={() => setQuestSetting(questId, 'ruleHints', !s.ruleHints)}
      >
        Rule hints: {s.ruleHints ? 'on' : 'off'}
      </button>
      <button className="btn alt" onClick={onClose}>
        Done
      </button>
    </NoteCard>
  );
}
