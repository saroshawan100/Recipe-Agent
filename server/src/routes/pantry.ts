import { Router } from "express";
import { z } from "zod";
import { Pantry } from "../models/Pantry.js";
import { PantryItemInput } from "../schemas/recipe.js";

export const pantryRouter = Router();

const PantryBody = z.object({
  items: z.array(PantryItemInput).max(200),
  staples: z.array(z.string().trim().min(1).max(60)).max(40).default([]),
});

pantryRouter.get("/", async (req, res) => {
  const pantry = await Pantry.findOne({ clientId: req.clientId }).lean();
  res.json({ items: pantry?.items ?? [], staples: pantry?.staples ?? [] });
});

pantryRouter.put("/", async (req, res) => {
  const body = PantryBody.parse(req.body);
  const pantry = await Pantry.findOneAndUpdate(
    { clientId: req.clientId },
    { $set: { items: body.items, staples: body.staples } },
    { upsert: true, new: true, lean: true },
  );
  res.json({ items: pantry?.items ?? [], staples: pantry?.staples ?? [] });
});
