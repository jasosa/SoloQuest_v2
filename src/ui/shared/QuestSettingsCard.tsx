import { useState } from 'react';
import type { Campaign } from '../../engine/pack/campaign';
import type { PackManifest } from '../../engine/pack/schema';
import type { CampaignStore } from '../../persist/campaigns';
import { NoteCard } from './NoteCard';
import { setQuestSetting, useQuestSettings } from '../settings';
import { t } from '../../i18n/t';

/** A switch row (decision 84, `.switch-row`): a label with a hint, and the switch. */
function SwitchRow({
  label,
  hint,
  on,
  testId,
  onToggle,
}: {
  label: string;
  hint: string;
  on: boolean;
  testId: string;
  onToggle(): void;
}) {
  return (
    <button
      className="switch-row"
      role="switch"
      aria-checked={on}
      data-testid={testId}
      onClick={onToggle}
    >
      <span>
        <b>{label}</b>
        <span className="hint" style={{ display: 'block' }}>
          {hint}
        </span>
      </span>
      <span className="sw-track" aria-hidden="true">
        <span className="sw-knob" />
      </span>
    </button>
  );
}

/** The campaign a game belongs to, for its settings (decision 61). */
export interface CampaignSettingsContext {
  readonly store: CampaignStore;
  readonly pack: PackManifest;
  /** Which campaign of the pack. */
  readonly campaignId: string;
  /** Called after a campaign setting changed (the play screen draws its cards again). */
  readonly onChange?: (() => void) | undefined;
}

/**
 * The settings of one quest, in a popup. Opened from the quest list and from the play header. The quest
 * settings are kept on this device for that quest only. The campaign settings of the pack (decision 61)
 * are kept in its campaign and shown when there is one.
 */
export function QuestSettingsCard({
  questId,
  title,
  solo = false,
  campaign,
  campaignOnly = false,
  onClose,
}: {
  questId: string;
  title: string;
  /** The quest is for one hero: "No Yeti hug in solo quests" applies (decision 59). */
  solo?: boolean;
  campaign?: CampaignSettingsContext | undefined;
  /** Only the campaign switches ("Campaign settings"), no quest switches. */
  campaignOnly?: boolean;
  onClose(): void;
}) {
  const s = useQuestSettings(questId);
  const [stored, setStored] = useState<Campaign | undefined>(() =>
    campaign?.store.get(campaign.campaignId),
  );
  const listed = campaign?.pack.campaignSettings ?? [];
  return (
    <NoteCard
      kind={
        campaignOnly
          ? t('shared.QuestSettingsCard.campaignSettings', 'Campaign settings')
          : t('shared.QuestSettingsCard.questSettings', 'Quest settings')
      }
      title={title}
      onClose={onClose}
    >
      {!campaignOnly && (
        <SwitchRow
          label={t('shared.QuestSettingsCard.ruleHints', 'Rule hints')}
          hint={t(
            'shared.QuestSettingsCard.shortRemindersOfRules',
            'Short reminders of rules the app does not enforce: terrain and special rooms the first time they are seen, and moving without rolling when no monster is awake.',
          )}
          on={s.ruleHints}
          testId="rule-hints"
          onToggle={() => setQuestSetting(questId, 'ruleHints', !s.ruleHints)}
        />
      )}
      {solo && !campaignOnly && (
        <SwitchRow
          label={t('shared.QuestSettingsCard.noYetiHugIn', 'No Yeti hug in solo quests')}
          hint={t(
            'shared.QuestSettingsCard.inAQuestFor',
            'In a quest for one hero the Yeti attacks like a plain brute and does not hug.',
          )}
          on={s.soloNoHug}
          testId="solo-no-hug"
          onToggle={() => setQuestSetting(questId, 'soloNoHug', !s.soloNoHug)}
        />
      )}
      {campaign && listed.length > 0 && (
        <>
          <div className="lbl">
            {t('shared.QuestSettingsCard.campaignOf', 'Campaign of {name}', {
              name: campaign.pack.name,
            })}
          </div>
          {!stored && (
            <p className="hint" data-testid="no-campaign">
              {t(
                'shared.QuestSettingsCard.theseAreSetWhen',
                'These are set when a campaign has started. Start a game in Campaign mode first.',
              )}
            </p>
          )}
          {stored &&
            listed.map((c) => {
              const on = stored.settings[c.id] ?? c.default;
              return (
                <SwitchRow
                  key={c.id}
                  label={c.name}
                  hint={c.text}
                  on={on}
                  testId={`campaign-setting-${c.id}`}
                  onToggle={() => {
                    const next = { ...stored, settings: { ...stored.settings, [c.id]: !on } };
                    campaign.store.set(next);
                    setStored(next);
                    campaign.onChange?.();
                  }}
                />
              );
            })}
        </>
      )}
      <button className="btn alt" onClick={onClose}>
        {t('shared.QuestSettingsCard.done', 'Done')}
      </button>
    </NoteCard>
  );
}
