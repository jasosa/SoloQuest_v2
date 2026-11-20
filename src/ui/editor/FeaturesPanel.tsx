import { useStore } from 'zustand';
import { setLeave, setSuggestedPack } from '../../engine/editor';
import type { EditorStore } from './editorStore';

/**
 * The quest settings of expansion quests (Frozen Horror): the way the heroes leave and the texture
 * pack the quest looks best with. The board features (tiles, tunnels, exterior doors, door flags)
 * are placed on the Map tab.
 */
export function FeaturesPanel({ store }: { store: EditorStore }) {
  const { quest } = useStore(store);
  const st = store.getState();

  return (
    <div className="ed-quest" data-testid="features-panel">
      <section>
        <div className="lbl">How the heroes leave</div>
        <label className="ed-field">
          Words, for example "through the cave". Empty: by the stairs.
          <input
            aria-label="Leave"
            key={quest.leave ?? ''}
            defaultValue={quest.leave ?? ''}
            onBlur={(e) => {
              if (e.target.value.trim() !== (quest.leave ?? ''))
                st.apply((q) => setLeave(q, e.target.value));
            }}
          />
        </label>
      </section>

      <section>
        <div className="lbl">Texture pack</div>
        <label className="ed-field">
          Id of the texture pack this quest looks best with. Only a hint, never applied for the
          player.
          <input
            aria-label="Suggested texture pack"
            key={quest.suggestedPack ?? ''}
            defaultValue={quest.suggestedPack ?? ''}
            onBlur={(e) => {
              if (e.target.value.trim() !== (quest.suggestedPack ?? ''))
                st.apply((q) => setSuggestedPack(q, e.target.value));
            }}
          />
        </label>
      </section>

      <p className="ed-note" data-testid="features-pointer">
        Tiles, ice tunnels, exterior doors and door flags are placed on the Map tab: pick Tiles or
        Doors in the tools.
      </p>
    </div>
  );
}
