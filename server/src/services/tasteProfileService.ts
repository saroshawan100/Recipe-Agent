import type { RecipeCard, TasteProfile } from "../schemas/recipe.js";
import { RecipeFeedback, type RecipeFeedbackDoc } from "../models/RecipeFeedback.js";

export type RecipeTagSnapshot = RecipeFeedbackDoc["tagSnapshot"];

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
  const scores = new Map<string, number>();
  for (const entry of feedback) {
    if (!entry.rating) continue;
    const weight = entry.tried ? 2 : 1;
    const direction = entry.rating === "liked" ? 1 : -1;
    for (const tag of labelsFromSnapshot(entry.tagSnapshot)) {
      scores.set(tag, (scores.get(tag) ?? 0) + direction * weight);
    }
  }

  const format = (direction: 1 | -1) =>
    [...scores.entries()]
      .filter(([, score]) => Math.sign(score) === direction)
      .sort((a, b) => direction === 1 ? b[1] - a[1] : a[1] - b[1])
      .slice(0, 20)
      .map(([tag, score]) => `${tag} (signal ${Math.abs(score)})`);

  return { likedTags: format(1), avoidedTags: format(-1) };
}

export async function getTasteProfile(clientId: string): Promise<TasteProfile> {
  const feedback = await RecipeFeedback.find({ clientId, rating: { $ne: null } })
    .select("tried rating tagSnapshot")
    .lean();
  return summarizeTasteProfile(feedback);
}
