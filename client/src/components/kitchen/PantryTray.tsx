import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Clock, Download, Refrigerator, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { usePantry, useSavePantry } from "@/api/hooks";
import type { PantryItem } from "@/api/types";
import { Button } from "@/components/ui/button";
import { Card, Popover, Switch } from "@/components/ui/primitives";
import { findCatalogItem } from "@/data/ingredients";
import { cn } from "@/lib/utils";
import { useKitchenStore, type SelectedIngredient } from "@/store/useKitchenStore";
import { useAccountStore } from "@/store/useAccountStore";
import { IngredientImage } from "./IngredientImage";
import { customIngredient, toSelected } from "./IngredientPicker";

function resolvePantryItem(item: PantryItem): SelectedIngredient {
  const match = findCatalogItem(item.name);
  const base = match ? toSelected(match) : customIngredient(item.name);
  return { ...base, quantity: item.quantity, useSoon: item.useSoon };
}

export function PantryTray() {
  const selected = useKitchenStore((s) => s.selected);
  const staples = useKitchenStore((s) => s.staples);
  const remove = useKitchenStore((s) => s.remove);
  const update = useKitchenStore((s) => s.update);
  const clear = useKitchenStore((s) => s.clear);
  const loadPantry = useKitchenStore((s) => s.loadPantry);
  const { data: saved } = usePantry();
  const savePantry = useSavePantry();
  const accountId = useAccountStore((s) => s.user?.id);

  useEffect(() => {
    if (!accountId) return;
    const timer = window.setTimeout(() => {
      savePantry.mutate({
        items: selected.map((s) => ({ name: s.name, category: s.category, quantity: s.quantity || undefined, useSoon: s.useSoon || undefined })),
        staples,
      }, { onError: (error) => toast.error("Couldn't sync pantry", { description: error.message }) });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [accountId, selected, staples, savePantry.mutate]);

  const onSave = () =>
    savePantry.mutate(
      {
        items: selected.map((s) => ({ name: s.name, category: s.category, quantity: s.quantity || undefined, useSoon: s.useSoon || undefined })),
        staples,
      },
      {
        onSuccess: () => toast.success("Pantry saved", { description: "It'll be here next time you visit." }),
        onError: (e) => toast.error("Couldn't save pantry", { description: e.message }),
      },
    );

  const savedCount = saved?.items.length ?? 0;

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Refrigerator className="h-5 w-5 text-saffron-500" />
          <h2 className="text-lg font-semibold">My pantry</h2>
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold text-muted">{selected.length}</span>
        </div>
        <div className="flex gap-1">
          {selected.length > 0 && (
            <>
              <Button variant="ghost" size="icon-sm" onClick={onSave} loading={savePantry.isPending} title="Save pantry" aria-label="Save pantry">
                {!savePantry.isPending && <Save className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={clear} title="Clear all" aria-label="Clear all ingredients">
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {selected.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line px-4 py-6 text-center">
          <div className="text-3xl">🧺</div>
          <p className="mt-2 text-sm text-muted">Tap ingredients you have, or type them in the search box.</p>
          {savedCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => loadPantry(saved!.items, saved!.staples, resolvePantryItem)}
            >
              <Download className="h-4 w-4" /> Load my saved pantry ({savedCount})
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="flex max-h-64 flex-wrap gap-2 overflow-y-auto pr-1">
            <AnimatePresence initial={false}>
              {selected.map((item) => (
                <motion.div
                  key={item.key}
                  layout
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.15 }}
                >
                  <Popover
                    trigger={
                      <button
                        className={cn(
                          "group flex cursor-pointer items-center gap-1.5 rounded-full border py-1 pr-1 pl-1.5 text-sm transition-colors",
                          item.useSoon
                            ? "border-tomato-500/60 bg-tomato-500/10"
                            : "border-line bg-surface hover:border-saffron-500/50",
                        )}
                      >
                        <IngredientImage src={item.image} emoji={item.emoji} alt="" className="h-6 w-6" emojiClassName="h-6 w-6 text-base" />
                        <span className="font-medium">{item.name}</span>
                        {item.quantity && <span className="text-xs text-muted">· {item.quantity}</span>}
                        {item.useSoon && <Clock className="h-3.5 w-3.5 text-tomato-500" />}
                        <span
                          role="button"
                          tabIndex={0}
                          aria-label={`Remove ${item.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            remove(item.key);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.stopPropagation();
                              remove(item.key);
                            }
                          }}
                          className="grid h-5 w-5 place-items-center rounded-full text-muted hover:bg-tomato-500 hover:text-white"
                        >
                          <X className="h-3 w-3" />
                        </span>
                      </button>
                    }
                  >
                    <div className="w-56 space-y-3">
                      <div className="font-semibold">{item.name}</div>
                      <label className="block">
                        <span className="text-xs text-muted">How much do you have? (optional)</span>
                        <input
                          value={item.quantity ?? ""}
                          onChange={(e) => update(item.key, { quantity: e.target.value })}
                          placeholder="e.g. 1 lb, 2 cups, half a bag"
                          className="mt-1 h-9 w-full rounded-lg border border-line bg-bg px-3 text-sm outline-none focus:border-saffron-500"
                        />
                      </label>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm">
                          Use it up soon
                          <span className="block text-xs text-muted">Chef will prioritize it</span>
                        </span>
                        <Switch checked={!!item.useSoon} onChange={(v) => update(item.key, { useSoon: v })} label="Use soon" />
                      </div>
                    </div>
                  </Popover>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          <p className="mt-3 text-xs text-muted">Tip: tap a chip to add an amount or flag it as "use it up soon".</p>
        </>
      )}
    </Card>
  );
}
