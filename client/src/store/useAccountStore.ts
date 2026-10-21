import { create } from "zustand";
import { AccountApiError, getAccountProfile, loginAccount, logoutAccount, registerAccount, saveAccountPreferences, type AccountProfile } from "@/api/account";
import { queryClient } from "@/api/queryClient";
import type { PantryData } from "@/api/backend/types";
import type { PantryItem, Preferences } from "@/api/types";
import { findCatalogItem, imageUrl } from "@/data/ingredients";
import { useKitchenStore, DEFAULT_STAPLES, ingredientKey, type SelectedIngredient } from "./useKitchenStore";

interface AccountUser {
  id: string;
  email: string;
  preferences: Preferences;
}

interface AccountState {
  available: boolean;
  ready: boolean;
  user: AccountUser | null;
  error: string | null;
  initialize: () => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  savePreferences: (preferences: Preferences) => Promise<void>;
}

function resolvePantryItem(item: PantryItem): SelectedIngredient {
  const match = findCatalogItem(item.name);
  return {
    key: ingredientKey(item.name),
    name: match?.name ?? item.name,
    category: item.category ?? match?.category ?? "custom",
    emoji: match?.emoji ?? "🥄",
    image: match ? imageUrl(match.img) : null,
    quantity: item.quantity,
    useSoon: item.useSoon,
  };
}

function applyProfile(profile: AccountProfile) {
  queryClient.clear();
  const kitchen = useKitchenStore.getState();
  kitchen.setPrefs(profile.user.preferences);
  kitchen.loadPantry(profile.pantry.items, profile.pantry.staples, resolvePantryItem);
}

function pantryFromKitchen(): PantryData {
  const state = useKitchenStore.getState();
  return {
    items: state.selected.map(({ name, category, quantity, useSoon }) => ({ name, category, quantity, useSoon })),
    staples: state.staples,
  };
}

function isUnauthenticated(error: unknown) {
  return error instanceof AccountApiError && error.status === 401;
}

export const useAccountStore = create<AccountState>((set, get) => ({
  available: false,
  ready: false,
  user: null,
  error: null,
  async initialize() {
    if (get().ready) return;
    try {
      const health = await fetch("/api/health").then((res) => (res.ok ? res.json() : null));
      const available = health?.accountsEnabled === true;
      set({ available, ready: true });
      if (!available) return;
      const profile = await getAccountProfile();
      applyProfile(profile);
      set({ user: profile.user, error: null });
    } catch (error) {
      if (isUnauthenticated(error)) set({ user: null, error: null });
      else set({ error: (error as Error).message });
    }
  },
  async register(email, password) {
    set({ error: null });
    const state = useKitchenStore.getState();
    const profile = await registerAccount({ email, password, preferences: state.prefs, pantry: pantryFromKitchen() });
    applyProfile(profile);
    set({ user: profile.user, available: true, ready: true, error: null });
  },
  async login(email, password) {
    set({ error: null });
    const profile = await loginAccount({ email, password });
    applyProfile(profile);
    set({ user: profile.user, available: true, ready: true, error: null });
  },
  async logout() {
    await logoutAccount();
    queryClient.clear();
    const kitchen = useKitchenStore.getState();
    kitchen.clear();
    kitchen.setStaples(DEFAULT_STAPLES);
    kitchen.resetPrefs();
    kitchen.setResults(null);
    set({ user: null, error: null });
  },
  async savePreferences(preferences) {
    await saveAccountPreferences(preferences);
    set((state) => state.user ? { user: { ...state.user, preferences } } : state);
  },
}));
