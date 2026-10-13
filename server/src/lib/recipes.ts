import { isValidObjectId } from "mongoose";
import { Recipe, type RecipeDocument } from "../models/Recipe.js";
import type { RecipeDetails } from "../schemas/recipe.js";
import { generateDetails } from "../services/openaiService.js";
import { dedupe } from "./dedupe.js";
import { HttpError, notFound } from "./httpError.js";

export async function findRecipe(clientId: string, id: string): Promise<RecipeDocument> {
  if (!isValidObjectId(id)) throw notFound("Recipe");
  const recipe = await Recipe.findOne({ _id: id, clientId });
  if (!recipe) throw notFound("Recipe");
  return recipe;
}

export async function ensureDetails(recipe: RecipeDocument): Promise<RecipeDetails> {
  if (recipe.details) return recipe.details;
  const details = await dedupe(`details:${recipe.id}`, async () => {
    const generated = await generateDetails(recipe.card, recipe.context);
    const { calories, protein, carbs, fat } = generated.nutrition;
    const totalMinutes = generated.prepMinutes + generated.cookMinutes;
    await Recipe.updateOne(
      { _id: recipe._id },
      { $set: { details: generated, "card.macros": { calories, protein, carbs, fat }, "card.totalMinutes": totalMinutes } },
    );
    return generated;
  });
  recipe.details = details;
  const { calories, protein, carbs, fat } = details.nutrition;
  recipe.card = { ...recipe.card, macros: { calories, protein, carbs, fat }, totalMinutes: details.prepMinutes + details.cookMinutes };
  return details;
}

export async function requireDetails(recipe: RecipeDocument): Promise<RecipeDetails> {
  if (!recipe.details) throw new HttpError(409, "Open the recipe first so the chef can write the full instructions.");
  return recipe.details;
}
