import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Elapsed-seconds clock for the current cooking step.
 * Based on Date.now() deltas so it stays accurate when the tab is throttled in the background.
 */
export function useStepClock(tickMs = 250) {
  const accumulatedRef = useRef(0);
  const startedAtRef = useRef<number | null>(null);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const read = useCallback(
    () => accumulatedRef.current + (startedAtRef.current !== null ? (Date.now() - startedAtRef.current) / 1000 : 0),
    [],
  );

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setElapsed(read()), tickMs);
    return () => window.clearInterval(id);
  }, [running, read, tickMs]);

  const start = useCallback(() => {
    if (startedAtRef.current !== null) return;
    startedAtRef.current = Date.now();
    setRunning(true);
  }, []);

  const pause = useCallback(() => {
    if (startedAtRef.current === null) return;
    accumulatedRef.current = read();
    startedAtRef.current = null;
    setRunning(false);
    setElapsed(accumulatedRef.current);
  }, [read]);

  const reset = useCallback((to = 0) => {
    accumulatedRef.current = to;
    startedAtRef.current = null;
    setRunning(false);
    setElapsed(to);
  }, []);

  return { elapsed, running, start, pause, reset, read };
}
