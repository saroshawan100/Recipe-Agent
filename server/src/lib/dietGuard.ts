import type { Preferences, RecipeCard } from "../schemas/recipe.js";

/**
 * Last line of defense for suggestions: the model sometimes ignores allergies, diets and limits
 * (especially for "quick shop" ideas), so cards that break them are dropped before reaching the cook.
 * Matching is deliberately broad: dropping a safe card costs a suggestion, keeping an unsafe one is a safety bug.
 */

interface Rule {
  terms: RegExp;
  /** Safe phrases removed before matching, e.g. "peanut-free", "coconut milk". */
  allow?: RegExp;
}

const NUTS = "almond|cashew|walnut|pecan|hazelnut|pistachio|macadamia|pine nut|brazil nut|praline|marzipan|nutella";
const SHELLFISH = "shrimp|prawn|crab|lobster|scallop|clam|mussel|oyster|crawfish|crayfish|shellfish|langoustine";
const FISH = "fish|salmon|tuna|cod|tilapia|halibut|trout|sardine|anchov|mackerel|bonito|dashi|caesar";
const MEAT = "chicken|beef|pork|bacon|hams?\\b|lamb|turkey|duck|veal|sausage|chorizo|pepperoni|prosciutto|salami|steak|meatball|gelatin|lard|bone broth";
const DAIRY = "milk|butter|cheese|parmesan|mozzarella|feta|cheddar|ricotta|cream(?!y)|yogh?urt|ghee|paneer|queso|alfredo|custard|whey";
const GLUTEN = "wheat|flour|pasta|spaghetti|penne|macaroni|lasagna|noodle|bread|buns?\\b|couscous|barley|rye|soy sauce|teriyaki|hoisin|tortilla|panko|bulgur|seitan|pita|naan|crouton|cracker|beer|udon|ramen|dumpling|pancake|waffle";

const PLANT_DAIRY = /\b(?:coconut|almond|oat|soy|rice|cashew|plant[- ]based|vegan|non[- ]dairy|dairy[- ]free)\s+(?:milk|butter|cream|yogh?urt|cheese|mayo)\w*/g;
const NUT_BUTTERS = /\b(?:peanut|nut|almond|cashew|seed|sunflower|apple|cocoa|shea)\s+butter\b|\bbutter(?:nut| beans?| lettuce)\b|\bcream of tartar\b|\bcoconut cream\b/g;
const GLUTEN_FREE = /\bgluten[- ]free\s+(?:\w+\s+){0,2}\w+|\b(?:rice|almond|coconut|chickpea|corn|tapioca|potato|cassava|buckwheat)\s+(?:flour|noodles?|pasta|tortillas?|bread\w*|crackers?)\b|\b(?:glass|soba|cellophane) noodles?\b|\btamari\b|\bcornstarch\b/g;

const word = (alts: string) => new RegExp(`\\b(?:${alts})\\w*`);
/** "peanut-free", "no peanuts", "without dairy" */
const negated = (alts: string) => new RegExp(`\\b(?:${alts})\\w*[- ]free\\b|\\b(?:no|without|skip|omit)\\s+(?:${alts})\\w*`, "g");

const ALLERGY_RULES: Record<string, Rule> = {
  peanut: { terms: /\b(?:peanut|groundnut|satay)\w*/, allow: negated("peanut") },
  "tree nut": { terms: word(NUTS), allow: negated(`nut|${NUTS}`) },
  nut: { terms: word(`peanut|satay|${NUTS}`), allow: negated(`nut|peanut|${NUTS}`) },
  shellfish: { terms: word(SHELLFISH), allow: new RegExp(`${negated(SHELLFISH).source}|\\bimitation crab\\b`, "g") },
  fish: { terms: new RegExp(`\\b(?:${FISH})\\w*|\\bfish sauce\\b`), allow: negated("fish") },
  egg: { terms: /\b(?:eggs?|mayo\w*|meringue|aioli|frittata|omelet\w*|quiche)\b/, allow: /\begg[- ]free\b|\bflax eggs?\b|\beggplants?\b|\bno eggs?\b/g },
  dairy: { terms: word(DAIRY), allow: new RegExp(`${PLANT_DAIRY.source}|${NUT_BUTTERS.source}|${negated("dairy|milk|cheese").source}`, "g") },
  milk: { terms: word(DAIRY), allow: new RegExp(`${PLANT_DAIRY.source}|${NUT_BUTTERS.source}|${negated("dairy|milk").source}`, "g") },
  soy: { terms: /\b(?:soy\w*|tofu|tempeh|edamame|miso|tamari|teriyaki|hoisin)\b/, allow: negated("soy") },
  wheat: { terms: word(GLUTEN), allow: new RegExp(`${GLUTEN_FREE.source}|${negated("wheat|gluten").source}`, "g") },
  gluten: { terms: word(GLUTEN), allow: new RegExp(`${GLUTEN_FREE.source}|${negated("wheat|gluten").source}`, "g") },
  sesame: { terms: /\b(?:sesame|tahini|furikake|za'?atar)\w*/, allow: negated("sesame") },
};

const DIET_RULES: Record<string, Rule> = {
  vegan: {
    terms: new RegExp(`\\b(?:${MEAT}|${FISH}|${SHELLFISH}|${DAIRY}|eggs?|honey|mayo)\\w*|\\bfish sauce\\b`),
    allow: new RegExp(`${PLANT_DAIRY.source}|${NUT_BUTTERS.source}|\\bvegan \\w+|\\bflax eggs?\\b|\\beggplants?\\b|\\bchickpeas?\\b|\\b(?:meat|dairy|egg)[- ]free\\b`, "g"),
  },
  vegetarian: { terms: new RegExp(`\\b(?:${MEAT}|${FISH}|${SHELLFISH})\\w*|\\bfish sauce\\b`), allow: /\bvegetarian \w+|\bmeat[- ]free\b|\bchickpeas?\b/g },
  pescatarian: { terms: word(MEAT), allow: /\bmeat[- ]free\b|\bchickpeas?\b/g },
  "dairy-free": { terms: word(DAIRY), allow: new RegExp(`${PLANT_DAIRY.source}|${NUT_BUTTERS.source}`, "g") },
  "gluten-free": { terms: word(GLUTEN), allow: GLUTEN_FREE },
};

const norm = (s: string) => s.toLowerCase().trim().replace(/s$/, "");
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Finds the rule for a listed allergy; unknown/custom allergies match their own words. */
function allergyRule(allergy: string): Rule | null {
  const key = norm(allergy);
  if (ALLERGY_RULES[key]) return ALLERGY_RULES[key];
  const found = Object.keys(ALLERGY_RULES).find((k) => key.includes(k));
  if (found) return ALLERGY_RULES[found];
  const words = key.split(/[^a-z]+/).filter((w) => w.length >= 3);
  if (!words.length) return null;
  const alts = words.map((w) => escape(w.replace(/s$/, ""))).join("|");
  return { terms: new RegExp(`\\b(?:${alts})\\w*`), allow: negated(alts) };
}

function breaks(text: string, rule: Rule): string | null {
  const cleaned = rule.allow ? text.replace(rule.allow, " ") : text;
  return cleaned.match(rule.terms)?.[0] ?? null;
}

const cardText = (c: RecipeCard) => [c.title, ...c.usedIngredients, ...c.missingIngredients.map((m) => m.name)].join("\n").toLowerCase();

/** Returns why the card must be dropped, or null if it follows the cook's preferences. */
export function violation(card: RecipeCard, p: Preferences): string | null {
  const text = cardText(card);
  for (const allergy of p.allergies) {
    const rule = allergyRule(allergy);
    const hit = rule && breaks(text, rule);
    if (hit) return `allergy "${allergy}" (${hit})`;
  }
  for (const diet of p.diets) {
    const rule = DIET_RULES[diet.toLowerCase()];
    const hit = rule && breaks(text, rule);
    if (hit) return `diet "${diet}" (${hit})`;
  }
  if (p.maxMinutes && card.totalMinutes > p.maxMinutes) return `${card.totalMinutes} min > ${p.maxMinutes} min limit`;
  if (card.missingIngredients.length > p.maxExtras) return `${card.missingIngredients.length} extras > ${p.maxExtras}`;
  return null;
}
