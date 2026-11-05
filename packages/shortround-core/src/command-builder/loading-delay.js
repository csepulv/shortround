// A lookup that answers within this time never shows "Loading", so fast lookups don't make the list flicker. A
// starting point, not a measurement. Shared by the palette adapter and the command line.
export const LOADING_DELAY_MS = 150;

// Which pending params to show as loading: those pending for at least LOADING_DELAY_MS. `track` takes each read's
// pending params; the first time a param is seen pending, `notify` is scheduled for when its delay passes. `shown`
// picks the ones whose delay has passed.
export function makeLoadingDelay({ now, schedule, notify }) {
  const pendingSince = new Map();
  return {
    track(pending) {
      const current = new Set(pending.map(({ param }) => param));
      for (const param of pendingSince.keys()) {
        if (!current.has(param)) {
          pendingSince.delete(param);
        }
      }
      for (const { param } of pending) {
        if (!pendingSince.has(param)) {
          pendingSince.set(param, now());
          schedule(notify, LOADING_DELAY_MS);
        }
      }
    },
    shown: (pending) =>
      pending.filter(({ param }) => now() - pendingSince.get(param) >= LOADING_DELAY_MS)
  };
}
