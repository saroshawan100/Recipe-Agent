import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Bookmark, ChefHat, Clock, Flame, Heart, Home, RotateCcw, Snowflake } from "lucide-react";
import { Link } from "react-router-dom";
import { getBackend } from "@/api/backend";
import type { ChatMessage, RecipeDto } from "@/api/types";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { MacroBars } from "@/components/recipe/RecipeCard";
import { Button } from "@/components/ui/button";
import { Modal, Sheet } from "@/components/ui/overlays";
import { Card } from "@/components/ui/primitives";
import { useStreamingChat, type ChatStreamFn } from "@/hooks/useStreamingChat";
import { cn, stripMarkdown } from "@/lib/utils";
import { PROBLEM_OPTIONS } from "./meta";

export function ProblemDialog({
  open,
  onOpenChange,
  onSubmit,
  pending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (issue: string | undefined, note: string | undefined) => void;
  pending: boolean;
}) {
  const [issue, setIssue] = useState<string | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) {
      setIssue(null);
      setNote("");
    }
  }, [open]);

  const label = PROBLEM_OPTIONS.find((p) => p.id === issue)?.label;

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="What's going on?" description="Tell the chef and you'll get a fix right away.">
      <div className="grid grid-cols-2 gap-2">
        {PROBLEM_OPTIONS.map((p) => (
          <button
            key={p.id}
            onClick={() => setIssue(issue === p.id ? null : p.id)}
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-2xl border px-3 py-3 text-left text-sm font-medium transition-all",
              issue === p.id ? "border-tomato-500 bg-tomato-500/10" : "border-line hover:border-muted/50",
            )}
          >
            <span className="text-xl">{p.emoji}</span>
            {p.label}
          </button>
        ))}
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value.slice(0, 500))}
        rows={3}
        placeholder="Or describe it: 'the onions are turning black on the edges'"
        className="mt-4 w-full resize-none rounded-2xl border border-line bg-bg px-4 py-3 text-sm outline-none focus:border-saffron-500"
      />
      <Button size="lg" className="mt-4 w-full" disabled={!issue && !note.trim()} loading={pending} onClick={() => onSubmit(label, note.trim() || undefined)}>
        <ChefHat className="h-5 w-5" /> Help me fix it
      </Button>
      <p className="mt-3 text-center text-xs text-muted">If there's a grease fire: cover it with a lid and turn off the heat. Never use water.</p>
    </Modal>
  );
}

export function AskStepSheet({
  open,
  onOpenChange,
  recipeId,
  stepIndex,
  stepTitle,
  getElapsed,
  speak,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipeId: string;
  stepIndex: number;
  stepTitle: string;
  getElapsed: () => number;
  speak: (text: string) => void;
}) {
  const [messages, setMessagesState] = useState<ChatMessage[]>([]);
  const setMessages = useCallback((updater: (prev: ChatMessage[]) => ChatMessage[]) => setMessagesState(updater), []);

  useEffect(() => setMessagesState([]), [stepIndex]);

  const stream = useCallback<ChatStreamFn>(
    async (history, onDelta, signal) =>
      (await getBackend()).askStream(
        { recipeId, stepIndex, elapsedSeconds: Math.round(getElapsed()), messages: history },
        onDelta,
        signal,
      ),
    [recipeId, stepIndex, getElapsed],
  );
  const onComplete = useCallback((text: string) => speak(stripMarkdown(text)), [speak]);
  const { send, stop, streaming } = useStreamingChat({ stream, messages, setMessages, onComplete });

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Ask the chef" description={`About step ${stepIndex + 1}: ${stepTitle}`}>
      <ChatPanel
        messages={messages}
        streaming={streaming}
        onSend={send}
        onStop={stop}
        quickPrompts={["How do I know it's done?", "Is this the right heat?", "What if I don't have this ingredient?", "I made a mistake, help!"]}
        placeholder="Ask about this step..."
        emptyTitle="I'm right here"
        emptyText="Ask anything about what you're doing right now. The chef knows exactly where you are."
      />
    </Sheet>
  );
}

export function ResumeDialog({
  open,
  step,
  totalSteps,
  onResume,
  onRestart,
  restarting,
}: {
  open: boolean;
  step: number;
  totalSteps: number;
  onResume: () => void;
  onRestart: () => void;
  restarting: boolean;
}) {
  return (
    <Modal open={open} onOpenChange={(o) => !o && onResume()} title="Welcome back, chef!" description={`You were on step ${step + 1} of ${totalSteps}.`}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Button size="lg" onClick={onResume}>
          <Bookmark className="h-5 w-5" /> Pick up where I left off
        </Button>
        <Button size="lg" variant="outline" onClick={onRestart} loading={restarting}>
          <RotateCcw className="h-5 w-5" /> Start over
        </Button>
      </div>
    </Modal>
  );
}

const CONFETTI = ["🎉", "✨", "🍽️", "👨‍🍳", "🔥", "⭐", "🥳", "🌿"];

export function FinishScreen({
  recipe,
  startedAt,
  onToggleSave,
  saving,
}: {
  recipe: RecipeDto;
  startedAt: string | null;
  onToggleSave: () => void;
  saving: boolean;
}) {
  const details = recipe.details!;
  const minutes = startedAt ? Math.max(1, Math.round((Date.now() - new Date(startedAt).getTime()) / 60000)) : null;

  return (
    <div className="relative mx-auto max-w-2xl py-6">
      <div className="pointer-events-none absolute inset-x-0 -top-4 h-40 overflow-hidden">
        {Array.from({ length: 18 }, (_, i) => (
          <motion.span
            key={i}
            className="absolute text-2xl"
            style={{ left: `${(i * 53) % 100}%` }}
            initial={{ y: -40, opacity: 0, rotate: 0 }}
            animate={{ y: 160, opacity: [0, 1, 1, 0], rotate: 360 }}
            transition={{ duration: 2.4, delay: (i % 6) * 0.15, ease: "easeOut" }}
          >
            {CONFETTI[i % CONFETTI.length]}
          </motion.span>
        ))}
      </div>

      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="overflow-hidden text-center">
          <div className="bg-gradient-to-br from-saffron-500/20 to-herb-500/15 p-8">
            <div className="text-7xl">{recipe.card.emoji}</div>
            <h1 className="mt-4 text-4xl font-semibold">You did it, chef!</h1>
            <p className="mt-2 text-lg text-muted">{recipe.card.title} is ready. Time to eat.</p>
          </div>
          <div className="space-y-6 p-6 sm:p-8">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl bg-surface-2 p-4">
                <Clock className="mx-auto h-5 w-5 text-saffron-500" />
                <div className="mt-1 text-xl font-semibold">{minutes ? `${minutes} min` : "-"}</div>
                <div className="text-xs text-muted">cook time</div>
              </div>
              <div className="rounded-2xl bg-surface-2 p-4">
                <ChefHat className="mx-auto h-5 w-5 text-herb-500" />
                <div className="mt-1 text-xl font-semibold">{details.steps.length}</div>
                <div className="text-xs text-muted">steps done</div>
              </div>
              <div className="rounded-2xl bg-surface-2 p-4">
                <Flame className="mx-auto h-5 w-5 text-tomato-500" />
                <div className="mt-1 text-xl font-semibold">{Math.round(details.nutrition.calories)}</div>
                <div className="text-xs text-muted">kcal / serving</div>
              </div>
            </div>
            <MacroBars protein={details.nutrition.protein} carbs={details.nutrition.carbs} fat={details.nutrition.fat} className="text-left" />
            <div className="flex gap-3 rounded-2xl bg-sky-500/10 p-4 text-left text-sm">
              <Snowflake className="mt-0.5 h-5 w-5 shrink-0 text-sky-500" />
              <div>
                <div className="font-semibold">Leftovers</div>
                <p className="text-muted">{details.storage}</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Button variant="outline" size="lg" onClick={onToggleSave} loading={saving}>
                {!saving && <Heart className={cn("h-5 w-5", recipe.saved && "fill-tomato-500 text-tomato-500")} />}
                {recipe.saved ? "Saved" : "Save recipe"}
              </Button>
              <Link to={`/recipe/${recipe.id}`}>
                <Button variant="outline" size="lg" className="w-full">
                  View recipe
                </Button>
              </Link>
              <Link to="/">
                <Button size="lg" className="w-full">
                  <Home className="h-5 w-5" /> Cook more
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
