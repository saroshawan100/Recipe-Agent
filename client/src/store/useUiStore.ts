import { create } from "zustand";
import { persist } from "zustand/middleware";

type Theme = "dark" | "light";

interface UiState {
  theme: Theme;
  voiceEnabled: boolean;
  voiceRate: number;
  chimesEnabled: boolean;
  toggleTheme: () => void;
  setVoiceEnabled: (v: boolean) => void;
  setVoiceRate: (v: number) => void;
  setChimesEnabled: (v: boolean) => void;
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      theme: "dark",
      voiceEnabled: true,
      voiceRate: 1,
      chimesEnabled: true,
      toggleTheme: () => {
        const theme = get().theme === "dark" ? "light" : "dark";
        applyTheme(theme);
        set({ theme });
      },
      setVoiceEnabled: (voiceEnabled) => set({ voiceEnabled }),
      setVoiceRate: (voiceRate) => set({ voiceRate }),
      setChimesEnabled: (chimesEnabled) => set({ chimesEnabled }),
    }),
    { name: "pantry-chef-ui" },
  ),
);
