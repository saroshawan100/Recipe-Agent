import { Schema, model, type HydratedDocument } from "mongoose";
import type { CoachingScript } from "../schemas/coaching.js";
import type { RecipeCard, RecipeDetails } from "../schemas/recipe.js";
import type { RecipeContext } from "../services/prompts.js";

export type RecipeGroup = "makeNow" | "quickShop";

export interface RecipeDoc {
  clientId: string;
  group: RecipeGroup;
  card: RecipeCard;
  context: RecipeContext;
  details: RecipeDetails | null;
  imageUrl: string | null;
  coaching: Record<string, CoachingScript>;
  saved: boolean;
  savedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const RecipeSchema = new Schema<RecipeDoc>(
  {
    clientId: { type: String, required: true, index: true },
    group: { type: String, enum: ["makeNow", "quickShop"], required: true },
    card: { type: Schema.Types.Mixed, required: true },
    context: { type: Schema.Types.Mixed, required: true },
    details: { type: Schema.Types.Mixed, default: null },
    imageUrl: { type: String, default: null },
    coaching: { type: Schema.Types.Mixed, default: () => ({}) },
    saved: { type: Boolean, default: false },
    savedAt: { type: Date, default: null },
  },
  { timestamps: true, minimize: false },
);

RecipeSchema.index({ clientId: 1, saved: 1, savedAt: -1 });

export const Recipe = model<RecipeDoc>("Recipe", RecipeSchema);
export type RecipeDocument = HydratedDocument<RecipeDoc>;

export function toRecipeDto(doc: RecipeDocument) {
  return {
    id: doc.id as string,
    group: doc.group,
    card: doc.card,
    details: doc.details,
    imageUrl: doc.imageUrl,
    saved: doc.saved,
    servings: doc.context?.preferences?.servings ?? doc.card.servings,
    calorieTarget: doc.context?.preferences?.calorieTarget ?? null,
    createdAt: doc.createdAt,
  };
}

export function toRecipeSummary(doc: RecipeDocument) {
  return {
    id: doc.id as string,
    group: doc.group,
    imageUrl: doc.imageUrl,
    saved: doc.saved,
    ...doc.card,
  };
}
