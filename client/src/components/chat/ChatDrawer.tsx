import { useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, Trash2 } from "lucide-react";
import { getBackend } from "@/api/backend";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/overlays";
import { useStreamingChat, type ChatStreamFn } from "@/hooks/useStreamingChat";
import { useChatStore } from "@/store/useChatStore";
import { useKitchenStore } from "@/store/useKitchenStore";
import { ChatPanel } from "./ChatPanel";

const GENERAL_PROMPTS = [
  "What can I substitute for buttermilk?",
  "How do I know when chicken is cooked?",
  "Give me a high-protein lunch idea",
  "How long do leftovers keep in the fridge?",
];

export function ChatDrawer() {
  const open = useChatStore((s) => s.open);
  const setOpen = useChatStore((s) => s.setOpen);
  const messages = useChatStore((s) => s.messages);
  const setMessages = useChatStore((s) => s.setMessages);
  const clear = useChatStore((s) => s.clear);
  const recipeContext = useChatStore((s) => s.recipeContext);
  const selected = useKitchenStore((s) => s.selected);

  const stream = useCallback<ChatStreamFn>(
    async (history, onDelta, signal) =>
      (await getBackend()).chatStream(
        { messages: history, pantry: selected.map((s) => s.name), recipeId: recipeContext?.id ?? null },
        onDelta,
        signal,
      ),
    [selected, recipeContext],
  );

  const { send, stop, streaming } = useStreamingChat({ stream, messages, setMessages });

  const quickPrompts = recipeContext
    ? [`Can I make ${recipeContext.title} ahead of time?`, "What can I substitute in this recipe?", "How do I make this lower calorie?", "What sides go with this?"]
    : GENERAL_PROMPTS;

  return (
    <>
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setOpen(true)}
            className="fixed right-5 bottom-24 z-30 flex cursor-pointer items-center gap-2 rounded-full bg-gradient-to-br from-saffron-400 to-saffron-600 py-3 pr-5 pl-4 font-semibold text-stone-950 shadow-2xl shadow-saffron-500/40 lg:bottom-6 print:hidden"
          >
            <MessageCircle className="h-5 w-5" />
            Ask the Chef
          </motion.button>
        )}
      </AnimatePresence>

      <Sheet
        open={open}
        onOpenChange={setOpen}
        title="Ask the Chef"
        description={recipeContext ? `Talking about: ${recipeContext.title}` : "Substitutions, techniques, food safety and more"}
      >
        {messages.length > 0 && (
          <div className="flex justify-end border-b border-line px-4 py-2">
            <Button variant="ghost" size="sm" onClick={clear} disabled={streaming}>
              <Trash2 className="h-3.5 w-3.5" /> New chat
            </Button>
          </div>
        )}
        <ChatPanel
          messages={messages}
          streaming={streaming}
          onSend={send}
          onStop={stop}
          quickPrompts={quickPrompts}
          emptyTitle="What's cooking?"
          emptyText="Ask about substitutions, techniques, nutrition, timing, or what to do with leftovers."
        />
      </Sheet>
    </>
  );
}
