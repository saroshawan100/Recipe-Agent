import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { OnDelta } from "@/api/backend";
import type { ChatMessage } from "@/api/types";

export type ChatStreamFn = (history: ChatMessage[], onDelta: OnDelta, signal: AbortSignal) => Promise<string>;

/**
 * Streams assistant replies into a message list. `setMessages` lets callers keep
 * the list in a store (global chat) or in local state (in-step chat).
 */
export function useStreamingChat({
  stream,
  messages,
  setMessages,
  onComplete,
}: {
  stream: ChatStreamFn;
  messages: ChatMessage[];
  setMessages: (updater: (prev: ChatMessage[]) => ChatMessage[]) => void;
  onComplete?: (text: string) => void;
}) {
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const send = useCallback(
    async (text: string, image?: string) => {
      const userMessage: ChatMessage = { role: "user", content: text, image };
      const history = [...messages, userMessage].slice(-20);
      setMessages((prev) => [...prev, userMessage, { role: "assistant", content: "" }]);
      setStreaming(true);
      const controller = new AbortController();
      abortRef.current = controller;

      const setLast = (content: string) =>
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content };
          return next;
        });

      try {
        const full = await stream(history, (_d, soFar) => setLast(soFar), controller.signal);
        onComplete?.(full);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setMessages((prev) => (prev.at(-1)?.content === "" ? prev.slice(0, -1) : prev));
        toast.error("The chef couldn't answer", { description: (err as Error).message });
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [messages, setMessages, stream, onComplete],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  return { send, stop, streaming };
}
