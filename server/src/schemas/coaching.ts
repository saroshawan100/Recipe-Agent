import { z } from "zod";

export const CueType = z.enum(["action", "check", "warning", "meanwhile", "tip"]);

export const Cue = z.object({
  atSecond: z.number().describe("Seconds since the cook started this step"),
  type: CueType,
  say: z.string().describe("One short spoken sentence, imperative and friendly (max ~15 words)"),
  detail: z.string().describe("Exactly how to do it: technique, heat, what to look/listen/smell for"),
  checkQuestion: z.string().nullable().describe("For 'check' cues: a yes/no question, e.g. 'Is the bottom deep brown?'"),
  ifNotReady: z
    .object({ addSeconds: z.number(), advice: z.string() })
    .nullable()
    .describe("For 'check' cues: how much longer and what to do if not ready yet"),
});

export const CoachingScriptAI = z.object({
  title: z.string(),
  mode: z.enum(["timed", "selfPaced"]),
  estimatedSeconds: z.number(),
  heatLevel: z.enum(["none", "low", "medium-low", "medium", "medium-high", "high"]),
  setup: z.array(z.string()).describe("What to have ready before pressing start"),
  subtasks: z.array(z.string()).describe("Ordered checklist for self-paced steps; may be empty for timed steps"),
  cues: z.array(Cue),
  doneWhen: z.array(z.string()).describe("Concrete sensory signs the step is complete"),
  commonMistakes: z.array(z.string()),
  nextStepPreview: z.string().nullable(),
});

export type CueAI = z.infer<typeof Cue>;
export type CoachCue = CueAI & { id: string };
export type CoachingScript = Omit<z.infer<typeof CoachingScriptAI>, "cues"> & {
  stepIndex: number;
  cues: CoachCue[];
};

export const CheckinAI = z.object({
  message: z.string().describe("1-3 short, calm, speakable sentences with a specific fix"),
  heatChange: z.enum(["none", "lower", "raise", "off"]),
  addSeconds: z.number().describe("Extra seconds the current stage needs; 0 if none"),
  newCues: z.array(Cue).describe("0-3 follow-up cues; atSecond is seconds FROM NOW"),
});

export const CheckinRequest = z.object({
  recipeId: z.string(),
  stepIndex: z.number().int().min(0),
  sessionId: z.string().optional(),
  cueId: z.string().max(80).optional(),
  answer: z.enum(["notYet", "problem"]),
  issue: z.string().max(80).optional(),
  note: z.string().max(500).optional(),
  image: z.string().max(2_100_000).regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/).optional(),
  elapsedSeconds: z.number().min(0).max(86_400),
});

export const ChatMessage = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(4000),
});

const AskMessage = ChatMessage.extend({
  image: z.string().max(2_100_000).regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/).optional(),
});

export const AskMessages = z.array(AskMessage).min(1).max(20).superRefine((messages, ctx) => {
  if (messages.filter((message) => message.image).length > 1) {
    ctx.addIssue({ code: "custom", message: "Only one photo can be attached per question." });
  }
});

export const AskRequest = z.object({
  recipeId: z.string(),
  stepIndex: z.number().int().min(0),
  elapsedSeconds: z.number().min(0).max(86_400).default(0),
  messages: AskMessages,
});

export const SessionPatch = z.object({
  currentStep: z.number().int().min(0).optional(),
  stepElapsedSeconds: z.number().min(0).max(86_400).optional(),
  completedSteps: z.array(z.number().int().min(0)).max(100).optional(),
  status: z.enum(["active", "completed", "abandoned"]).optional(),
});
