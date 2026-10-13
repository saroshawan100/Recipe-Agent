import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { notFound } from "../lib/httpError.js";
import { findRecipe } from "../lib/recipes.js";
import { ShoppingList, type ShoppingItem, type ShoppingQuantity } from "../models/ShoppingList.js";
import { AISLES } from "../schemas/recipe.js";

export const shoppingListRouter = Router();

interface IncomingItem {
  name: string;
  aisle: string;
  quantity: ShoppingQuantity | null;
  recipe: { id: string; title: string } | null;
}

const normalizeName = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/(es|s)$/, "");

const normalizeUnit = (unit: string | null) => (unit ?? "").toLowerCase().replace(/\.$/, "").replace(/s$/, "");

function mergeQuantity(quantities: ShoppingQuantity[], q: ShoppingQuantity | null) {
  if (!q || (q.amount === null && !q.unit)) return;
  const match = quantities.find((existing) => normalizeUnit(existing.unit) === normalizeUnit(q.unit));
  if (match && match.amount !== null && q.amount !== null) {
    match.amount = Math.round((match.amount + q.amount) * 100) / 100;
  } else if (!match) {
    quantities.push({ amount: q.amount, unit: q.unit });
  }
}

function mergeItems(items: ShoppingItem[], incoming: IncomingItem[]) {
  for (const inc of incoming) {
    const key = normalizeName(inc.name);
    let item = items.find((i) => normalizeName(i.name) === key);
    if (!item) {
      items.push({
        id: randomUUID(),
        name: inc.name,
        aisle: (AISLES as readonly string[]).includes(inc.aisle) ? inc.aisle : "Other",
        quantities: [],
        checked: false,
        recipes: [],
        addedAt: new Date(),
      });
      // Mongoose casts pushed objects into new subdocuments, so mutate the stored copy.
      item = items[items.length - 1];
    } else {
      item.checked = false;
    }
    mergeQuantity(item.quantities, inc.quantity);
    if (inc.recipe && !item.recipes.some((r) => r.id === inc.recipe!.id)) item.recipes.push(inc.recipe);
  }
}

async function getList(clientId: string) {
  return (await ShoppingList.findOne({ clientId })) ?? new ShoppingList({ clientId, items: [] });
}

shoppingListRouter.get("/", async (req, res) => {
  const list = await ShoppingList.findOne({ clientId: req.clientId }).lean();
  res.json({ items: list?.items ?? [] });
});

shoppingListRouter.post("/from-recipe", async (req, res) => {
  const { recipeId, scale } = z
    .object({ recipeId: z.string(), scale: z.number().min(0.1).max(20).default(1) })
    .parse(req.body);
  const recipe = await findRecipe(req.clientId, recipeId);
  const ref = { id: recipe.id as string, title: recipe.card.title };

  const incoming: IncomingItem[] = recipe.details
    ? recipe.details.ingredients
        .filter((i) => !i.have && !i.optional)
        .map((i) => ({
          name: i.name,
          aisle: i.aisle,
          quantity: { amount: i.amount !== null ? Math.round(i.amount * scale * 100) / 100 : null, unit: i.unit },
          recipe: ref,
        }))
    : recipe.card.missingIngredients.map((m) => ({ name: m.name, aisle: m.aisle, quantity: null, recipe: ref }));

  const list = await getList(req.clientId);
  mergeItems(list.items, incoming);
  list.markModified("items");
  await list.save();
  res.json({ items: list.items, added: incoming.length });
});

shoppingListRouter.post("/items", async (req, res) => {
  const body = z
    .object({
      name: z.string().trim().min(1).max(80),
      aisle: z.string().max(40).default("Other"),
      amount: z.number().min(0).max(10_000).nullable().default(null),
      unit: z.string().max(20).nullable().default(null),
    })
    .parse(req.body);
  const list = await getList(req.clientId);
  mergeItems(list.items, [
    { name: body.name, aisle: body.aisle, quantity: { amount: body.amount, unit: body.unit }, recipe: null },
  ]);
  list.markModified("items");
  await list.save();
  res.json({ items: list.items });
});

shoppingListRouter.patch("/items/:itemId", async (req, res) => {
  const patch = z
    .object({ checked: z.boolean().optional(), name: z.string().trim().min(1).max(80).optional() })
    .parse(req.body);
  const list = await getList(req.clientId);
  const item = list.items.find((i) => i.id === req.params.itemId);
  if (!item) throw notFound("Item");
  if (patch.checked !== undefined) item.checked = patch.checked;
  if (patch.name !== undefined) item.name = patch.name;
  list.markModified("items");
  await list.save();
  res.json({ items: list.items });
});

shoppingListRouter.delete("/items/:itemId", async (req, res) => {
  const list = await getList(req.clientId);
  list.items = list.items.filter((i) => i.id !== req.params.itemId);
  await list.save();
  res.json({ items: list.items });
});

shoppingListRouter.delete("/checked", async (req, res) => {
  const list = await getList(req.clientId);
  list.items = list.items.filter((i) => !i.checked);
  await list.save();
  res.json({ items: list.items });
});

shoppingListRouter.delete("/", async (req, res) => {
  const list = await getList(req.clientId);
  list.items = [];
  await list.save();
  res.json({ items: [] });
});
