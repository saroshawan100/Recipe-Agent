import type { RecipeCard, RecipeDetails, SuggestRequest } from "../src/schemas/recipe.js";

/**
 * Fixed, hand-written inputs so coach/check-in/ask evals don't depend on whatever
 * /details happened to generate. Validated against the real schemas by `--dry`.
 */

export const STAPLES = ["salt", "black pepper", "olive oil", "water"];

/** Request body for /ai/suggest and the `context` of /ai/details. Fills in schema defaults. */
export function context(overrides: {
  ingredients: SuggestRequest["ingredients"];
  staples?: string[];
  preferences?: Partial<SuggestRequest["preferences"]>;
}): SuggestRequest {
  return {
    ingredients: overrides.ingredients,
    staples: overrides.staples ?? STAPLES,
    preferences: {
      diets: [],
      allergies: [],
      cuisines: [],
      maxMinutes: null,
      skill: "beginner",
      servings: 2,
      calorieTarget: null,
      proteinTarget: null,
      equipment: [],
      mode: "quickShop",
      maxExtras: 3,
      notes: "",
      ...overrides.preferences,
    },
  };
}

export const CHICKEN_PANTRY = [
  { name: "Chicken Thighs" },
  { name: "Garlic", useSoon: true },
  { name: "Lemon" },
  { name: "Potatoes" },
  { name: "Rosemary" },
];

export const CHICKEN_CARD: RecipeCard = {
  title: "Pan-Seared Lemon Garlic Chicken Thighs",
  emoji: "🍗",
  description: "Crispy-skinned chicken thighs finished with a bright lemon, garlic and rosemary pan sauce.",
  cuisine: "Mediterranean",
  totalMinutes: 35,
  difficulty: "easy",
  servings: 2,
  matchPercent: 100,
  usedIngredients: ["Chicken Thighs", "Garlic", "Lemon", "Rosemary"],
  missingIngredients: [],
  macros: { calories: 480, protein: 38, carbs: 4, fat: 34 },
  tags: ["one-pan", "high-protein"],
};

export const CHICKEN_DETAILS: RecipeDetails = {
  intro: "Crispy chicken thighs with a quick pan sauce. You'll learn how to render skin until it's crackly and build a sauce from the browned bits.",
  servings: 2,
  prepMinutes: 10,
  cookMinutes: 25,
  ingredients: [
    { name: "bone-in, skin-on chicken thighs", amount: 4, unit: null, preparation: "patted dry", have: true, optional: false, aisle: "Meat & Seafood" },
    { name: "garlic", amount: 4, unit: "clove", preparation: "minced", have: true, optional: false, aisle: "Produce" },
    { name: "lemon", amount: 1, unit: null, preparation: "zested and juiced", have: true, optional: false, aisle: "Produce" },
    { name: "fresh rosemary", amount: 1, unit: "tbsp", preparation: "finely chopped", have: true, optional: false, aisle: "Produce" },
    { name: "olive oil", amount: 1, unit: "tbsp", preparation: null, have: true, optional: false, aisle: "Pantry" },
    { name: "water", amount: 0.25, unit: "cup", preparation: null, have: true, optional: false, aisle: "Other" },
    { name: "salt", amount: 1, unit: "tsp", preparation: null, have: true, optional: false, aisle: "Spices & Seasonings" },
    { name: "black pepper", amount: null, unit: null, preparation: null, have: true, optional: false, aisle: "Spices & Seasonings" },
  ],
  equipment: ["12-inch skillet", "tongs", "instant-read thermometer", "cutting board", "chef's knife"],
  steps: [
    {
      title: "Dry and season the chicken",
      instruction: "Pat the chicken thighs very dry with paper towels, then season both sides with the salt and pepper. Wash your hands after handling raw chicken.",
      tip: "Dry skin is the secret to crispy skin.",
      timerSeconds: null,
      donenessCue: null,
      phase: "prep",
    },
    {
      title: "Prep the aromatics",
      instruction: "Mince the garlic, finely chop the rosemary, then zest and juice the lemon into a small bowl.",
      tip: "Curl your fingertips under on the hand holding the food.",
      timerSeconds: null,
      donenessCue: null,
      phase: "prep",
    },
    {
      title: "Preheat the skillet",
      instruction: "Add the olive oil to a 12-inch skillet over medium-high heat and heat until the oil shimmers.",
      tip: null,
      timerSeconds: 150,
      donenessCue: "The oil shimmers and flows easily when you tilt the pan.",
      phase: "cook",
    },
    {
      title: "Sear skin-side down",
      instruction: "Lay the thighs in the pan skin-side down, lower to medium, and cook without moving them until the skin is deep golden and releases easily, about 8 minutes.",
      tip: "Don't move them: the skin releases on its own when it's ready.",
      timerSeconds: 480,
      donenessCue: "Deep golden, crisp skin that lifts away from the pan without sticking.",
      phase: "cook",
    },
    {
      title: "Flip and cook through",
      instruction: "Flip the thighs and cook until the thickest part reaches 165°F (74°C) on an instant-read thermometer, 6 to 8 minutes.",
      tip: "Check the thickest part without touching the bone.",
      timerSeconds: 420,
      donenessCue: "Juices run clear and the thermometer reads 165°F (74°C).",
      phase: "cook",
    },
    {
      title: "Make the pan sauce",
      instruction: "Move the chicken to a plate. Pour off all but 1 tbsp of fat, add the garlic and rosemary and stir for 30 seconds, then add the water and lemon juice and scrape up the browned bits for 1 minute.",
      tip: "Garlic burns fast; keep it moving.",
      timerSeconds: 90,
      donenessCue: "The sauce is slightly reduced and smells bright and garlicky.",
      phase: "cook",
    },
    {
      title: "Rest and serve",
      instruction: "Let the chicken rest for 5 minutes, then spoon the sauce over and finish with lemon zest.",
      tip: null,
      timerSeconds: 300,
      donenessCue: null,
      phase: "finish",
    },
  ],
  glossary: [
    { term: "sear", definition: "Cook over high heat to brown the surface." },
    { term: "mince", definition: "Chop into very small pieces." },
    { term: "zest", definition: "The colored outer peel of citrus, grated finely." },
  ],
  substitutions: [{ ingredient: "fresh rosemary", swap: "1 tsp dried rosemary", note: "Crumble it between your fingers." }],
  safetyNotes: ["Cook chicken to 165°F (74°C).", "Wash hands and boards after touching raw chicken."],
  storage: "Refrigerate leftovers in an airtight container for up to 3 days.",
  servingSuggestion: "Serve with roasted potatoes or a green salad.",
  nutrition: { calories: 480, protein: 38, carbs: 4, fat: 34, fiber: 0, sugar: 1, sodiumMg: 720 },
};

export const POTATO_DETAILS: RecipeDetails = {
  intro: "Crispy oven-roasted potatoes with rosemary. You'll learn how spacing and high heat make crisp edges.",
  servings: 2,
  prepMinutes: 10,
  cookMinutes: 35,
  ingredients: [
    { name: "potatoes", amount: 1.5, unit: "lb", preparation: "cut into 1-inch chunks", have: true, optional: false, aisle: "Produce" },
    { name: "olive oil", amount: 2, unit: "tbsp", preparation: null, have: true, optional: false, aisle: "Pantry" },
    { name: "fresh rosemary", amount: 1, unit: "tbsp", preparation: "chopped", have: true, optional: false, aisle: "Produce" },
    { name: "salt", amount: 1, unit: "tsp", preparation: null, have: true, optional: false, aisle: "Spices & Seasonings" },
  ],
  equipment: ["oven", "rimmed baking sheet", "large bowl", "spatula"],
  steps: [
    {
      title: "Preheat the oven",
      instruction: "Heat the oven to 425°F (220°C) with a rack in the middle.",
      tip: null,
      timerSeconds: 720,
      donenessCue: "The oven's preheat indicator turns off.",
      phase: "prep",
    },
    {
      title: "Cut and toss the potatoes",
      instruction: "Cut the potatoes into 1-inch chunks, then toss with the olive oil, rosemary and salt in a large bowl.",
      tip: "Similar-sized pieces cook evenly.",
      timerSeconds: null,
      donenessCue: null,
      phase: "prep",
    },
    {
      title: "Roast the potatoes",
      instruction: "Spread the potatoes in a single layer on the baking sheet and roast for 30 to 35 minutes, flipping once halfway, until deep golden and fork-tender.",
      tip: "Don't crowd the pan, or they'll steam instead of crisp.",
      timerSeconds: 1950,
      donenessCue: "Golden, crisp edges and a fork slides in easily.",
      phase: "cook",
    },
    {
      title: "Season and serve",
      instruction: "Taste, sprinkle with a little more salt if needed, and serve hot.",
      tip: null,
      timerSeconds: null,
      donenessCue: null,
      phase: "finish",
    },
  ],
  glossary: [{ term: "roast", definition: "Cook with dry heat in the oven." }],
  substitutions: [],
  safetyNotes: ["Use oven mitts: the baking sheet will be very hot."],
  storage: "Refrigerate for up to 4 days; reheat in a hot oven to re-crisp.",
  servingSuggestion: "Great next to roast chicken.",
  nutrition: { calories: 330, protein: 6, carbs: 52, fat: 14, fiber: 6, sugar: 2, sodiumMg: 590 },
};

/** Step indexes used by the coach/check-in/ask cases. */
export const STEP = { chickenKnife: 1, chickenPreheat: 2, chickenSear: 3, chickenCookThrough: 4, chickenSauce: 5, chickenServe: 6, potatoRoast: 2 } as const;
