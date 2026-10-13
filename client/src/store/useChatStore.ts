import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ChatMessage } from "@/api/types";

interface ChatState {
  open: boolean;
  messages: ChatMessage[];
  /** Recipe currently on screen, so the chef can answer questions about it. */
  recipeContext: { id: string; title: string } | null;
  setOpen: (open: boolean) => void;
  setMessages: (updater: (prev: ChatMessage[]) => ChatMessage[]) => void;
  clear: () => void;
  setRecipeContext: (ctx: { id: string; title: string } | null) => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      open: false,
      messages: [],
      recipeContext: null,
      setOpen: (open) => set({ open }),
      setMessages: (updater) => set((s) => ({ messages: updater(s.messages) })),
      clear: () => set({ messages: [] }),
      setRecipeContext: (recipeContext) => set({ recipeContext }),
    }),
    { name: "pantry-chef-chat", partialize: (s) => ({ messages: s.messages.slice(-40) }) },
  ),
);
