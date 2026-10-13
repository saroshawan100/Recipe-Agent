import { useCallback, useEffect, useRef } from "react";
import { useUiStore } from "@/store/useUiStore";

const PREFERRED = [/natural/i, /aria/i, /jenny/i, /samantha/i, /google us english/i, /zira/i];

function pickVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith("en"));
  for (const re of PREFERRED) {
    const v = voices.find((voice) => re.test(voice.name));
    if (v) return v;
  }
  return voices.find((v) => v.lang === "en-US") ?? voices[0] ?? null;
}

export function useChefVoice() {
  const enabled = useUiStore((s) => s.voiceEnabled);
  const rate = useUiStore((s) => s.voiceRate);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;

  useEffect(() => {
    if (!supported) return;
    const load = () => (voiceRef.current = pickVoice());
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, [supported]);

  const cancel = useCallback(() => {
    if (supported) window.speechSynthesis.cancel();
  }, [supported]);

  const speak = useCallback(
    (text: string, { interrupt = false, force = false }: { interrupt?: boolean; force?: boolean } = {}) => {
      if (!supported || (!enabled && !force) || !text.trim()) return;
      if (interrupt) window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      if (voiceRef.current) u.voice = voiceRef.current;
      u.rate = rate;
      u.pitch = 1;
      window.speechSynthesis.speak(u);
    },
    [enabled, rate, supported],
  );

  useEffect(() => cancel, [cancel]);
  useEffect(() => {
    if (!enabled) cancel();
  }, [enabled, cancel]);

  return { speak, cancel, supported, enabled };
}
