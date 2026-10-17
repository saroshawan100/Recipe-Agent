import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence } from "framer-motion";
import { AlertTriangle, ArrowLeft, Check, ChevronLeft, MessageCircle, Pause, Play, Plus, RotateCcw, SkipForward, Volume2, VolumeX, X } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  coachKey,
  fetchCoachScript,
  useCheckin,
  useCoachScript,
  useRecipe,
  useRecipeDetails,
  useRestartSession,
  useStartSession,
  useToggleSaved,
  useUpdateSession,
} from "@/api/hooks";
import type { CheckinResponse, CookSession, CueType, HeatLevel } from "@/api/types";
import { AskStepSheet, FinishScreen, ProblemDialog, ResumeDialog } from "@/components/cook-with-chef/dialogs";
import { adjustHeat } from "@/components/cook-with-chef/meta";
import {
  ChefMessage,
  CheckCard,
  CueStage,
  CueTimeline,
  DoneWhenCard,
  MeanwhileCard,
  SetupCard,
  StepProgress,
  Subtasks,
} from "@/components/cook-with-chef/parts";
import { ChefThinking } from "@/components/kitchen/ChefThinking";
import { Button } from "@/components/ui/button";
import { useChefVoice } from "@/hooks/useChefVoice";
import { useCoachPlayer, type TimelineCue } from "@/hooks/useCoachPlayer";
import { useStepClock } from "@/hooks/useStepClock";
import { useWakeLock } from "@/hooks/useWakeLock";
import { playChime, unlockAudio } from "@/lib/chime";
import { cn, formatClock } from "@/lib/utils";
import { useUiStore } from "@/store/useUiStore";

const CHIME_PRIORITY: CueType[] = ["warning", "check", "action", "meanwhile", "tip"];
const PERSIST_EVERY_MS = 15_000;

export function CookWithChef() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const recipeQ = useRecipe(id);
  const recipe = recipeQ.data;
  const detailsQ = useRecipeDetails(id, !!recipe && !recipe.details);
  const details = recipe?.details ?? detailsQ.data?.details ?? null;
  const totalSteps = details?.steps.length ?? 0;

  const startSession = useStartSession();
  const restartSession = useRestartSession();
  const updateSession = useUpdateSession();
  const checkin = useCheckin();
  const toggleSaved = useToggleSaved();

  const [session, setSession] = useState<CookSession | null>(null);
  const [ready, setReady] = useState(false);
  const [resumeOpen, setResumeOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [completed, setCompleted] = useState<number[]>([]);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);

  const [setupChecked, setSetupChecked] = useState<Set<number>>(new Set());
  const [subtasksDone, setSubtasksDone] = useState<Set<number>>(new Set());
  const [pendingCheck, setPendingCheck] = useState<TimelineCue | null>(null);
  const [meanwhile, setMeanwhile] = useState<TimelineCue | null>(null);
  const [chefMsg, setChefMsg] = useState<{ text: string; heatChange: CheckinResponse["heatChange"] } | null>(null);
  const [heatLevel, setHeatLevel] = useState<HeatLevel | null>(null);
  const [problemOpen, setProblemOpen] = useState(false);
  const [askOpen, setAskOpen] = useState(false);

  const voiceEnabled = useUiStore((s) => s.voiceEnabled);
  const setVoiceEnabled = useUiStore((s) => s.setVoiceEnabled);
  const chimesEnabled = useUiStore((s) => s.chimesEnabled);

  const clock = useStepClock();
  const voice = useChefVoice();
  const resumeElapsedRef = useRef<number | null>(null);
  const overdueAnnouncedRef = useRef(false);

  const onFire = (due: TimelineCue[]) => {
    const top = [...due].sort((a, b) => CHIME_PRIORITY.indexOf(a.type) - CHIME_PRIORITY.indexOf(b.type))[0];
    if (chimesEnabled) playChime(top.type);
    for (const cue of due) {
      if (cue.type === "check") setPendingCheck(cue);
      if (cue.type === "meanwhile") setMeanwhile(cue);
      voice.speak(cue.say);
    }
  };
  const player = useCoachPlayer({ elapsed: clock.elapsed, running: clock.running, onFire });

  const scriptQ = useCoachScript(id, stepIndex, !!details && ready);
  const script = scriptQ.data?.stepIndex === stepIndex ? scriptQ.data : undefined;
  const totalSeconds = script ? script.estimatedSeconds + player.extraSeconds : 0;
  const overdue = started && !!script && !player.next && clock.elapsed >= totalSeconds;

  // ---------- Session ----------
  const sessionRequested = useRef(false);
  useEffect(() => {
    if (!id || !details || sessionRequested.current) return;
    sessionRequested.current = true;
    startSession.mutate(id, {
      onSuccess: (s) => {
        setSession(s);
        if (s.status === "active" && (s.currentStep > 0 || s.stepElapsedSeconds > 5)) setResumeOpen(true);
        else setReady(true);
      },
      onError: () => setReady(true),
    });
  }, [id, details, startSession]);

  const stateRef = useRef({ stepIndex, session });
  stateRef.current = { stepIndex, session };

  const persist = useCallback(
    (patch: { currentStep?: number; stepElapsedSeconds?: number; completedSteps?: number[]; status?: CookSession["status"] } = {}) => {
      const { session: s, stepIndex: step } = stateRef.current;
      if (!s) return;
      updateSession.mutate({ id: s.id, currentStep: step, stepElapsedSeconds: Math.round(clock.read()), ...patch });
    },
    [clock, updateSession],
  );

  useEffect(() => {
    if (!clock.running) return;
    const t = window.setInterval(() => persist(), PERSIST_EVERY_MS);
    return () => window.clearInterval(t);
  }, [clock.running, persist]);

  const onResume = () => {
    if (!session || !details) return;
    const step = Math.min(session.currentStep, details.steps.length - 1);
    resumeElapsedRef.current = session.stepElapsedSeconds > 0 ? session.stepElapsedSeconds : null;
    setStepIndex(step);
    setCompleted(session.completedSteps);
    setResumeOpen(false);
    setReady(true);
  };

  const onRestart = () => {
    if (!session) return;
    restartSession.mutate(session.id, {
      onSuccess: (s) => {
        setSession(s);
        setStepIndex(0);
        setCompleted([]);
        setResumeOpen(false);
        setReady(true);
      },
      onError: (e) => toast.error(e.message),
    });
  };

  // ---------- Step lifecycle ----------
  const resetStepState = useCallback(
    (initialElapsed: number) => {
      if (!script) return;
      player.init(script, initialElapsed);
      clock.reset(initialElapsed);
      setStarted(initialElapsed > 0);
      setPendingCheck(null);
      setMeanwhile(null);
      setChefMsg(null);
      setHeatLevel(null);
      setSetupChecked(new Set());
      setSubtasksDone(new Set());
      overdueAnnouncedRef.current = false;
    },
    [script, player.init, clock.reset],
  );

  useEffect(() => {
    if (!script) return;
    const initial = resumeElapsedRef.current ?? 0;
    resumeElapsedRef.current = null;
    resetStepState(initial);
  }, [script, resetStepState]);

  useEffect(() => {
    if (!script || !details || stepIndex + 1 >= details.steps.length) return;
    void qc.prefetchQuery({
      queryKey: coachKey(id, stepIndex + 1),
      queryFn: () => fetchCoachScript(id, stepIndex + 1),
      staleTime: Infinity,
    });
  }, [script, details, stepIndex, id, qc]);

  useEffect(() => {
    if (overdue && clock.running && !overdueAnnouncedRef.current) {
      overdueAnnouncedRef.current = true;
      if (chimesEnabled) playChime("check");
      voice.speak("That should be about done. Check the signs, then tap Done when you're happy.");
    }
  }, [overdue, clock.running, chimesEnabled, voice]);

  useWakeLock(ready && !finished);

  const startStep = () => {
    unlockAudio();
    clock.start();
    setStarted(true);
  };

  const togglePause = () => {
    if (!started) return startStep();
    if (clock.running) {
      clock.pause();
      voice.cancel();
      persist();
    } else {
      unlockAudio();
      clock.start();
    }
  };

  const goToStep = (next: number, newCompleted: number[]) => {
    voice.cancel();
    clock.reset(0);
    setStarted(false);
    setStepIndex(next);
    persist({ currentStep: next, stepElapsedSeconds: 0, completedSteps: newCompleted });
  };

  const completeStep = () => {
    if (!details || !recipe) return;
    const newCompleted = Array.from(new Set([...completed, stepIndex])).sort((a, b) => a - b);
    setCompleted(newCompleted);
    const next = stepIndex + 1;
    if (next >= details.steps.length) {
      voice.cancel();
      clock.reset(0);
      setFinished(true);
      if (chimesEnabled) playChime("done");
      voice.speak(`That's it! ${recipe.card.title} is ready. Amazing job, chef!`, { interrupt: true });
      persist({ completedSteps: newCompleted, status: "completed", stepElapsedSeconds: 0 });
      return;
    }
    goToStep(next, newCompleted);
    voice.speak(`Nice work. Next up: ${details.steps[next].title}.`);
  };

  const prevStep = () => {
    if (stepIndex === 0) return;
    goToStep(stepIndex - 1, completed);
  };

  const repeatCue = () => {
    const cue = player.current;
    if (cue) voice.speak(`${cue.say} ${cue.detail}`, { interrupt: true, force: true });
  };

  const addMinute = () => {
    player.shiftUpcoming(60, clock.read());
    toast("Added a minute", { description: "Everything upcoming moved back 1:00." });
  };

  // ---------- Check-ins ----------
  const answerCheck = (answer: "good" | "notYet" | "problem") => {
    const cue = pendingCheck;
    if (!cue) return;
    if (answer === "good") {
      setPendingCheck(null);
      if (!player.next) voice.speak("Perfect. Tap Done when you're ready to move on.", { interrupt: true });
      return;
    }
    if (answer === "problem") {
      setProblemOpen(true);
      return;
    }
    const add = cue.ifNotReady?.addSeconds ?? 60;
    const now = clock.read();
    player.shiftUpcoming(add, now);
    player.insert([
      {
        ...cue,
        id: `${cue.id}-re${Math.round(now)}`,
        atSecond: Math.round(now + add),
        say: `Let's check again. ${cue.checkQuestion ?? cue.say}`,
        origin: "recheck",
      },
    ]);
    const advice = cue.ifNotReady?.advice ?? "No problem, give it a little longer.";
    const text = `${advice} I'll check back in ${formatClock(add)}.`;
    setChefMsg({ text, heatChange: "none" });
    voice.speak(text, { interrupt: true });
    setPendingCheck(null);
  };

  const submitProblem = (issue: string | undefined, note: string | undefined, image?: string) => {
    checkin.mutate(
      {
        recipeId: id,
        stepIndex,
        sessionId: session?.id,
        cueId: pendingCheck?.id,
        answer: "problem",
        issue,
        note,
        image,
        elapsedSeconds: Math.round(clock.read()),
      },
      {
        onSuccess: (r) => {
          const now = clock.read();
          if (r.addSeconds > 0) player.shiftUpcoming(r.addSeconds, now);
          if (r.newCues.length) {
            player.insert(r.newCues.map((c) => ({ ...c, atSecond: Math.round(now + Math.max(1, c.atSecond)), origin: "fix" as const })));
          }
          setChefMsg({ text: r.message, heatChange: r.heatChange });
          setHeatLevel((h) => adjustHeat(h ?? script!.heatLevel, r.heatChange));
          if (chimesEnabled) playChime("warning");
          voice.speak(r.message, { interrupt: true });
          setPendingCheck(null);
          setProblemOpen(false);
        },
        onError: (e) => toast.error("The chef couldn't respond", { description: e.message }),
      },
    );
  };

  // ---------- Keyboard ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, select") || problemOpen || askOpen || resumeOpen || finished || !script) return;
      if (e.code === "Space") {
        e.preventDefault();
        togglePause();
      } else if (e.key === "ArrowRight" && started) {
        completeStep();
      } else if (e.key === "ArrowLeft") {
        prevStep();
      } else if (e.key.toLowerCase() === "r" && started) {
        repeatCue();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const exit = () => {
    if (clock.running) clock.pause();
    voice.cancel();
    if (!finished) persist();
    navigate(`/recipe/${id}`);
  };

  // ---------- Render ----------
  if (recipeQ.isError || detailsQ.isError) {
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        <div>
          <div className="text-6xl">🍳</div>
          <h1 className="mt-4 text-2xl font-semibold">We couldn't load this recipe</h1>
          <p className="mt-2 text-muted">{(recipeQ.error ?? detailsQ.error)?.message}</p>
          <Link to="/" className="mt-6 inline-block">
            <Button>Back to the kitchen</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!recipe || !details) {
    return (
      <div className="grid min-h-screen place-items-center p-6">
        <ChefThinking messages={["Setting up your station...", "Reading the recipe...", "Sharpening the knives..."]} className="glass w-full max-w-md rounded-3xl p-6" />
      </div>
    );
  }

  const step = details.steps[stepIndex];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="glass sticky top-0 z-30 border-x-0 border-t-0">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={exit} aria-label="Exit cooking mode">
            <X className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-baseline gap-2 text-sm">
              <span className="truncate font-semibold">{recipe.card.title}</span>
              {!finished && (
                <span className="shrink-0 text-muted">
                  Step {stepIndex + 1} of {totalSteps}
                </span>
              )}
            </div>
            <StepProgress total={totalSteps} current={finished ? -1 : stepIndex} completed={completed} />
          </div>
          {voice.supported && (
            <Button
              variant={voiceEnabled ? "secondary" : "ghost"}
              size="icon"
              onClick={() => setVoiceEnabled(!voiceEnabled)}
              aria-label={voiceEnabled ? "Mute chef voice" : "Unmute chef voice"}
              title={voiceEnabled ? "Chef voice on" : "Chef voice off"}
            >
              {voiceEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
            </Button>
          )}
          {!finished && (
            <Button variant="secondary" onClick={() => setAskOpen(true)} className="hidden sm:inline-flex">
              <MessageCircle className="h-4 w-4" /> Ask the chef
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 pb-36">
        {finished ? (
          <FinishScreen
            recipe={recipe}
            startedAt={session?.startedAt ?? null}
            saving={toggleSaved.isPending}
            onToggleSave={() => toggleSaved.mutate({ id: recipe.id, saved: !recipe.saved })}
          />
        ) : !started ? (
          <div className="space-y-4">
            <SetupCard
              stepIndex={stepIndex}
              totalSteps={totalSteps}
              step={step}
              script={script}
              loading={!ready || scriptQ.isLoading || (!script && !scriptQ.isError)}
              error={scriptQ.isError ? scriptQ.error.message : null}
              onRetry={() => scriptQ.refetch()}
              checked={setupChecked}
              onToggle={(i) =>
                setSetupChecked((s) => {
                  const n = new Set(s);
                  if (n.has(i)) n.delete(i);
                  else n.add(i);
                  return n;
                })
              }
              onStart={startStep}
            />
            <div className="mx-auto flex max-w-2xl justify-between">
              <Button variant="ghost" onClick={prevStep} disabled={stepIndex === 0}>
                <ChevronLeft className="h-4 w-4" /> Previous step
              </Button>
              <Button variant="ghost" onClick={completeStep}>
                I've already done this <SkipForward className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : script ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className="space-y-4">
              <CueStage
                script={heatLevel && heatLevel !== script.heatLevel ? { ...script, heatLevel } : script}
                current={player.current}
                next={player.next}
                elapsed={clock.elapsed}
                totalSeconds={totalSeconds}
                running={clock.running}
                started={started}
              />
              <AnimatePresence>{pendingCheck && <CheckCard key={pendingCheck.id} cue={pendingCheck} onAnswer={answerCheck} />}</AnimatePresence>
              <AnimatePresence>{chefMsg && <ChefMessage key={chefMsg.text} {...chefMsg} onDismiss={() => setChefMsg(null)} />}</AnimatePresence>
              <AnimatePresence>{meanwhile && <MeanwhileCard key={meanwhile.id} cue={meanwhile} onDismiss={() => setMeanwhile(null)} />}</AnimatePresence>
              {script.mode === "selfPaced" && (
                <Subtasks
                  items={script.subtasks}
                  done={subtasksDone}
                  onToggle={(i) =>
                    setSubtasksDone((s) => {
                      const n = new Set(s);
                      if (n.has(i)) n.delete(i);
                      else n.add(i);
                      return n;
                    })
                  }
                />
              )}
            </div>
            <aside className="space-y-4">
              <CueTimeline cues={player.cues} firedIds={player.firedIds} currentId={player.current?.id ?? null} elapsed={clock.elapsed} />
              <DoneWhenCard script={script} />
            </aside>
          </div>
        ) : null}
      </main>

      {!finished && started && script && (
        <div className="glass fixed inset-x-0 bottom-0 z-30 border-x-0 border-b-0">
          <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3 sm:gap-3">
            <Button variant="ghost" size="lg" onClick={prevStep} disabled={stepIndex === 0} aria-label="Previous step" className="px-3">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Button variant="secondary" size="lg" onClick={togglePause} className="min-w-[3rem] px-3 sm:px-5" aria-label={clock.running ? "Pause" : "Resume"}>
              {clock.running ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              <span className="hidden sm:inline">{clock.running ? "Pause" : "Resume"}</span>
            </Button>
            {script.mode === "timed" && (
              <Button variant="ghost" size="lg" onClick={addMinute} className="px-3" title="Need another minute">
                <Plus className="h-5 w-5" />
                <span className="hidden md:inline">1 min</span>
              </Button>
            )}
            <Button variant="ghost" size="lg" onClick={repeatCue} disabled={!player.current} className="px-3" title="Repeat (R)">
              <RotateCcw className="h-5 w-5" />
              <span className="hidden md:inline">Repeat</span>
            </Button>
            <Button variant="ghost" size="lg" onClick={() => setProblemOpen(true)} className="px-3 text-tomato-600 dark:text-tomato-300" title="Something's wrong">
              <AlertTriangle className="h-5 w-5" />
              <span className="hidden md:inline">Problem?</span>
            </Button>
            <Button variant="ghost" size="lg" onClick={() => setAskOpen(true)} className="px-3 sm:hidden" aria-label="Ask the chef">
              <MessageCircle className="h-5 w-5" />
            </Button>
            <Button variant="herb" size="lg" onClick={completeStep} className={cn("ml-auto px-5 sm:px-8", overdue && "animate-pulse-ring")}>
              <Check className="h-5 w-5" strokeWidth={3} />
              {stepIndex + 1 === totalSteps ? "Finish" : "Done"}
            </Button>
          </div>
        </div>
      )}

      <ProblemDialog open={problemOpen} onOpenChange={setProblemOpen} onSubmit={submitProblem} pending={checkin.isPending} />
      <AskStepSheet
        open={askOpen}
        onOpenChange={setAskOpen}
        recipeId={id}
        stepIndex={stepIndex}
        stepTitle={step.title}
        getElapsed={clock.read}
        speak={voice.speak}
      />
      <ResumeDialog
        open={resumeOpen}
        step={Math.min(session?.currentStep ?? 0, totalSteps - 1)}
        totalSteps={totalSteps}
        onResume={onResume}
        onRestart={onRestart}
        restarting={restartSession.isPending}
      />
    </div>
  );
}
