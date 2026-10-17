import { useEffect, useRef, useState, type FormEvent } from "react";
import { ChefHat, ImagePlus, SendHorizontal, Square, X } from "lucide-react";
import Markdown from "react-markdown";
import { toast } from "sonner";
import type { ChatMessage } from "@/api/types";
import { Button } from "@/components/ui/button";
import { compressFoodPhoto } from "@/lib/compressFoodPhoto";
import { cn } from "@/lib/utils";

export function ChatPanel({
  messages,
  streaming,
  onSend,
  onStop,
  quickPrompts,
  placeholder = "Ask the chef anything...",
  emptyTitle,
  emptyText,
  allowImage = false,
}: {
  messages: ChatMessage[];
  streaming: boolean;
  onSend: (text: string, image?: string) => void;
  onStop: () => void;
  quickPrompts: string[];
  placeholder?: string;
  emptyTitle: string;
  emptyText: string;
  allowImage?: boolean;
}) {
  const [input, setInput] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [imageName, setImageName] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if ((!text && !image) || streaming) return;
    onSend(text || "Please take a look at this photo.", image ?? undefined);
    setInput("");
    setImage(null);
    setImageName("");
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
        {messages.length === 0 ? (
          <div className="pt-6 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-saffron-400 to-saffron-600 text-stone-950 shadow-lg shadow-saffron-500/30">
              <ChefHat className="h-7 w-7" />
            </span>
            <h3 className="mt-4 text-xl font-semibold">{emptyTitle}</h3>
            <p className="mt-1 text-sm text-muted">{emptyText}</p>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={cn("flex gap-2.5", m.role === "user" && "justify-end")}>
              {m.role === "assistant" && (
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-saffron-400 to-saffron-600 text-stone-950">
                  <ChefHat className="h-4 w-4" />
                </span>
              )}
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed",
                  m.role === "user" ? "rounded-br-md bg-fg text-bg" : "prose-chef rounded-tl-md bg-surface-2",
                )}
              >
                {m.role === "assistant" ? (
                  m.content ? (
                    <Markdown>{m.content}</Markdown>
                  ) : (
                    <span className="flex gap-1 py-2">
                      {[0, 1, 2].map((d) => (
                        <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-muted" style={{ animationDelay: `${d * 120}ms` }} />
                      ))}
                    </span>
                  )
                ) : (
                  <>
                    {m.image && <img src={m.image} alt="Food photo attached to this question" className="mb-2 max-h-52 max-w-full rounded-xl object-contain" />}
                    {m.content}
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="border-t border-line p-4">
        {messages.length === 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {quickPrompts.map((q) => (
              <button
                key={q}
                onClick={() => onSend(q)}
                className="cursor-pointer rounded-full border border-line px-3 py-1.5 text-left text-sm text-muted transition-colors hover:border-saffron-500/60 hover:text-fg"
              >
                {q}
              </button>
            ))}
          </div>
        )}
        <form onSubmit={submit} className="flex items-end gap-2">
          {allowImage && (
            <>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                aria-label="Take or choose a food photo"
                onChange={async (event) => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = "";
                  if (!file) return;
                  try {
                    setImage(await compressFoodPhoto(file));
                    setImageName(file.name);
                  } catch (error) {
                    toast.error("Couldn't use that photo", { description: (error as Error).message });
                  }
                }}
              />
              <Button type="button" size="icon" variant="secondary" onClick={() => imageInputRef.current?.click()} aria-label={image ? `Change photo (${imageName})` : "Add a photo"}>
                <ImagePlus className="h-4 w-4" />
              </Button>
            </>
          )}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) submit(e);
            }}
            rows={1}
            placeholder={placeholder}
            className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-line bg-surface px-4 py-2.5 text-[15px] outline-none placeholder:text-muted/70 focus:border-saffron-500"
          />
          {streaming ? (
            <Button type="button" size="icon" variant="secondary" onClick={onStop} aria-label="Stop">
              <Square className="h-4 w-4 fill-current" />
            </Button>
          ) : (
            <Button type="submit" size="icon" disabled={!input.trim() && !image} aria-label="Send">
              <SendHorizontal className="h-4 w-4" />
            </Button>
          )}
        </form>
        {image && (
          <div className="mt-2 flex items-center gap-2 rounded-xl bg-surface-2 p-2 text-xs text-muted">
            <img src={image} alt="Selected food photo" className="h-12 w-12 rounded-lg object-cover" />
            <span className="min-w-0 flex-1 truncate">{imageName}</span>
            <button type="button" className="grid h-9 w-9 cursor-pointer place-items-center rounded-lg hover:bg-surface" onClick={() => { setImage(null); setImageName(""); }} aria-label="Remove photo">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        {allowImage && <p className="mt-2 text-center text-[11px] text-muted">Photos are resized and sent to the chef for this answer; the app doesn’t save them.</p>}
      </div>
    </div>
  );
}
