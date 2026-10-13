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
export type Aisle = (typeof AISLES)[number];

export type Difficulty = "easy" | "medium" | "hard";

export interface Macros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface RecipeCard {
  title: string;
  emoji: string;
  description: string;
  cuisine: string;
  totalMinutes: number;
  difficulty: Difficulty;
  servings: number;
  matchPercent: number;
  usedIngredients: string[];
  missingIngredients: { name: string; aisle: Aisle }[];
  macros: Macros;
  tags: string[];
}

export interface RecipeSummary extends RecipeCard {
  id: string;
  group: "makeNow" | "quickShop";
  imageUrl: string | null;
  saved: boolean;
}

export interface SuggestResponse {
  chefNote: string;
  makeNow: RecipeSummary[];
  quickShop: RecipeSummary[];
}

export interface RecipeIngredient {
  name: string;
  amount: number | null;
  unit: string | null;
  preparation: string | null;
  have: boolean;
  optional: boolean;
  aisle: Aisle;
}

export interface RecipeStep {
  title: string;
  instruction: string;
  tip: string | null;
  timerSeconds: number | null;
  donenessCue: string | null;
  phase: "prep" | "cook" | "finish";
}

export interface Nutrition {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodiumMg: number;
}

export interface RecipeDetails {
  intro: string;
  servings: number;
  prepMinutes: number;
  cookMinutes: number;
  ingredients: RecipeIngredient[];
  equipment: string[];
  steps: RecipeStep[];
  glossary: { term: string; definition: string }[];
  substitutions: { ingredient: string; swap: string; note: string }[];
  safetyNotes: string[];
  storage: string;
  servingSuggestion: string;
  nutrition: Nutrition;
}

export interface RecipeDto {
  id: string;
  group: "makeNow" | "quickShop";
  card: RecipeCard;
  details: RecipeDetails | null;
  imageUrl: string | null;
  saved: boolean;
  servings: number;
  calorieTarget: number | null;
  createdAt: string;
}

export interface PantryItem {
  name: string;
  category?: string;
  quantity?: string;
  useSoon?: boolean;
}

export interface Preferences {
  diets: string[];
  allergies: string[];
  cuisines: string[];
  maxMinutes: number | null;
  skill: "beginner" | "intermediate" | "advanced";
  servings: number;
  calorieTarget: number | null;
  proteinTarget: number | null;
  equipment: string[];
  mode: "haveOnly" | "quickShop";
  maxExtras: number;
  notes: string;
}

export interface ShoppingItem {
  id: string;
  name: string;
  aisle: string;
  quantities: { amount: number | null; unit: string | null }[];
  checked: boolean;
  recipes: { id: string; title: string }[];
  addedAt: string;
}

export type CueType = "action" | "check" | "warning" | "meanwhile" | "tip";

export interface CoachCue {
  id: string;
  atSecond: number;
  type: CueType;
  say: string;
  detail: string;
  checkQuestion: string | null;
  ifNotReady: { addSeconds: number; advice: string } | null;
}

export type HeatLevel = "none" | "low" | "medium-low" | "medium" | "medium-high" | "high";

export interface CoachingScript {
  stepIndex: number;
  title: string;
  mode: "timed" | "selfPaced";
  estimatedSeconds: number;
  heatLevel: HeatLevel;
  setup: string[];
  subtasks: string[];
  cues: CoachCue[];
  doneWhen: string[];
  commonMistakes: string[];
  nextStepPreview: string | null;
}

export interface CheckinResponse {
  message: string;
  heatChange: "none" | "lower" | "raise" | "off";
  addSeconds: number;
  newCues: CoachCue[];
}

export interface CookSession {
  id: string;
  recipeId: string;
  status: "active" | "completed" | "abandoned";
  currentStep: number;
  stepElapsedSeconds: number;
  completedSteps: number[];
  startedAt: string;
  finishedAt: string | null;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}
