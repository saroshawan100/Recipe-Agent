import type { CueType } from "@/api/types";

let ctx: AudioContext | null = null;

/** Must be called from a user gesture (e.g. the "Start step" click) so browsers allow audio. */
export function unlockAudio() {
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
}

const PATTERNS: Record<CueType | "done", number[]> = {
  action: [880, 1320],
  tip: [1046],
  meanwhile: [784, 988],
  check: [1175, 1175, 1568],
  warning: [440, 330],
  done: [784, 988, 1175, 1568],
};

export function playChime(kind: CueType | "done") {
  if (!ctx) return;
  const notes = PATTERNS[kind];
  const now = ctx.currentTime;
  notes.forEach((freq, i) => {
    const osc = ctx!.createOscillator();
    const gain = ctx!.createGain();
    osc.type = kind === "warning" ? "triangle" : "sine";
    osc.frequency.value = freq;
    const t = now + i * 0.14;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.18, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    osc.connect(gain).connect(ctx!.destination);
    osc.start(t);
    osc.stop(t + 0.5);
  });
}
