import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getBackend, type CheckinInput, type ListResponse, type PantryData, type SessionPatch, type SuggestInput } from "./backend";
import type { RecipeDto } from "./types";

export type { SuggestInput };

// ---------- Recipes ----------

export function useSuggest() {
  return useMutation({
    mutationFn: async (input: SuggestInput) => (await getBackend()).suggest(input),
  });
}

export function useRecipe(id: string | undefined) {
  return useQuery({
    queryKey: ["recipe", id],
    queryFn: async () => (await getBackend()).getRecipe(id!),
    enabled: !!id,
  });
}

/** Generates (or loads cached) full instructions. Only runs when the recipe has no details yet. */
export function useRecipeDetails(id: string | undefined, enabled: boolean) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: ["recipe", id, "details"],
    queryFn: async () => {
      const dto = await (await getBackend()).recipeDetails(id!);
      qc.setQueryData(["recipe", id], dto);
      return dto;
    },
    enabled: !!id && enabled,
    staleTime: Infinity,
    retry: 1,
  });
}

export function useRecipeImage(id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["recipe", id, "image"],
    queryFn: async () => (await getBackend()).recipeImage(id!),
    enabled: !!id && enabled,
    staleTime: Infinity,
    retry: false,
  });
}

// ---------- Pantry ----------

export function usePantry() {
  return useQuery({
    queryKey: ["pantry"],
    queryFn: async () => (await getBackend()).getPantry(),
    staleTime: Infinity,
    retry: false,
  });
}

export function useSavePantry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: PantryData) => (await getBackend()).savePantry(body),
    onSuccess: (data) => qc.setQueryData(["pantry"], data),
  });
}

// ---------- Saved ----------

export function useSaved() {
  return useQuery({ queryKey: ["saved"], queryFn: async () => (await getBackend()).listSaved() });
}

export function useToggleSaved() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, saved }: { id: string; saved: boolean }) => (await getBackend()).setSaved(id, saved),
    onSuccess: ({ id, saved }) => {
      qc.setQueryData<RecipeDto>(["recipe", id], (old) => (old ? { ...old, saved } : old));
      qc.invalidateQueries({ queryKey: ["saved"] });
    },
  });
}

// ---------- Shopping list ----------

export function useShoppingList() {
  return useQuery({
    queryKey: ["shopping-list"],
    queryFn: async () => (await getBackend()).shoppingList(),
    retry: false,
  });
}

function useListMutation<V, R extends ListResponse = ListResponse>(fn: (vars: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (data) => qc.setQueryData(["shopping-list"], { items: data.items }),
  });
}

export const useAddRecipeToList = () =>
  useListMutation(async (v: { recipeId: string; scale?: number }) => (await getBackend()).addRecipeToList(v));

export const useAddListItem = () =>
  useListMutation(async (v: { name: string; aisle?: string }) => (await getBackend()).addListItem(v));

export const useToggleListItem = () =>
  useListMutation(async (v: { id: string; checked: boolean }) => (await getBackend()).setListItemChecked(v.id, v.checked));

export const useDeleteListItem = () => useListMutation(async (id: string) => (await getBackend()).deleteListItem(id));

export const useClearChecked = () => useListMutation(async () => (await getBackend()).clearChecked());

export const useClearList = () => useListMutation(async () => (await getBackend()).clearList());

// ---------- Cook with the Chef ----------

export const coachKey = (recipeId: string, step: number) => ["coach", recipeId, step] as const;

export const fetchCoachScript = async (recipeId: string, step: number) => (await getBackend()).coachScript(recipeId, step);

export function useCoachScript(recipeId: string | undefined, step: number, enabled: boolean) {
  return useQuery({
    queryKey: coachKey(recipeId ?? "", step),
    queryFn: () => fetchCoachScript(recipeId!, step),
    enabled: !!recipeId && enabled,
    staleTime: Infinity,
    retry: 1,
  });
}

export function useStartSession() {
  return useMutation({
    mutationFn: async (recipeId: string) => (await getBackend()).startSession(recipeId),
  });
}

export function useRestartSession() {
  return useMutation({
    mutationFn: async (sessionId: string) => (await getBackend()).restartSession(sessionId),
  });
}

export function useUpdateSession() {
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & SessionPatch) => (await getBackend()).updateSession(id, patch),
  });
}

export function useCheckin() {
  return useMutation({
    mutationFn: async (body: CheckinInput) => (await getBackend()).checkin(body),
  });
}
