import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ArrowDown, ArrowUp, Check, ChefHat, Clock, Eye, Flame, Play, Power, Timer, X } from "lucide-react";
import type { CheckinResponse, CoachingScript, HeatLevel, RecipeStep } from "@/api/types";
import { ChefThinking } from "@/components/kitchen/ChefThinking";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/primitives";
import type { TimelineCue } from "@/hooks/useCoachPlayer";
import { cn, formatClock } from "@/lib/utils";
import { CUE_META, HEAT_META } from "./meta";

export function HeatBadge({ level }: { level: HeatLevel }) {
  const meta = HEAT_META[level];
  if (!meta.flames) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-tomato-500/15 px-3 py-1 text-sm font-semibold text-tomato-600 dark:text-tomato-300">
      <span className="flex">
        {Array.from({ length: 5 }, (_, i) => (
          <Flame key={i} className={cn("-mx-0.5 h-3.5 w-3.5", i < meta.flames ? "fill-current" : "opacity-25")} />
        ))}
      </span>
      {meta.label}
    </span>
  );
}

export function StepProgress({ total, current, completed }: { total: number; current: number; completed: number[] }) {
  return (
    <div className="flex w-full gap-1">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={cn(
            "h-1.5 flex-1 rounded-full transition-all duration-500",
            i === current ? "bg-saffron-500" : completed.includes(i) ? "bg-herb-500" : "bg-surface-2",
          )}
        />
      ))}
    </div>
  );
}

export function SetupCard({
  stepIndex,
  totalSteps,
  step,
  script,
  loading,
  error,
  onRetry,
  checked,
  onToggle,
  onStart,
}: {
  stepIndex: number;
  totalSteps: number;
  step: RecipeStep;
  script: CoachingScript | undefined;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  checked: Set<number>;
  onToggle: (i: number) => void;
  onStart: () => void;
}) {
  return (
    <motion.div key={stepIndex} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mx-auto w-full max-w-2xl">
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-saffron-500/15 to-herb-500/10 p-6 sm:p-8">
          <div className="text-sm font-semibold tracking-wider text-saffron-600 uppercase dark:text-saffron-300">
            Step {stepIndex + 1} of {totalSteps}
          </div>
          <h2 className="mt-1 text-3xl font-semibold sm:text-4xl">{script?.title ?? step.title}</h2>
          <p className="mt-3 text-lg leading-relaxed text-muted">{step.instruction}</p>
          {script && (
            <div className="mt-4 flex flex-wrap gap-2">
              <HeatBadge level={script.heatLevel} />
              <Badge className="px-3 py-1 text-sm">
                <Clock className="h-3.5 w-3.5" /> about {Math.max(1, Math.round(script.estimatedSeconds / 60))} min
              </Badge>
              <Badge className="px-3 py-1 text-sm">{script.mode === "timed" ? "Timed, I'll pace you" : "Go at your own pace"}</Badge>
            </div>
          )}
        </div>

        <div className="p-6 sm:p-8">
          {loading ? (
            <ChefThinking messages={["Planning this step minute by minute...", "Working out when to check on it...", "Thinking about what could go wrong..."]} />
          ) : error ? (
            <div className="text-center">
              <p className="font-semibold">The chef couldn't plan this step.</p>
              <p className="mt-1 text-sm text-muted">{error}</p>
              <Button className="mt-4" onClick={onRetry}>
                Try again
              </Button>
            </div>
          ) : script ? (
            <>
              {script.setup.length > 0 && (
                <>
                  <h3 className="mb-3 text-lg font-semibold">Before you start, have ready:</h3>
                  <ul className="space-y-2">
                    {script.setup.map((s, i) => (
                      <li key={i}>
                        <button
                          onClick={() => onToggle(i)}
                          className={cn(
                            "flex w-full cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all",
                            checked.has(i) ? "border-herb-500/50 bg-herb-500/10" : "border-line hover:border-muted/50",
                          )}
                        >
                          <span
                            className={cn(
                              "grid h-6 w-6 shrink-0 place-items-center rounded-lg border-2 transition-colors",
                              checked.has(i) ? "border-herb-500 bg-herb-500 text-white" : "border-line",
                            )}
                          >
                            {checked.has(i) && <Check className="h-4 w-4" strokeWidth={3} />}
                          </span>
                          <span className={cn(checked.has(i) && "text-muted line-through")}>{s}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <Button size="xl" className="mt-6 w-full" onClick={onStart}>
                <Play className="h-5 w-5 fill-current" /> {stepIndex === 0 ? "Let's start cooking" : "Start this step"}
              </Button>
              <p className="mt-3 text-center text-xs text-muted">Press Space to start · The chef will talk you through it</p>
            </>
          ) : null}
        </div>
      </Card>
    </motion.div>
  );
}

export function CountdownRing({ progress, label, sublabel, tone = "saffron" }: { progress: number; label: string; sublabel: string; tone?: "saffron" | "herb" | "tomato" }) {
  const size = 220;
  const r = 96;
  const c = 2 * Math.PI * r;
  const stroke = { saffron: "stroke-saffron-500", herb: "stroke-herb-500", tomato: "stroke-tomato-500" }[tone];
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={12} className="fill-none stroke-surface-2" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={12}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(1, Math.max(0, progress)))}
          className={cn("fill-none transition-[stroke-dashoffset] duration-300 ease-linear", stroke)}
        />
      </svg>
      <div className="absolute text-center">
        <div className="font-display text-5xl font-semibold tabular-nums">{label}</div>
        <div className="mt-1 max-w-36 text-sm leading-tight text-muted">{sublabel}</div>
      </div>
    </div>
  );
}

export function CueStage({
  script,
  current,
  next,
  elapsed,
  totalSeconds,
  running,
  started,
}: {
  script: CoachingScript;
  current: TimelineCue | null;
  next: TimelineCue | null;
  elapsed: number;
  totalSeconds: number;
  running: boolean;
  started: boolean;
}) {
  const meta = current ? CUE_META[current.type] : null;
  const Icon = meta?.icon ?? ChefHat;
  const remaining = totalSeconds - elapsed;
  const overdue = remaining <= 0 && !next;

  let ring: { progress: number; label: string; sublabel: string; tone: "saffron" | "herb" | "tomato" };
  if (script.mode === "selfPaced") {
    ring = { progress: Math.min(1, elapsed / Math.max(1, totalSeconds)), label: formatClock(elapsed), sublabel: `take your time · ~${Math.round(totalSeconds / 60)} min`, tone: "herb" };
  } else if (next) {
    const from = current?.atSecond ?? 0;
    const span = Math.max(1, next.atSecond - from);
    ring = {
      progress: (elapsed - from) / span,
      label: formatClock(next.atSecond - elapsed),
      sublabel: next.type === "check" ? "until we check" : "until next move",
      tone: next.type === "check" ? "herb" : "saffron",
    };
  } else if (!overdue) {
    ring = { progress: elapsed / Math.max(1, totalSeconds), label: formatClock(remaining), sublabel: "left in this step", tone: "saffron" };
  } else {
    ring = { progress: 1, label: "Done?", sublabel: "check the signs, then tap Done", tone: "herb" };
  }

  return (
    <Card className="relative overflow-hidden p-6 sm:p-8">
      <div className="flex flex-col items-center gap-8 md:flex-row md:items-start">
        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {meta && (
              <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold", meta.ring, meta.tone)}>
                <Icon className="h-4 w-4" />
                {meta.label}
              </span>
            )}
            <HeatBadge level={script.heatLevel} />
            {!running && started && <Badge tone="saffron" className="px-3 py-1 text-sm">Paused</Badge>}
          </div>
          <AnimatePresence mode="wait">
            <motion.div key={current?.id ?? "intro"} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}>
              <h2 className="text-3xl leading-tight font-semibold sm:text-4xl lg:text-5xl">{current?.say ?? script.title}</h2>
              <p className="mt-4 text-lg leading-relaxed text-muted">{current?.detail ?? "Get ready, the chef is about to walk you through this."}</p>
            </motion.div>
          </AnimatePresence>
          {next && script.mode === "timed" && (
            <div className="flex items-center gap-2 rounded-2xl bg-surface-2/70 px-4 py-3 text-sm">
              <span className="font-semibold text-muted">Up next:</span>
              <span className="truncate">{next.say}</span>
            </div>
          )}
        </div>
        <CountdownRing {...ring} />
      </div>
      <div className="absolute inset-x-0 bottom-0 h-1.5 bg-surface-2">
        <div className="h-full bg-gradient-to-r from-saffron-400 to-herb-500 transition-all duration-300" style={{ width: `${Math.min(100, (elapsed / Math.max(1, totalSeconds)) * 100)}%` }} />
      </div>
    </Card>
  );
}

export function CheckCard({ cue, onAnswer }: { cue: TimelineCue; onAnswer: (a: "good" | "notYet" | "problem") => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12 }} className="animate-pulse-ring rounded-3xl">
      <Card className="border-herb-500/50 bg-herb-500/10 p-6">
        <div className="flex items-center gap-2 text-sm font-semibold tracking-wider text-herb-700 uppercase dark:text-herb-300">
          <Eye className="h-4 w-4" /> Time to check
        </div>
        <p className="mt-2 text-2xl font-semibold">{cue.checkQuestion ?? cue.say}</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Button variant="herb" size="lg" onClick={() => onAnswer("good")}>
            <Check className="h-5 w-5" /> Looks good
          </Button>
          <Button variant="outline" size="lg" onClick={() => onAnswer("notYet")}>
            <Clock className="h-5 w-5" /> Not yet
          </Button>
          <Button variant="outline" size="lg" onClick={() => onAnswer("problem")} className="border-tomato-500/50 text-tomato-600 hover:bg-tomato-500/10 dark:text-tomato-300">
            <AlertTriangle className="h-5 w-5" /> Something's wrong
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}

const HEAT_CHANGE: Record<CheckinResponse["heatChange"], { label: string; icon: typeof ArrowDown } | null> = {
  none: null,
  lower: { label: "Turn the heat down", icon: ArrowDown },
  raise: { label: "Turn the heat up", icon: ArrowUp },
  off: { label: "Turn the heat off", icon: Power },
};

export function ChefMessage({ text, heatChange, onDismiss }: { text: string; heatChange: CheckinResponse["heatChange"]; onDismiss: () => void }) {
  const heat = HEAT_CHANGE[heatChange];
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}>
      <Card className="flex gap-4 border-saffron-500/40 p-5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-saffron-400 to-saffron-600 text-stone-950">
          <ChefHat className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <div className="text-xs font-semibold tracking-wider text-saffron-600 uppercase dark:text-saffron-300">Chef says</div>
          {heat && (
            <div className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-tomato-500/15 px-2.5 py-0.5 text-sm font-semibold text-tomato-600 dark:text-tomato-300">
              <heat.icon className="h-3.5 w-3.5" /> {heat.label}
            </div>
          )}
          <p className="mt-1 text-lg leading-relaxed">{text}</p>
        </div>
        <button onClick={onDismiss} aria-label="Dismiss" className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-lg text-muted hover:bg-surface-2">
          <X className="h-4 w-4" />
        </button>
      </Card>
    </motion.div>
  );
}

export function MeanwhileCard({ cue, onDismiss }: { cue: TimelineCue; onDismiss: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}>
      <Card className="flex gap-4 border-sky-500/40 bg-sky-500/5 p-5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-300">
          <Timer className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <div className="text-xs font-semibold tracking-wider text-sky-600 uppercase dark:text-sky-300">Meanwhile</div>
          <p className="mt-1 font-semibold">{cue.say}</p>
          <p className="mt-1 text-sm text-muted">{cue.detail}</p>
        </div>
        <button onClick={onDismiss} aria-label="Got it" className="h-fit cursor-pointer rounded-lg px-2 py-1 text-sm font-medium text-muted hover:bg-surface-2">
          Got it
        </button>
      </Card>
    </motion.div>
  );
}

export function Subtasks({ items, done, onToggle }: { items: string[]; done: Set<number>; onToggle: (i: number) => void }) {
  if (!items.length) return null;
  return (
    <Card className="p-6">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Your checklist</h3>
        <span className="text-sm text-muted">
          {done.size}/{items.length}
        </span>
      </div>
      <ul className="space-y-2">
        {items.map((s, i) => (
          <li key={i}>
            <button
              onClick={() => onToggle(i)}
              className={cn(
                "flex w-full cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-left text-lg transition-all",
                done.has(i) ? "border-herb-500/40 bg-herb-500/10" : "border-line hover:border-muted/50",
              )}
            >
              <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-lg border-2", done.has(i) ? "border-herb-500 bg-herb-500 text-white" : "border-line")}>
                {done.has(i) && <Check className="h-4 w-4" strokeWidth={3} />}
              </span>
              <span className={cn(done.has(i) && "text-muted line-through")}>{s}</span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function CueTimeline({ cues, firedIds, currentId, elapsed }: { cues: TimelineCue[]; firedIds: ReadonlySet<string>; currentId: string | null; elapsed: number }) {
  return (
    <Card className="p-5">
      <h3 className="mb-4 text-lg font-semibold">This step, minute by minute</h3>
      <ol className="relative space-y-1 before:absolute before:top-2 before:bottom-2 before:left-[15px] before:w-px before:bg-line">
        {cues.map((c) => {
          const meta = CUE_META[c.type];
          const fired = firedIds.has(c.id);
          const isCurrent = c.id === currentId;
          return (
            <li key={c.id} className={cn("relative flex gap-3 rounded-xl p-1.5 transition-colors", isCurrent && "bg-saffron-500/10")}>
              <span
                className={cn(
                  "relative z-10 grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full border-2 bg-surface",
                  isCurrent ? "border-saffron-500" : fired ? "border-herb-500" : "border-line",
                )}
              >
                {fired && !isCurrent ? <Check className="h-3.5 w-3.5 text-herb-500" strokeWidth={3} /> : <meta.icon className={cn("h-3.5 w-3.5", isCurrent ? meta.tone : "text-muted")} />}
              </span>
              <div className={cn("min-w-0 flex-1 pt-1", !fired && "opacity-60", fired && !isCurrent && "opacity-70")}>
                <div className="flex items-center gap-2 text-xs text-muted">
                  <span className="font-semibold tabular-nums">{fired ? formatClock(c.atSecond) : `in ${formatClock(Math.max(0, c.atSecond - elapsed))}`}</span>
                  <span>·</span>
                  <span className={meta.tone}>{meta.label}</span>
                  {c.origin === "fix" && <Badge tone="saffron">chef's fix</Badge>}
                </div>
                <p className={cn("text-sm leading-snug", isCurrent && "font-semibold")}>{c.say}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

export function DoneWhenCard({ script }: { script: CoachingScript }) {
  return (
    <Card className="space-y-5 p-5">
      {script.doneWhen.length > 0 && (
        <div>
          <h3 className="mb-2 flex items-center gap-2 font-semibold">
            <Eye className="h-4 w-4 text-herb-500" /> It's done when
          </h3>
          <ul className="space-y-1.5 text-sm">
            {script.doneWhen.map((d, i) => (
              <li key={i} className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-herb-500" />
                {d}
              </li>
            ))}
          </ul>
        </div>
      )}
      {script.commonMistakes.length > 0 && (
        <div>
          <h3 className="mb-2 flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4 text-tomato-500" /> Common mistakes
          </h3>
          <ul className="space-y-1.5 text-sm text-muted">
            {script.commonMistakes.map((d, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-tomato-500" />
                {d}
              </li>
            ))}
          </ul>
        </div>
      )}
      {script.nextStepPreview && (
        <div className="rounded-2xl bg-surface-2/70 p-3 text-sm">
          <span className="font-semibold">Next step: </span>
          <span className="text-muted">{script.nextStepPreview}</span>
        </div>
      )}
    </Card>
  );
}
