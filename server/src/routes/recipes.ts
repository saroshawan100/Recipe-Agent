import { Router } from "express";
import { ensureDetails, findRecipe } from "../lib/recipes.js";
import { aiLimiter } from "../middleware/rateLimit.js";
import { Recipe, toRecipeDto, toRecipeSummary, type RecipeGroup } from "../models/Recipe.js";
import { SuggestRequest } from "../schemas/recipe.js";
import { getOrCreateRecipeImage } from "../services/imageService.js";
import { suggestRecipes } from "../services/openaiService.js";

export const recipesRouter = Router();

recipesRouter.post("/suggest", aiLimiter, async (req, res) => {
  const ctx = SuggestRequest.parse(req.body);
  const result = await suggestRecipes(ctx);

  const toDoc = (group: RecipeGroup) => (card: (typeof result.makeNow)[number]) => ({
    clientId: req.clientId,
    group,
    card,
    context: ctx,
  });
  const docs = await Recipe.insertMany([
    ...result.makeNow.map(toDoc("makeNow")),
    ...result.quickShop.map(toDoc("quickShop")),
  ]);
  const summaries = docs.map(toRecipeSummary);

  res.json({
    chefNote: result.chefNote,
    makeNow: summaries.filter((r) => r.group === "makeNow"),
    quickShop: summaries.filter((r) => r.group === "quickShop"),
  });
});

recipesRouter.get("/:id", async (req, res) => {
  const recipe = await findRecipe(req.clientId, req.params.id);
  res.json(toRecipeDto(recipe));
});

recipesRouter.post("/:id/details", aiLimiter, async (req, res) => {
  const recipe = await findRecipe(req.clientId, String(req.params.id));
  await ensureDetails(recipe);
  res.json(toRecipeDto(recipe));
});

recipesRouter.post("/:id/image", aiLimiter, async (req, res) => {
  const recipe = await findRecipe(req.clientId, String(req.params.id));
  const imageUrl = await getOrCreateRecipeImage(recipe);
  res.json({ imageUrl });
});
