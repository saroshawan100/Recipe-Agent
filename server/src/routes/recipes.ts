import { Router } from "express";
import { z } from "zod";
import { ensureDetails, findRecipe } from "../lib/recipes.js";
import { aiLimiter } from "../middleware/rateLimit.js";
import { RecipeFeedback } from "../models/RecipeFeedback.js";
import { Recipe, toRecipeDto, toRecipeSummary, type RecipeGroup } from "../models/Recipe.js";
import { SuggestRequest } from "../schemas/recipe.js";
import { getOrCreateRecipeImage } from "../services/imageService.js";
import { suggestRecipes } from "../services/openaiService.js";
import { getTasteProfile, tagSnapshotForCard } from "../services/tasteProfileService.js";

export const recipesRouter = Router();

recipesRouter.post("/suggest", aiLimiter, async (req, res) => {
  const input = SuggestRequest.parse(req.body);
  const ctx = { ...input, tasteProfile: await getTasteProfile(req.clientId) };
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

const RecipeFeedbackInput = z.object({
  tried: z.boolean(),
  rating: z.enum(["liked", "notForMe"]).nullable(),
});

recipesRouter.get("/:id/feedback", async (req, res) => {
  const recipe = await findRecipe(req.clientId, String(req.params.id));
  const feedback = await RecipeFeedback.findOne({ clientId: req.clientId, recipeId: recipe.id }).lean();
  res.json({
    tried: feedback?.tried ?? false,
    rating: feedback?.rating ?? null,
    updatedAt: feedback?.updatedAt?.toISOString() ?? null,
  });
});

recipesRouter.put("/:id/feedback", async (req, res) => {
  const input = RecipeFeedbackInput.parse(req.body);
  const recipe = await findRecipe(req.clientId, String(req.params.id));
  const feedback = await RecipeFeedback.findOneAndUpdate(
    { clientId: req.clientId, recipeId: recipe.id },
    {
      $set: {
        recipeTitle: recipe.card.title,
        tried: input.tried,
        rating: input.rating,
        tagSnapshot: tagSnapshotForCard(recipe.card),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  res.json({ tried: feedback.tried, rating: feedback.rating, updatedAt: feedback.updatedAt.toISOString() });
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
