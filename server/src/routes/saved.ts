import { Router } from "express";
import { findRecipe } from "../lib/recipes.js";
import { Recipe, toRecipeSummary } from "../models/Recipe.js";

export const savedRouter = Router();

savedRouter.get("/", async (req, res) => {
  const docs = await Recipe.find({ clientId: req.clientId, saved: true }).sort({ savedAt: -1 }).limit(200);
  res.json(docs.map(toRecipeSummary));
});

savedRouter.post("/:id", async (req, res) => {
  const recipe = await findRecipe(req.clientId, req.params.id);
  recipe.saved = true;
  recipe.savedAt = new Date();
  await recipe.save();
  res.json({ id: recipe.id, saved: true });
});

savedRouter.delete("/:id", async (req, res) => {
  const recipe = await findRecipe(req.clientId, req.params.id);
  recipe.saved = false;
  recipe.savedAt = null;
  await recipe.save();
  res.json({ id: recipe.id, saved: false });
});
