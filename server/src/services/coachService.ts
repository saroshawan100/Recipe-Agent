import { randomUUID } from "node:crypto";
import { CheckinAI, CoachingScriptAI, type CoachCue, type CoachingScript, type CueAI } from "../schemas/coaching.js";
import type { RecipeDetails } from "../schemas/recipe.js";
import { structured } from "./openaiService.js";
import { checkinPrompt, coachPrompt } from "./prompts.js";

const MAX_STEP_SECONDS = 4 * 60 * 60;

function withIds(cues: CueAI[], prefix: string): CoachCue[] {
  return cues.map((c) => ({
    ...c,
    atSecond: Math.min(MAX_STEP_SECONDS, Math.max(0, Math.round(c.atSecond))),
    ifNotReady: c.ifNotReady
      ? { ...c.ifNotReady, addSeconds: Math.min(1800, Math.max(15, Math.round(c.ifNotReady.addSeconds))) }
      : null,
    id: `${prefix}-${randomUUID().slice(0, 8)}`,
  }));
}

export async function generateCoachingScript(
  title: string,
  details: RecipeDetails,
  stepIndex: number,
): Promise<CoachingScript> {
  const ai = await structured(CoachingScriptAI, "coaching_script", coachPrompt(title, details, stepIndex));
  const cues = withIds(ai.cues, `s${stepIndex}`).sort((a, b) => a.atSecond - b.atSecond);
  if (cues.length && cues[0].atSecond !== 0) cues[0].atSecond = 0;
  const lastCue = cues.at(-1)?.atSecond ?? 0;
  return {
    ...ai,
    stepIndex,
    estimatedSeconds: Math.max(lastCue, Math.min(MAX_STEP_SECONDS, Math.round(ai.estimatedSeconds))),
    cues,
  };
}

export async function generateCheckin(
  title: string,
  details: RecipeDetails,
  stepIndex: number,
  input: Parameters<typeof checkinPrompt>[3],
) {
  const ai = await structured(CheckinAI, "checkin_response", checkinPrompt(title, details, stepIndex, input));
  return {
    message: ai.message,
    heatChange: ai.heatChange,
    addSeconds: Math.min(1800, Math.max(0, Math.round(ai.addSeconds))),
    newCues: withIds(ai.newCues.slice(0, 3), `fix${stepIndex}`),
  };
}
