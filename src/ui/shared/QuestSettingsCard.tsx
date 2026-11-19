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
      <button
        className="switch-row"
        role="switch"
        aria-checked={s.ruleHints}
        data-testid="rule-hints"
        onClick={() => setQuestSetting(questId, 'ruleHints', !s.ruleHints)}
      >
        <span>
          <b>Rule hints</b>
          <span className="hint" style={{ display: 'block' }}>
            Short reminders of rules the app does not enforce: terrain and special rooms the first
            time they are seen, and moving without rolling when no monster is awake.
          </span>
        </span>
        <span className="sw-track" aria-hidden="true">
          <span className="sw-knob" />
        </span>
      </button>
      <button className="btn alt" onClick={onClose}>
        Done
      </button>
    </NoteCard>
  );
}
