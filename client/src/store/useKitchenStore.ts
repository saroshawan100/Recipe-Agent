import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PantryItem, Preferences, RecipeSummary, SuggestResponse } from "@/api/types";

export interface SelectedIngredient {
  key: string;
  name: string;
  category: string;
  emoji?: string;
  image?: string | null;
  quantity?: string;
  useSoon?: boolean;
}

export const DEFAULT_STAPLES = ["salt", "black pepper", "olive oil", "water"];

export const DEFAULT_PREFERENCES: Preferences = {
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
  maxExtras: 4,
  notes: "",
};

export const ingredientKey = (name: string) => name.trim().toLowerCase();

interface KitchenState {
  selected: SelectedIngredient[];
  staples: string[];
  prefs: Preferences;
  results: SuggestResponse | null;
  toggle: (item: SelectedIngredient) => void;
  add: (item: SelectedIngredient) => void;
  remove: (key: string) => void;
  update: (key: string, patch: Partial<SelectedIngredient>) => void;
  clear: () => void;
  setPrefs: (patch: Partial<Preferences>) => void;
  resetPrefs: () => void;
  setStaples: (staples: string[]) => void;
  setResults: (results: SuggestResponse | null) => void;
  patchResult: (id: string, patch: Partial<Pick<RecipeSummary, "saved" | "imageUrl" | "macros" | "totalMinutes">>) => void;
  loadPantry: (items: PantryItem[], staples: string[], resolve: (item: PantryItem) => SelectedIngredient) => void;
}

export const useKitchenStore = create<KitchenState>()(
  persist(
    (set) => ({
      selected: [],
      staples: DEFAULT_STAPLES,
      prefs: DEFAULT_PREFERENCES,
      results: null,
      toggle: (item) =>
        set((s) =>
          s.selected.some((i) => i.key === item.key)
            ? { selected: s.selected.filter((i) => i.key !== item.key) }
            : { selected: [...s.selected, item] },
        ),
      add: (item) =>
        set((s) => (s.selected.some((i) => i.key === item.key) ? s : { selected: [...s.selected, item] })),
      remove: (key) => set((s) => ({ selected: s.selected.filter((i) => i.key !== key) })),
      update: (key, patch) =>
        set((s) => ({ selected: s.selected.map((i) => (i.key === key ? { ...i, ...patch } : i)) })),
      clear: () => set({ selected: [] }),
      setPrefs: (patch) => set((s) => ({ prefs: { ...s.prefs, ...patch } })),
      resetPrefs: () => set({ prefs: DEFAULT_PREFERENCES }),
      setStaples: (staples) => set({ staples }),
      setResults: (results) => set({ results }),
      patchResult: (id, patch) =>
        set((s) => {
          if (!s.results) return s;
          const apply = (list: SuggestResponse["makeNow"]) => list.map((r) => (r.id === id ? { ...r, ...patch } : r));
          return { results: { ...s.results, makeNow: apply(s.results.makeNow), quickShop: apply(s.results.quickShop) } };
        }),
      loadPantry: (items, staples, resolve) =>
        set({ selected: items.map(resolve), staples: staples.length ? staples : DEFAULT_STAPLES }),
    }),
    {
      name: "pantry-chef-kitchen",
      version: 1,
      merge: (persisted, current) => {
        const p = persisted as Partial<KitchenState>;
        return { ...current, ...p, prefs: { ...DEFAULT_PREFERENCES, ...(p?.prefs ?? {}) } };
      },
    },
  ),
);
