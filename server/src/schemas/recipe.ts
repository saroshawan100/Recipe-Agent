import { z } from "zod";

// ---------- AI output schemas (OpenAI structured outputs: no optional fields, use nullable) ----------

export const AISLES = [
  "Produce",
  "Meat & Seafood",
  "Dairy & Eggs",
  "Bakery",
  "Pantry",
  "Spices & Seasonings",
  "Condiments & Sauces",
  "Frozen",
  "Other",
] as const;
export const Aisle = z.enum(AISLES);

export const Difficulty = z.enum(["easy", "medium", "hard"]);

export const Macros = z.object({
  calories: z.number().describe("kcal per serving"),
  protein: z.number().describe("grams per serving"),
  carbs: z.number().describe("grams per serving"),
  fat: z.number().describe("grams per serving"),
});

export const RecipeCard = z.object({
  title: z.string(),
  emoji: z.string().describe("A single emoji that best represents the finished dish"),
  description: z.string().describe("One or two appetizing sentences"),
  cuisine: z.string(),
  totalMinutes: z.number(),
  difficulty: Difficulty,
  servings: z.number(),
  matchPercent: z.number().describe("0-100: share of non-staple ingredients the cook already has"),
  usedIngredients: z.array(z.string()).describe("Pantry ingredients this recipe uses"),
  missingIngredients: z
    .array(z.object({ name: z.string(), aisle: Aisle }))
    .describe("Ingredients the cook must buy. Empty for make-now recipes."),
  macros: Macros,
  tags: z.array(z.string()).describe("2-4 short tags like 'one-pan', 'high-protein', 'kid-friendly'"),
});
export type RecipeCard = z.infer<typeof RecipeCard>;

export const SuggestResult = z.object({
  chefNote: z.string().describe("One or two friendly sentences about what the pantry is great for"),
  makeNow: z.array(RecipeCard),
  quickShop: z.array(RecipeCard),
});
export type SuggestResult = z.infer<typeof SuggestResult>;

export const RecipeIngredient = z.object({
  name: z.string(),
  amount: z.number().nullable().describe("Numeric amount for the stated servings, null for 'to taste'"),
  unit: z.string().nullable().describe("US customary unit like cup, tbsp, tsp, oz, lb, clove, or null for count items"),
  preparation: z.string().nullable().describe("e.g. 'diced', 'minced', 'room temperature'"),
  have: z.boolean().describe("true if it is in the cook's pantry or staples"),
  optional: z.boolean(),
  aisle: Aisle,
});

export const RecipeStep = z.object({
  title: z.string().describe("Short action title, e.g. 'Brown the beef'"),
  instruction: z.string(),
  tip: z.string().nullable().describe("A beginner tip for this step"),
  timerSeconds: z.number().nullable().describe("Active timer for the step if it involves waiting/cooking"),
  donenessCue: z.string().nullable().describe("What it looks/sounds/smells like when done"),
  phase: z.enum(["prep", "cook", "finish"]),
});

export const Nutrition = z.object({
  calories: z.number(),
  protein: z.number(),
  carbs: z.number(),
  fat: z.number(),
  fiber: z.number(),
  sugar: z.number(),
  sodiumMg: z.number(),
});

export const RecipeDetails = z.object({
  intro: z.string().describe("2-3 sentences: what makes this dish great and what the cook will learn"),
  servings: z.number(),
  prepMinutes: z.number(),
  cookMinutes: z.number(),
  ingredients: z.array(RecipeIngredient),
  equipment: z.array(z.string()),
  steps: z.array(RecipeStep),
  glossary: z
    .array(z.object({ term: z.string(), definition: z.string() }))
    .describe("Every cooking technique term used in the steps, explained for a beginner"),
  substitutions: z.array(z.object({ ingredient: z.string(), swap: z.string(), note: z.string() })),
  safetyNotes: z.array(z.string()),
  storage: z.string(),
  servingSuggestion: z.string(),
  nutrition: Nutrition.describe("Per serving estimates"),
});
export type RecipeDetails = z.infer<typeof RecipeDetails>;

// ---------- Request schemas ----------

export const PantryItemInput = z.object({
  name: z.string().trim().min(1).max(80),
  category: z.string().max(40).optional(),
  quantity: z.string().max(40).optional(),
  useSoon: z.boolean().optional(),
});
export type PantryItemInput = z.infer<typeof PantryItemInput>;

export const Preferences = z.object({
  diets: z.array(z.string().max(40)).max(10).default([]),
  allergies: z.array(z.string().max(40)).max(20).default([]),
  cuisines: z.array(z.string().max(40)).max(10).default([]),
  maxMinutes: z.number().int().min(5).max(480).nullable().default(null),
  skill: z.enum(["beginner", "intermediate", "advanced"]).default("beginner"),
  servings: z.number().int().min(1).max(12).default(2),
  calorieTarget: z.number().int().min(100).max(3000).nullable().default(null),
  proteinTarget: z.number().int().min(5).max(300).nullable().default(null),
  equipment: z.array(z.string().max(40)).max(15).default([]),
  mode: z.enum(["haveOnly", "quickShop"]).default("quickShop"),
  maxExtras: z.number().int().min(1).max(10).default(4),
  notes: z.string().max(500).default(""),
});
export type Preferences = z.infer<typeof Preferences>;

export const SuggestRequest = z.object({
  ingredients: z.array(PantryItemInput).min(1, "Add at least one ingredient").max(100),
  staples: z.array(z.string().trim().max(60)).max(40).default([]),
  preferences: Preferences.default({}),
});
export type SuggestRequest = z.infer<typeof SuggestRequest>;
