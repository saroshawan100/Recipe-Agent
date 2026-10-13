import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CoachCue, CoachingScript } from "@/api/types";

export interface TimelineCue extends CoachCue {
  origin: "script" | "recheck" | "fix";
}

const byTime = (a: TimelineCue, b: TimelineCue) => a.atSecond - b.atSecond;

/**
 * Plays a coaching script against the step clock: fires cues as their time passes, and supports
 * shifting upcoming cues ("not yet", "+1 min") and splicing in new ones from the chef.
 */
export function useCoachPlayer({
  elapsed,
  running,
  onFire,
}: {
  elapsed: number;
  running: boolean;
  onFire: (due: TimelineCue[]) => void;
}) {
  const [cues, setCues] = useState<TimelineCue[]>([]);
  const [extraSeconds, setExtraSeconds] = useState(0);
  const [firedIds, setFiredIds] = useState<ReadonlySet<string>>(new Set());
  const firedRef = useRef(new Set<string>());
  const onFireRef = useRef(onFire);
  onFireRef.current = onFire;

  const init = useCallback((script: CoachingScript, initialElapsed = 0) => {
    const list = script.cues.map((c) => ({ ...c, origin: "script" as const })).sort(byTime);
    // On resume, treat earlier cues as already played, except the latest one so it is re-announced.
    const past = list.filter((c) => c.atSecond <= initialElapsed);
    const replay = past.filter((c) => c.type !== "meanwhile").at(-1);
    firedRef.current = new Set(past.filter((c) => c !== replay).map((c) => c.id));
    setFiredIds(new Set(firedRef.current));
    setCues(list);
    setExtraSeconds(0);
  }, []);

  useEffect(() => {
    if (!running) return;
    const due = cues.filter((c) => c.atSecond <= elapsed && !firedRef.current.has(c.id));
    if (!due.length) return;
    due.forEach((c) => firedRef.current.add(c.id));
    setFiredIds(new Set(firedRef.current));
    onFireRef.current(due);
  }, [elapsed, running, cues]);

  /** Pushes every cue that hasn't played yet later by `seconds`. */
  const shiftUpcoming = useCallback((seconds: number, from: number) => {
    if (seconds <= 0) return;
    setCues((cs) => cs.map((c) => (!firedRef.current.has(c.id) && c.atSecond > from ? { ...c, atSecond: c.atSecond + seconds } : c)).sort(byTime));
    setExtraSeconds((e) => e + seconds);
  }, []);

  const insert = useCallback((newCues: TimelineCue[]) => {
    setCues((cs) => [...cs, ...newCues].sort(byTime));
  }, []);

  const derived = useMemo(() => {
    const fired = cues.filter((c) => firedIds.has(c.id));
    const current = fired.filter((c) => c.type !== "meanwhile").at(-1) ?? null;
    const upcoming = cues.filter((c) => !firedIds.has(c.id));
    const next = upcoming.find((c) => c.type !== "meanwhile") ?? null;
    return { current, next, upcoming };
  }, [cues, firedIds]);

  return { cues, firedIds, extraSeconds, init, shiftUpcoming, insert, ...derived };
}
