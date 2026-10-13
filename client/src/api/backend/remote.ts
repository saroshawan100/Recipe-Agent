import { api, streamApi } from "../client";
import type { CheckinResponse, CoachingScript, CookSession, RecipeDto, RecipeSummary, SuggestResponse } from "../types";
import type { Backend, ListResponse, PantryData } from "./types";

/** Talks to the MongoDB-backed REST API. */
export const remoteBackend: Backend = {
  mode: "mongo",

  suggest: (input) => api<SuggestResponse>("/recipes/suggest", { body: input }),
  getRecipe: (id) => api<RecipeDto>(`/recipes/${id}`),
  recipeDetails: (id) => api<RecipeDto>(`/recipes/${id}/details`, { method: "POST" }),
  recipeImage: (id) => api<{ imageUrl: string }>(`/recipes/${id}/image`, { method: "POST" }),

  getPantry: () => api<PantryData>("/pantry"),
  savePantry: (body) => api<PantryData>("/pantry", { method: "PUT", body }),

  listSaved: () => api<RecipeSummary[]>("/saved"),
  setSaved: (id, saved) => api<{ id: string; saved: boolean }>(`/saved/${id}`, { method: saved ? "POST" : "DELETE" }),

  shoppingList: () => api<ListResponse>("/shopping-list"),
  addRecipeToList: (v) => api<ListResponse & { added: number }>("/shopping-list/from-recipe", { body: v }),
  addListItem: (v) => api<ListResponse>("/shopping-list/items", { body: v }),
  setListItemChecked: (id, checked) => api<ListResponse>(`/shopping-list/items/${id}`, { method: "PATCH", body: { checked } }),
  deleteListItem: (id) => api<ListResponse>(`/shopping-list/items/${id}`, { method: "DELETE" }),
  clearChecked: () => api<ListResponse>("/shopping-list/checked", { method: "DELETE" }),
  clearList: () => api<ListResponse>("/shopping-list", { method: "DELETE" }),

  coachScript: (recipeId, step) => api<CoachingScript>(`/cook/${recipeId}/steps/${step}/coach`, { method: "POST" }),
  startSession: (recipeId) => api<CookSession>("/cook/sessions", { body: { recipeId } }),
  restartSession: (id) => api<CookSession>(`/cook/sessions/${id}/restart`, { method: "POST" }),
  updateSession: (id, patch) => api<CookSession>(`/cook/sessions/${id}`, { method: "PATCH", body: patch }),
  checkin: (input) => api<CheckinResponse>("/cook/checkin", { body: input }),

  askStream: (input, onDelta, signal) => streamApi("/cook/ask", input, onDelta, signal),
  chatStream: ({ messages, pantry, recipeId }, onDelta, signal) =>
    streamApi("/chat", { messages, context: { pantry, recipeId } }, onDelta, signal),
};
