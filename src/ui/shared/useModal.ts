import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';

/**
 * What every dialog needs, in one place: it goes on a stack so that Escape closes only the top one (a
 * margin note over a card, a preview over a dialog); Tab stays inside it; focus goes into it when it
 * opens and comes back to what had it when it closes.
 */

/** The dialogs that are open, oldest first. */
const stack: symbol[] = [];

/** Is a dialog open? A screen's own Escape (deselect, leave) must not act then. */
export const anyModalOpen = (): boolean => stack.length > 0;

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** The controls inside `root` that can take focus now (not hidden). */
function focusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (el) => el.getClientRects().length > 0,
  );
}

export interface ModalOptions {
  /** Called for Escape when this is the top dialog. Left out: Escape does nothing (a choice must be answered). */
  onEscape?: (() => void) | undefined;
  /** Keep Tab inside the dialog (default true). A margin note is not modal: false. */
  trap?: boolean;
  /**
   * Where focus goes when it opens: the first control (default; nothing changes when something inside
   * already has focus), the title (a screen reader reads the card first), or nowhere.
   */
  focus?: 'first' | 'title' | 'none';
  /** Give focus back to what had it before the dialog opened (default true). */
  restore?: boolean;
  /** False while the dialog is not shown (a component that stays mounted and returns null). Default true. */
  active?: boolean;
}

/** The element that has focus now, if it is one we can give focus back to. */
const focusedNow = (): HTMLElement | null =>
  document.activeElement instanceof HTMLElement && document.activeElement !== document.body
    ? document.activeElement
    : null;

export function useModal(ref: RefObject<HTMLElement | null>, options: ModalOptions = {}): void {
  // the handlers read the latest options, so a new `onEscape` each render does not re-register
  const latest = useRef(options);
  useLayoutEffect(() => {
    latest.current = options;
  });

  // Who had focus when the dialog first rendered: before React's `autoFocus` moves it into the dialog.
  const [atRender] = useState(focusedNow);
  const firstRun = useRef(true);
  /** What gets focus back. It outlives the double run of effects in development. */
  const opener = useRef<HTMLElement | null>(null);

  const active = options.active ?? true;
  useEffect(() => {
    const fromRender = firstRun.current;
    firstRun.current = false;
    if (!active) return;
    const me = Symbol('modal');
    stack.push(me);
    const root = ref.current;
    if (opener.current === null) opener.current = fromRender ? atRender : focusedNow();
    const where = latest.current.focus ?? 'first';
    if (root && where !== 'none' && !root.contains(document.activeElement)) {
      let target: HTMLElement | null | undefined;
      if (where === 'title') {
        target = root.querySelector<HTMLElement>('h1, h2, h3');
        if (target && target.tabIndex < 0 && !target.hasAttribute('tabindex'))
          target.setAttribute('tabindex', '-1');
      } else target = focusables(root)[0];
      if (!target) {
        if (!root.hasAttribute('tabindex')) root.setAttribute('tabindex', '-1');
        target = root;
      }
      target.focus();
    }

    const onKey = (e: KeyboardEvent) => {
      if (stack[stack.length - 1] !== me) return;
      if (e.key === 'Escape') {
        latest.current.onEscape?.();
        return;
      }
      if (e.key !== 'Tab' || (latest.current.trap ?? true) === false || !root) return;
      const items = focusables(root);
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0] as HTMLElement;
      const last = items[items.length - 1] as HTMLElement;
      const current = document.activeElement;
      const inside = current instanceof Node && root.contains(current);
      if (e.shiftKey && (current === first || !inside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (current === last || !inside)) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      stack.splice(stack.indexOf(me), 1);
      // The dialog is still on the screen: this is the development double run, keep the opener.
      if (root?.isConnected) return;
      const back = opener.current;
      opener.current = null;
      // focus goes back, unless the person has already moved it somewhere else
      const now = document.activeElement;
      if (
        (latest.current.restore ?? true) &&
        back &&
        document.contains(back) &&
        (!now || now === document.body)
      )
        back.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}
