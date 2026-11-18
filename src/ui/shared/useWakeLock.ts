import { useEffect } from 'react';

/**
 * Keep the screen awake while `active` (a game at the table: the tablet must not go dark between turns).
 * Browsers drop the lock when the page is hidden, so it is asked for again when the page comes back.
 * Browsers without the Screen Wake Lock API, or that refuse it, just let the screen sleep as usual.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    let live = true;
    let lock: WakeLockSentinel | null = null;
    const request = async () => {
      try {
        const got = await navigator.wakeLock.request('screen');
        if (live) lock = got;
        else void got.release(); // left the screen while the request was on its way
      } catch {
        /* refused (battery saver, no permission): the screen may sleep */
      }
    };
    void request();
    const onVisible = () => {
      if (document.visibilityState === 'visible' && live && (!lock || lock.released))
        void request();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      live = false;
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release().catch(() => undefined);
    };
  }, [active]);
}
