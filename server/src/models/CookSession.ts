import { Schema, model, type HydratedDocument } from "mongoose";

export interface Checkin {
  stepIndex: number;
  cueId?: string;
  answer: "notYet" | "problem";
  issue?: string;
  note?: string;
  response: string;
  at: Date;
}

export interface CookSessionDoc {
  clientId: string;
  recipeId: string;
  status: "active" | "completed" | "abandoned";
  currentStep: number;
  stepElapsedSeconds: number;
  completedSteps: number[];
  checkins: Checkin[];
  startedAt: Date;
  finishedAt: Date | null;
}

const CookSessionSchema = new Schema<CookSessionDoc>(
  {
    clientId: { type: String, required: true },
    recipeId: { type: String, required: true },
    status: { type: String, enum: ["active", "completed", "abandoned"], default: "active" },
    currentStep: { type: Number, default: 0 },
    stepElapsedSeconds: { type: Number, default: 0 },
    completedSteps: { type: [Number], default: [] },
    checkins: {
      type: [
        new Schema<Checkin>(
          {
            stepIndex: Number,
            cueId: String,
            answer: String,
            issue: String,
            note: String,
            response: String,
            at: Date,
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    startedAt: { type: Date, default: () => new Date() },
    finishedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

CookSessionSchema.index({ clientId: 1, recipeId: 1, status: 1 });

export const CookSession = model<CookSessionDoc>("CookSession", CookSessionSchema);

export function toSessionDto(doc: HydratedDocument<CookSessionDoc>) {
  return {
    id: doc.id as string,
    recipeId: doc.recipeId,
    status: doc.status,
    currentStep: doc.currentStep,
    stepElapsedSeconds: doc.stepElapsedSeconds,
    completedSteps: doc.completedSteps,
    startedAt: doc.startedAt,
    finishedAt: doc.finishedAt,
  };
}
