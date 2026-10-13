import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import type { z } from "zod";
import { config } from "../config.js";
import { HttpError } from "../lib/httpError.js";
import { RecipeDetails, SuggestResult, type RecipeCard } from "../schemas/recipe.js";
import { detailsPrompt, suggestPrompt, type RecipeContext } from "./prompts.js";

export const openai = new OpenAI({ apiKey: config.openaiApiKey, maxRetries: 2, timeout: 120_000 });

export async function structured<T extends z.ZodTypeAny>(
  schema: T,
  name: string,
  prompt: { system: string; user: string },
): Promise<z.infer<T>> {
  const completion = await openai.chat.completions.parse({
    model: config.model,
    messages: [
      { role: "system", content: prompt.system },
      { role: "user", content: prompt.user },
    ],
    response_format: zodResponseFormat(schema, name),
  });
  const message = completion.choices[0]?.message;
  if (message?.refusal) throw new HttpError(422, `The chef couldn't help with that: ${message.refusal}`);
  if (!message?.parsed) throw new HttpError(502, "The AI chef returned an empty response. Please try again.");
  return message.parsed as z.infer<T>;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const round = (n: number) => Math.round(Number.isFinite(n) ? n : 0);

function normalizeCard(card: RecipeCard): RecipeCard {
  return {
    ...card,
    matchPercent: clamp(round(card.matchPercent), 0, 100),
    totalMinutes: Math.max(1, round(card.totalMinutes)),
    servings: Math.max(1, round(card.servings)),
    macros: {
      calories: Math.max(0, round(card.macros.calories)),
      protein: Math.max(0, round(card.macros.protein)),
      carbs: Math.max(0, round(card.macros.carbs)),
      fat: Math.max(0, round(card.macros.fat)),
    },
  };
}

export async function suggestRecipes(ctx: RecipeContext): Promise<SuggestResult> {
  const result = await structured(SuggestResult, "recipe_suggestions", suggestPrompt(ctx));
  const all = [...result.makeNow, ...result.quickShop].map(normalizeCard);
  // Re-bucket in case the model put a recipe that needs shopping into "make now".
  return {
    chefNote: result.chefNote,
    makeNow: all.filter((c) => c.missingIngredients.length === 0),
    quickShop: all.filter((c) => c.missingIngredients.length > 0),
  };
}

export async function generateDetails(card: RecipeCard, ctx: RecipeContext): Promise<RecipeDetails> {
  const details = await structured(RecipeDetails, "recipe_details", detailsPrompt(card, ctx));
  return {
    ...details,
    steps: details.steps.map((s) => ({
      ...s,
      timerSeconds: s.timerSeconds && s.timerSeconds > 0 ? round(s.timerSeconds) : null,
    })),
  };
}
