import { RecipeDetails, type RecipeCard, type SuggestRequest } from "../../src/schemas/recipe.js";
import { CHICKEN_CARD, CHICKEN_PANTRY, context } from "../fixtures.js";
import { LEX, allText, check, tokens, defineCase, fahrenheitWithoutCelsius, findForbidden, inPantry, warn, type CheckResult, type Lexicon } from "../lib.js";

const METRIC_UNITS = /^(?:g|grams?|kg|kilograms?|ml|milliliters?|millilitres?|l|liters?|litres?|cl|dl)$/i;

/** Checks every full recipe gets, regardless of the dish. */
function baseChecks(d: RecipeDetails, card: RecipeCard, ctx: SuggestRequest): CheckResult[] {
  const text = allText(d);
  const have = [...ctx.ingredients.map((i) => i.name), ...ctx.staples];
  const phases = d.steps.map((s) => ["prep", "cook", "finish"].indexOf(s.phase));
  const heatSteps = d.steps.filter((s) => s.phase === "cook");
  const metric = d.ingredients.filter((i) => i.unit && METRIC_UNITS.test(i.unit.trim()));
  const wrongHave = d.ingredients.filter((i) => i.have && !inPantry(i.name, have));
  const missingMarkedHave = card.missingIngredients.filter((m) => d.ingredients.some((i) => i.have && i.name.toLowerCase().includes(m.name.toLowerCase())));
  const stepWords = new Set(tokens(allText(d.steps)));
  const glossaryUnused = d.glossary.filter((g) => !tokens(g.term).some((w) => stepWords.has(w) || [...stepWords].some((s) => s.startsWith(w.slice(0, 5)))));
  const stepText = d.steps.map((s) => s.title.toLowerCase().trim());
  return [
    check(`servings = ${ctx.preferences.servings}`, d.servings === ctx.preferences.servings, `got ${d.servings}`),
    warn("6-14 steps", d.steps.length >= 6 && d.steps.length <= 14, `got ${d.steps.length}`),
    check("no repeated step titles", new Set(stepText).size === stepText.length),
    check("US customary units only", metric.length === 0, metric.map((i) => `${i.amount} ${i.unit} ${i.name}`).join("; ")),
    check("every °F has (°C) right after it", fahrenheitWithoutCelsius(text).length === 0, fahrenheitWithoutCelsius(text).join("; ")),
    check("glossary is not empty", d.glossary.length > 0),
    check("has safety notes", d.safetyNotes.length > 0),
    check("nutrition is plausible (100-1500 kcal/serving)", d.nutrition.calories >= 100 && d.nutrition.calories <= 1500, `${d.nutrition.calories} kcal`),
    check("timers are positive or null", d.steps.every((s) => s.timerSeconds === null || s.timerSeconds > 0)),
    check("ingredients the card says to buy are have=false", missingMarkedHave.length === 0, missingMarkedHave.map((m) => m.name).join(", ")),
    warn("phases run prep -> cook -> finish", phases.every((p, i) => i === 0 || p >= phases[i - 1]), d.steps.map((s) => s.phase).join(" > ")),
    warn("most cook steps have a timer and doneness cue", heatSteps.filter((s) => s.timerSeconds && s.donenessCue).length >= heatSteps.length * 0.8),
    warn("have=true only for pantry/staple items", wrongHave.length === 0, wrongHave.map((i) => i.name).join(", ")),
    warn("glossary terms appear in the steps", glossaryUnused.length === 0, glossaryUnused.map((g) => g.term).join(", ")),
  ];
}

function forbiddenIn(d: RecipeDetails, lex: Lexicon, label: string): CheckResult {
  // Substitution "swaps" and ingredient names are where allergens sneak in; notes/safety text may name the allergen to warn about it.
  const scanned = [...d.ingredients.map((i) => `${i.name} ${i.preparation ?? ""}`), ...d.substitutions.map((s) => s.swap), ...d.steps.map((s) => `${s.title}. ${s.instruction} ${s.tip ?? ""}`)];
  const hits = [...new Set(scanned.flatMap((t) => findForbidden(t, lex)))];
  return check(`no ${label} in ingredients, swaps or steps`, hits.length === 0, hits.join(", "));
}

function detailsCase(opts: { id: string; description: string; card: RecipeCard; ctx: SuggestRequest; checks?: (d: RecipeDetails) => CheckResult[]; rubric?: string }) {
  return defineCase<RecipeDetails>({
    id: `details/${opts.id}`,
    stage: "details",
    description: opts.description,
    schema: RecipeDetails,
    run: (api) => api.post("/ai/details", { card: opts.card, context: opts.ctx }),
    checks: (d) => [...baseChecks(d, opts.card, opts.ctx), ...(opts.checks?.(d) ?? [])],
    rubric: opts.rubric,
    judgeInput: `Card:\n${JSON.stringify(opts.card, null, 2)}\n\nPreferences:\n${JSON.stringify(opts.ctx.preferences, null, 2)}\nPantry: ${opts.ctx.ingredients.map((i) => i.name).join(", ")}; staples: ${opts.ctx.staples.join(", ")}`,
  });
}

const card = (c: Partial<RecipeCard> & Pick<RecipeCard, "title" | "description" | "cuisine">): RecipeCard => ({
  emoji: "🍽️",
  totalMinutes: 30,
  difficulty: "easy",
  servings: 2,
  matchPercent: 80,
  usedIngredients: [],
  missingIngredients: [],
  macros: { calories: 500, protein: 25, carbs: 50, fat: 20 },
  tags: ["weeknight"],
  ...c,
});

export const detailsCases = [
  detailsCase({
    id: "chicken-beginner",
    description: "Make-now chicken thighs for a beginner: safety temp, technique, honesty about the pantry",
    card: CHICKEN_CARD,
    ctx: context({ ingredients: CHICKEN_PANTRY }),
    checks: (d) => {
      const text = allText(d);
      const unowned = d.ingredients.filter((i) => !i.optional && !i.have);
      return [
        check("states poultry is safe at 165°F (74°C)", /165\s*°\s*f/.test(text)),
        check("uses a thermometer or clear doneness cue for the chicken", /thermometer|juices run clear/.test(text)),
        check("make-now recipe needs nothing to buy", unowned.length === 0, unowned.map((i) => i.name).join(", ")),
      ];
    },
    rubric: `MUST: a beginner could follow it: each step explains HOW (heat level, pan, technique) and what doneness looks like.
MUST: chicken is cooked to 165°F (74°C) and raw-chicken hygiene is mentioned.
MUST: uses only the pantry items and staples (this is a make-now recipe).
SHOULD: steps are in an efficient order with no duplicated actions; the glossary explains every technique term.`,
  }),

  detailsCase({
    id: "allergy-peanut-pad-thai",
    description: "Pad Thai card for a cook with a peanut allergy: the classic garnish must go",
    card: card({ title: "Chicken Pad Thai", description: "Sweet, tangy rice noodles with chicken, egg and lime.", cuisine: "Thai", usedIngredients: ["Rice Noodles", "Chicken Breast", "Eggs", "Lime"], missingIngredients: [{ name: "Bean Sprouts", aisle: "Produce" }] }),
    ctx: context({ ingredients: [{ name: "Rice Noodles" }, { name: "Chicken Breast" }, { name: "Eggs" }, { name: "Lime" }, { name: "Soy Sauce" }], preferences: { allergies: ["Peanuts"] } }),
    checks: (d) => [forbiddenIn(d, LEX.peanut, "peanuts (even optional garnish)")],
    rubric: "MUST: no peanuts or peanut products anywhere, including garnish, optional items and substitutions. SHOULD: offers a safe crunchy alternative (e.g. toasted seeds, if no seed allergy) or simply omits it.",
  }),

  detailsCase({
    id: "diet-vegan-curry",
    description: "Vegan chickpea curry: no ghee, yogurt, butter or honey",
    card: card({ title: "Chickpea Coconut Curry", description: "Creamy, warming chickpea curry with coconut milk and spinach.", cuisine: "Indian", usedIngredients: ["Chickpeas", "Coconut Milk", "Spinach", "Onion"] }),
    ctx: context({ ingredients: [{ name: "Chickpeas" }, { name: "Coconut Milk" }, { name: "Spinach" }, { name: "Onion" }, { name: "Curry Powder" }], preferences: { diets: ["Vegan"] } }),
    checks: (d) => [forbiddenIn(d, LEX.animal, "animal products")],
  }),

  detailsCase({
    id: "allergy-tree-nut-substitutions",
    description: "Tree-nut allergy: substitutions must not suggest nuts",
    card: card({ title: "Pesto Pasta with Peas", description: "Bright basil pesto tossed with pasta and sweet peas.", cuisine: "Italian", usedIngredients: ["Pasta", "Basil", "Parmesan", "Frozen Peas"] }),
    ctx: context({ ingredients: [{ name: "Pasta" }, { name: "Basil" }, { name: "Parmesan" }, { name: "Frozen Peas" }, { name: "Garlic" }], preferences: { allergies: ["Tree nuts"] } }),
    checks: (d) => [forbiddenIn(d, LEX.treeNut, "tree nuts (pine nuts, walnuts, almonds...)")],
  }),

  detailsCase({
    id: "scaling-6-servings",
    description: "Quantities scaled for 6 servings",
    card: { ...CHICKEN_CARD, servings: 6 },
    ctx: context({ ingredients: CHICKEN_PANTRY, preferences: { servings: 6 } }),
    checks: (d) => {
      const chicken = d.ingredients.find((i) => /chicken/i.test(i.name));
      return [warn("uses at least 6 thighs or ~2.5 lb of chicken", !!chicken && ((!chicken.unit?.trim() && (chicken.amount ?? 0) >= 6) || (/lb|pound/i.test(chicken.unit ?? "") && (chicken.amount ?? 0) >= 2.5)), chicken ? `${chicken.amount} ${chicken.unit ?? ""}` : "no chicken")];
    },
  }),

  detailsCase({
    id: "oven-preheat-first",
    description: "Oven recipe: preheat comes first, temperatures in °F (°C)",
    card: card({ title: "Rosemary Roasted Potatoes", description: "Crispy-edged roasted potatoes with rosemary and garlic.", cuisine: "American", totalMinutes: 45, usedIngredients: ["Potatoes", "Rosemary", "Garlic"] }),
    ctx: context({ ingredients: [{ name: "Potatoes" }, { name: "Rosemary" }, { name: "Garlic" }] }),
    checks: (d) => [
      check("first step preheats the oven", /preheat|heat the oven/i.test(`${d.steps[0]?.title} ${d.steps[0]?.instruction}`), d.steps[0]?.title),
      check("gives an oven temperature in °F", /\d{3}\s*°\s*f/i.test(allText(d.steps))),
    ],
  }),
];
