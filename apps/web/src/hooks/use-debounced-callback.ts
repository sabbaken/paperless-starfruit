import { useCallback, useEffect, useRef } from "react";

/**
 * Returns a stable, debounced wrapper around `callback`. Each invocation resets a
 * timer, so the callback runs only once `delayMs` has elapsed since the last call.
 * The latest `callback` closure is always used, and any pending run is cancelled on
 * unmount.
 */
export function useDebouncedCallback(
  callback: () => void,
  delayMs: number,
): () => void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => callbackRef.current(), delayMs);
  }, [delayMs]);
}
