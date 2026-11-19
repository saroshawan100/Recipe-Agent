import type { RecipeCard, TasteProfile } from "../schemas/recipe.js";
import { RecipeFeedback, type RecipeFeedbackDoc } from "../models/RecipeFeedback.js";
import { TasteProfileSettings } from "../models/TasteProfileSettings.js";

export type RecipeTagSnapshot = RecipeFeedbackDoc["tagSnapshot"];
export const MIN_TAG_RECIPES = 3;
export const MIN_FAVOR_SCORE = 0.25;
export const MAX_AVOID_SCORE = -0.5;

export function tagSnapshotForCard(card: RecipeCard): RecipeTagSnapshot {
  return {
    cuisine: card.cuisine,
    ingredients: [...new Set(card.usedIngredients.map((name) => name.trim()).filter(Boolean))],
    profileTags: card.profileTags ? { ...card.profileTags } : null,
    otherTags: [...new Set(card.tags.map((tag) => tag.trim()).filter(Boolean))],
  };
}

function labelsFromSnapshot(snapshot: RecipeTagSnapshot): string[] {
  const tags = new Set<string>();
  const add = (kind: string, value: unknown) => {
    if (typeof value !== "string" || !value.trim() || value === "none") return;
    tags.add(`${kind}: ${value.trim().replace(/-/g, " ")}`);
  };

  add("Cuisine", snapshot.cuisine);
  for (const ingredient of snapshot.ingredients) add("Ingredient", ingredient);
  for (const tag of snapshot.otherTags) add("Recipe style", tag);

  const profile = snapshot.profileTags;
  if (profile) {
    add("Protein", profile.mainProtein);
    for (const method of Array.isArray(profile.cookingMethods) ? profile.cookingMethods : []) add("Method", method);
    for (const flavor of Array.isArray(profile.flavorProfiles) ? profile.flavorProfiles : []) add("Flavor", flavor);
    add("Effort", profile.effort);
    add("Time", profile.timeBand);
    add("Cost", profile.costLevel);
    for (const style of Array.isArray(profile.nutritionStyles) ? profile.nutritionStyles : []) add("Nutrition", style);
  }
  return [...tags];
}

export function summarizeTasteProfile(
  feedback: Array<Pick<RecipeFeedbackDoc, "tried" | "rating" | "tagSnapshot">>,
): TasteProfile {
  const scores = new Map<string, { positive: number; negative: number; recipes: number }>();
  for (const entry of feedback) {
    if (!entry.rating) continue;
    const weight = entry.tried ? 2 : 1;
    const direction = entry.rating === "liked" ? 1 : -1;
    for (const tag of labelsFromSnapshot(entry.tagSnapshot)) {
      const signal = scores.get(tag) ?? { positive: 0, negative: 0, recipes: 0 };
      if (direction > 0) signal.positive += weight;
      else signal.negative += weight;
      signal.recipes += 1;
      scores.set(tag, signal);
    }
  }

  const format = (direction: 1 | -1) =>
    [...scores.entries()]
      .map(([tag, signal]) => ({ tag, score: (signal.positive - signal.negative) / (signal.positive + signal.negative), distinctRecipes: signal.recipes }))
      .filter((signal) =>
        signal.distinctRecipes >= MIN_TAG_RECIPES &&
        (direction === 1 ? signal.score >= MIN_FAVOR_SCORE : signal.score <= MAX_AVOID_SCORE),
      )
      .sort((a, b) => Math.abs(b.score) - Math.abs(a.score) || b.distinctRecipes - a.distinctRecipes)
      .slice(0, 20);

  return { likedTags: format(1), avoidedTags: format(-1), removedTags: [] };
}

export async function getTasteProfile(clientId: string): Promise<TasteProfile> {
  const [feedback, settings] = await Promise.all([
    RecipeFeedback.find({ clientId, rating: { $ne: null } }).select("tried rating tagSnapshot").lean(),
    TasteProfileSettings.findOne({ clientId }).select("removedTags").lean(),
  ]);
  const removedTags = settings?.removedTags ?? [];
  const removed = new Set(removedTags);
  const profile = summarizeTasteProfile(feedback);
  return {
    likedTags: profile.likedTags.filter((signal) => !removed.has(signal.tag)),
    avoidedTags: profile.avoidedTags.filter((signal) => !removed.has(signal.tag)),
    removedTags,
  };
}

export async function setTasteTagRemoved(clientId: string, tag: string, isRemoved: boolean): Promise<TasteProfile> {
  await TasteProfileSettings.findOneAndUpdate(
    { clientId },
    isRemoved ? { $addToSet: { removedTags: tag } } : { $pull: { removedTags: tag } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return getTasteProfile(clientId);
}
