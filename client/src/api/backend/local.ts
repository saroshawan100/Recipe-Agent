import { ApiError, api, streamApi } from "../client";
import type {
  CheckinResponse,
  CoachingScript,
  CookSession,
  RecipeCard,
  RecipeDetails,
  RecipeDto,
  RecipeSummary,
  ShoppingItem,
} from "../types";
import { idb } from "./idb";
import { mergeItems, type IncomingItem } from "./shopping";
import type { Backend, ListResponse, PantryData, SuggestInput } from "./types";

/** Unsaved recipes beyond this many (newest first) are pruned after each search. */
const MAX_UNSAVED_RECIPES = 80;

interface LocalRecipe {
  id: string;
  group: "makeNow" | "quickShop";
  card: RecipeCard;
  context: SuggestInput;
  details: RecipeDetails | null;
  imageUrl: string | null;
  coaching: Record<string, CoachingScript>;
  saved: boolean;
  savedAt: string | null;
  createdAt: string;
}

interface Checkin {
  stepIndex: number;
  cueId?: string;
  answer: "notYet" | "problem";
  issue?: string;
  note?: string;
  response: string;
  at: string;
}

interface LocalSession extends CookSession {
  checkins: Checkin[];
}

const newId = () => crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

const inFlight = new Map<string, Promise<unknown>>();
function dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const p = fn().finally(() => inFlight.delete(key));
  inFlight.set(key, p);
  return p;
}

const ai = <T>(path: string, body: unknown) => api<T>(`/ai${path}`, { body });

function toDto(r: LocalRecipe): RecipeDto {
  return {
    id: r.id,
    group: r.group,
    card: r.card,
    details: r.details,
    imageUrl: r.imageUrl,
    saved: r.saved,
    servings: r.context.preferences?.servings ?? r.card.servings,
    calorieTarget: r.context.preferences?.calorieTarget ?? null,
    createdAt: r.createdAt,
  };
}

const toSummary = (r: LocalRecipe): RecipeSummary => ({ id: r.id, group: r.group, imageUrl: r.imageUrl, saved: r.saved, ...r.card });

const toSessionDto = ({ checkins: _checkins, ...session }: LocalSession): CookSession => session;

async function findRecipe(id: string): Promise<LocalRecipe> {
  const recipe = await idb.get<LocalRecipe>("recipes", id);
  if (!recipe) throw new ApiError(404, "Recipe not found. It may have been cleared from this browser.");
  return recipe;
}

function requireDetails(recipe: LocalRecipe): RecipeDetails {
  if (!recipe.details) throw new ApiError(409, "Open the recipe first so the chef can write the full instructions.");
  return recipe.details;
}

async function findSession(id: string): Promise<LocalSession> {
  const session = await idb.get<LocalSession>("sessions", id);
  if (!session) throw new ApiError(404, "Cooking session not found");
  return session;
}

async function pruneRecipes() {
  const all = await idb.getAll<LocalRecipe>("recipes");
  const stale = all
    .filter((r) => !r.saved)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(MAX_UNSAVED_RECIPES)
    .map((r) => r.id);
  if (!stale.length) return;
  await idb.deleteMany("recipes", stale);
  const staleSet = new Set(stale);
  const sessions = await idb.getAll<LocalSession>("sessions");
  await idb.deleteMany("sessions", sessions.filter((s) => staleSet.has(s.recipeId)).map((s) => s.id));
}

const getList = async (): Promise<ShoppingItem[]> => (await idb.get<ShoppingItem[]>("kv", "shoppingList")) ?? [];
const saveList = async (items: ShoppingItem[]): Promise<ListResponse> => {
  await idb.put("kv", items, "shoppingList");
  return { items };
};

/** Keeps all data in this browser's IndexedDB and uses the server only for stateless AI calls. */
export const localBackend: Backend = {
  mode: "browser",

  async suggest(input) {
    const result = await ai<{ chefNote: string; makeNow: RecipeCard[]; quickShop: RecipeCard[] }>("/suggest", input);
    const createdAt = new Date().toISOString();
    const make = (group: LocalRecipe["group"]) => (card: RecipeCard): LocalRecipe => ({
      id: newId(),
      group,
      card,
      context: input,
      details: null,
      imageUrl: null,
      coaching: {},
      saved: false,
      savedAt: null,
      createdAt,
    });
    const makeNow = result.makeNow.map(make("makeNow"));
    const quickShop = result.quickShop.map(make("quickShop"));
    await idb.putMany("recipes", [...makeNow, ...quickShop]);
    await pruneRecipes();
    return { chefNote: result.chefNote, makeNow: makeNow.map(toSummary), quickShop: quickShop.map(toSummary) };
  },

  getRecipe: async (id) => toDto(await findRecipe(id)),

  recipeDetails: (id) =>
    dedupe(`details:${id}`, async () => {
      const recipe = await findRecipe(id);
      if (recipe.details) return toDto(recipe);
      const details = await ai<RecipeDetails>("/details", { card: recipe.card, context: recipe.context });
      const { calories, protein, carbs, fat } = details.nutrition;
      const latest = await findRecipe(id);
      const updated: LocalRecipe = {
        ...latest,
        details,
        card: { ...latest.card, macros: { calories, protein, carbs, fat }, totalMinutes: details.prepMinutes + details.cookMinutes },
      };
      await idb.put("recipes", updated);
      return toDto(updated);
    }),

  recipeImage: (id) =>
    dedupe(`image:${id}`, async () => {
      const recipe = await findRecipe(id);
      if (recipe.imageUrl) return { imageUrl: recipe.imageUrl };
      const { title, description, cuisine } = recipe.card;
      const { imageUrl } = await ai<{ imageUrl: string }>("/image", { card: { title, description, cuisine }, key: id });
      await idb.put("recipes", { ...(await findRecipe(id)), imageUrl });
      return { imageUrl };
    }),

  getPantry: async () => (await idb.get<PantryData>("kv", "pantry")) ?? { items: [], staples: [] },
  savePantry: (data) => idb.put("kv", data, "pantry"),

  async listSaved() {
    const all = await idb.getAll<LocalRecipe>("recipes");
    return all
      .filter((r) => r.saved)
      .sort((a, b) => (b.savedAt ?? "").localeCompare(a.savedAt ?? ""))
      .map(toSummary);
  },

  async setSaved(id, saved) {
    const recipe = await findRecipe(id);
    await idb.put("recipes", { ...recipe, saved, savedAt: saved ? new Date().toISOString() : null });
    return { id, saved };
  },

  shoppingList: async () => ({ items: await getList() }),

  async addRecipeToList({ recipeId, scale = 1 }) {
    const recipe = await findRecipe(recipeId);
    const ref = { id: recipe.id, title: recipe.card.title };
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
    const list = await saveList(mergeItems(await getList(), incoming, newId));
    return { ...list, added: incoming.length };
  },

  async addListItem({ name, aisle = "Other" }) {
    return saveList(mergeItems(await getList(), [{ name: name.trim(), aisle, quantity: null, recipe: null }], newId));
  },

  async setListItemChecked(id, checked) {
    return saveList((await getList()).map((i) => (i.id === id ? { ...i, checked } : i)));
  },

  deleteListItem: async (id) => saveList((await getList()).filter((i) => i.id !== id)),
  clearChecked: async () => saveList((await getList()).filter((i) => !i.checked)),
  clearList: () => saveList([]),

  coachScript: (recipeId, step) =>
    dedupe(`coach:${recipeId}:${step}`, async () => {
      const recipe = await findRecipe(recipeId);
      const cached = recipe.coaching?.[String(step)];
      if (cached) return cached;
      const script = await ai<CoachingScript>("/coach", { title: recipe.card.title, details: requireDetails(recipe), stepIndex: step });
      const latest = await findRecipe(recipeId);
      await idb.put("recipes", { ...latest, coaching: { ...latest.coaching, [String(step)]: script } });
      return script;
    }),

  async stepReferenceImage(recipeId, stepIndex) {
    const recipe = await findRecipe(recipeId);
    const details = requireDetails(recipe);
    const step = details.steps[stepIndex];
    if (!step) throw new ApiError(400, "That step doesn't exist in this recipe");
    return ai<{ imageUrl: string }>("/step-image", {
      key: `${recipeId}-step-${stepIndex}`,
      title: recipe.card.title,
      stepIndex,
      step: { title: step.title, instruction: step.instruction },
    });
  },

  async startSession(recipeId) {
    await findRecipe(recipeId);
    const sessions = await idb.getAll<LocalSession>("sessions");
    const active = sessions
      .filter((s) => s.recipeId === recipeId && s.status === "active")
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
    if (active) return toSessionDto(active);
    const session: LocalSession = {
      id: newId(),
      recipeId,
      status: "active",
      currentStep: 0,
      stepElapsedSeconds: 0,
      completedSteps: [],
      startedAt: new Date().toISOString(),
      finishedAt: null,
      checkins: [],
    };
    await idb.put("sessions", session);
    return toSessionDto(session);
  },

  async restartSession(id) {
    const session = await findSession(id);
    const restarted: LocalSession = {
      ...session,
      currentStep: 0,
      stepElapsedSeconds: 0,
      completedSteps: [],
      status: "active",
      startedAt: new Date().toISOString(),
      finishedAt: null,
    };
    await idb.put("sessions", restarted);
    return toSessionDto(restarted);
  },

  async updateSession(id, patch) {
    const session = await findSession(id);
    const updated: LocalSession = {
      ...session,
      ...patch,
      finishedAt: patch.status === "completed" ? new Date().toISOString() : session.finishedAt,
    };
    await idb.put("sessions", updated);
    return toSessionDto(updated);
  },

  async checkin({ recipeId, stepIndex, sessionId, cueId, answer, issue, note, image, elapsedSeconds }) {
    const recipe = await findRecipe(recipeId);
    const cueText = cueId ? recipe.coaching?.[String(stepIndex)]?.cues.find((c) => c.id === cueId)?.say : undefined;
    const result = await ai<CheckinResponse>("/checkin", {
      title: recipe.card.title,
      details: requireDetails(recipe),
      stepIndex,
      answer,
      issue,
      note,
      image,
      elapsedSeconds,
      cueText,
    });
    if (sessionId) {
      const session = await idb.get<LocalSession>("sessions", sessionId);
      if (session) {
        const entry: Checkin = { stepIndex, cueId, answer, issue, note, response: result.message, at: new Date().toISOString() };
        await idb.put("sessions", { ...session, checkins: [...session.checkins, entry] });
      }
    }
    return result;
  },

  async askStream({ recipeId, stepIndex, elapsedSeconds, messages }, onDelta, signal) {
    const recipe = await findRecipe(recipeId);
    const details = requireDetails(recipe);
    return streamApi(
      "/ai/ask",
      { title: recipe.card.title, details, stepIndex: Math.min(stepIndex, details.steps.length - 1), elapsedSeconds, messages },
      onDelta,
      signal,
    );
  },

  async chatStream({ messages, pantry, recipeId }, onDelta, signal) {
    const recipe = recipeId ? await idb.get<LocalRecipe>("recipes", recipeId) : undefined;
    return streamApi(
      "/ai/chat",
      { messages, pantry, recipe: recipe ? { title: recipe.card.title, details: recipe.details } : null },
      onDelta,
      signal,
    );
  },
};
