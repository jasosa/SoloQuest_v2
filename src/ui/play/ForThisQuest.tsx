import type { ElementQuest } from '../../engine/game/view';

const firstLine = (e: ElementQuest['read'][number]) => {
  const text = e.title ?? e.texts[0] ?? e.choices[0]?.picked ?? '';
  return text.split(/(?<=[.!?])\s/)[0] ?? text;
};

/**
 * The "For this quest" block under the normal actions of a margin note (decision 67): notes
 * already read for the element (tap to read again) and its buttons. Nothing when it has neither.
 */
export function ForThisQuest({
  view,
  onRead,
  onPress,
}: {
  view: ElementQuest;
  onRead(note: string): void;
  onPress(note: string): void;
}) {
  if (view.read.length === 0 && view.buttons.length === 0) return null;
  return (
    <div className="fq">
      <div className="lbl">For this quest</div>
      {view.read.map((e) => (
        <button key={e.id} data-hit className="nr" onClick={() => onRead(e.id)}>
          <b>{e.letter ?? '•'}</b>
          <span>{firstLine(e)}</span>
        </button>
      ))}
      {view.buttons.map((b) => (
        <button key={b.note} className="btn alt" onClick={() => onPress(b.note)}>
          {b.label}
        </button>
      ))}
    </div>
  );
}
