import { Schema, model } from "mongoose";

export type FeedbackRating = "liked" | "notForMe" | null;

export interface RecipeFeedbackDoc {
  clientId: string;
  recipeId: string;
  recipeTitle: string;
  tried: boolean;
  rating: FeedbackRating;
  tagSnapshot: {
    cuisine: string;
    ingredients: string[];
    profileTags: Record<string, unknown> | null;
    otherTags: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

const RecipeFeedbackSchema = new Schema<RecipeFeedbackDoc>(
  {
    clientId: { type: String, required: true },
    recipeId: { type: String, required: true },
    recipeTitle: { type: String, required: true },
    tried: { type: Boolean, default: false },
    rating: { type: String, enum: ["liked", "notForMe", null], default: null },
    tagSnapshot: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true, minimize: false },
);

RecipeFeedbackSchema.index({ clientId: 1, recipeId: 1 }, { unique: true });
RecipeFeedbackSchema.index({ clientId: 1, rating: 1, updatedAt: -1 });

export const RecipeFeedback = model<RecipeFeedbackDoc>("RecipeFeedback", RecipeFeedbackSchema);
