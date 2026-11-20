import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ClipboardCopy, ExternalLink, Plus, Printer, Share2, ShoppingBasket, Sparkles, Trash2, X } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useAddListItem, useClearChecked, useClearList, useDeleteListItem, useFindPrices, useShoppingList, useToggleListItem } from "@/api/hooks";
import { AISLES, type ShoppingItem } from "@/api/types";
import type { ShoppingPricesResponse } from "@/api/backend";
import { Button } from "@/components/ui/button";
import { Card, Skeleton } from "@/components/ui/primitives";
import { cn, formatQuantity } from "@/lib/utils";

const AISLE_EMOJI: Record<string, string> = {
  Produce: "🥬",
  "Meat & Seafood": "🥩",
  "Dairy & Eggs": "🥚",
  Bakery: "🍞",
  Pantry: "🥫",
  "Spices & Seasonings": "🧂",
  "Condiments & Sauces": "🍯",
  Frozen: "🧊",
  Other: "🛒",
};

const quantityText = (item: ShoppingItem) =>
  item.quantities
    .map((q) => formatQuantity(q.amount, q.unit))
    .filter(Boolean)
    .join(" + ");

export function ShoppingListPage() {
  const { data, isLoading, isError, error } = useShoppingList();
  const addItem = useAddListItem();
  const toggle = useToggleListItem();
  const del = useDeleteListItem();
  const clearChecked = useClearChecked();
  const clearAll = useClearList();
  const findPrices = useFindPrices();
  const [name, setName] = useState("");
  const [aisle, setAisle] = useState<string>("Produce");
  const [location, setLocation] = useState("");
  const [priceResults, setPriceResults] = useState<ShoppingPricesResponse | null>(null);

  const items = data?.items ?? [];
  const remaining = items.filter((i) => !i.checked).length;

  const storesByItemId = useMemo(() => {
    const map: Record<string, NonNullable<ShoppingPricesResponse["results"]>[number]["stores"]> = {};
    try {
      for (const entry of priceResults?.results ?? []) {
        if (entry?.itemId) {
          map[entry.itemId] = Array.isArray(entry.stores) ? entry.stores : [];
        }
      }
    } catch (err) {
      console.error("[ShoppingListPage] Failed to map store results:", err);
    }
    return map;
  }, [priceResults]);

  const aiSummary = useMemo(() => {
    try {
      const raw = (priceResults as (ShoppingPricesResponse & { aiSummary?: string | null }) | null)?.aiSummary;
      return typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null;
    } catch (err) {
      console.error("[ShoppingListPage] Failed to read AI summary:", err);
      return null;
    }
  }, [priceResults]);

  const groups = useMemo(() => {
    const map = new Map<string, ShoppingItem[]>();
    for (const a of AISLES) map.set(a, []);
    for (const item of items) (map.get(item.aisle) ?? map.get("Other")!).push(item);
    return [...map.entries()]
      .filter(([, list]) => list.length)
      .map(([a, list]) => [a, [...list].sort((x, y) => Number(x.checked) - Number(y.checked))] as const);
  }, [items]);

  const asText = () =>
    groups
      .map(([a, list]) => {
        const lines = list.filter((i) => !i.checked).map((i) => `- ${i.name}${quantityText(i) ? ` (${quantityText(i)})` : ""}`);
        return lines.length ? `${a}\n${lines.join("\n")}` : "";
      })
      .filter(Boolean)
      .join("\n\n");

  const onAdd = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    addItem.mutate({ name: name.trim(), aisle }, { onError: (err) => toast.error(err.message) });
    setName("");
  };

  const onCopy = async () => {
    await navigator.clipboard.writeText(asText());
    toast.success("Shopping list copied");
  };

  const onShare = async () => {
    try {
      await navigator.share({ title: "Shopping list", text: asText() });
    } catch {
      /* user cancelled */
    }
  };

  const onFindPrices = () => {
    if (!location.trim()) return;

    try {
      findPrices.mutate(location.trim(), {
        onSuccess: (resData) => {
          setPriceResults(resData);
          console.log("PRICE_RESULTS", resData);
        },
        onError: (err) => {
          toast.error(err.message);
        },
      });
    } catch (err) {
      console.error("[ShoppingListPage] Find Prices dispatch error:", err);
      toast.error("Could not start price lookup");
    }
  };

  useEffect(() => {
    if (!priceResults) return;

    console.log("SAVED_PRICE_RESULTS", priceResults);
  }, [priceResults]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-semibold">Shopping list</h1>
          <p className="mt-1 text-muted">{items.length ? `${remaining} of ${items.length} items left to grab` : "Missing ingredients from recipes land here."}</p>
        </div>
        {items.length > 0 && (
          <div className="flex flex-wrap gap-2 print:hidden">
            <Button variant="outline" size="sm" onClick={onCopy}>
              <ClipboardCopy className="h-4 w-4" /> Copy
            </Button>
            {"share" in navigator && (
              <Button variant="outline" size="sm" onClick={onShare}>
                <Share2 className="h-4 w-4" /> Share
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Print
            </Button>
          </div>
        )}
      </div>

      <Card className="p-4 print:hidden">
        <form onSubmit={onAdd} className="flex flex-col gap-2 sm:flex-row">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Add an item, e.g. 'paper towels'"
            className="h-11 flex-1 rounded-xl border border-line bg-surface px-4 text-sm outline-none focus:border-saffron-500"
          />
          <select
            value={aisle}
            onChange={(e) => setAisle(e.target.value)}
            className="h-11 cursor-pointer rounded-xl border border-line bg-surface px-3 text-sm outline-none"
            aria-label="Aisle"
          >
            {AISLES.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
          <Button type="submit" size="lg" className="h-11" disabled={!name.trim()} loading={addItem.isPending}>
            {!addItem.isPending && <Plus className="h-4 w-4" />} Add
          </Button>
        </form>
      </Card>

      <Card className="p-4 print:hidden">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Location (City or ZIP)"
            className="h-11 flex-1 rounded-xl border border-line bg-surface px-4 text-sm outline-none focus:border-saffron-500"
          />
          <Button
            type="button"
            onClick={onFindPrices}
            disabled={!location.trim() || findPrices.isPending}
            loading={findPrices.isPending}
          >
            {findPrices.isPending ? "Finding..." : "Find Prices"}
          </Button>
        </div>
      </Card>

      {aiSummary && (
        <Card className="border-saffron-500/35 bg-surface/90 p-4 print:hidden">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-saffron-500">
              <Sparkles className="h-3.5 w-3.5" />
              <span>AI Shopping Assistant</span>
            </div>
            <button
              type="button"
              onClick={() => setPriceResults((prev) => (prev ? ({ ...prev, aiSummary: null } as ShoppingPricesResponse) : null))}
              className="cursor-pointer text-xs text-muted hover:text-foreground"
            >
              Dismiss
            </button>
          </div>
          <p className="whitespace-pre-line text-sm leading-relaxed">{aiSummary}</p>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : isError ? (
        <Card className="p-8 text-center text-muted">{error.message}</Card>
      ) : items.length === 0 ? (
        <Card className="p-12 text-center">
          <ShoppingBasket className="mx-auto h-12 w-12 text-saffron-500" />
          <h2 className="mt-4 text-2xl font-semibold">Your list is empty</h2>
          <p className="mx-auto mt-2 max-w-sm text-muted">Open a recipe and tap "Add to list" to collect everything you're missing, sorted by aisle.</p>
          <Link to="/" className="mt-6 inline-block">
            <Button>Find a recipe</Button>
          </Link>
        </Card>
      ) : (
        <>
          {groups.map(([aisleName, list]) => (
            <section key={aisleName}>
              <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold">
                <span>{AISLE_EMOJI[aisleName] ?? "🛒"}</span> {aisleName}
                <span className="text-sm font-normal text-muted">({list.filter((i) => !i.checked).length})</span>
              </h2>
              <Card className="divide-y divide-line overflow-hidden p-0">
                <AnimatePresence initial={false}>
                  {list.map((item) => {
                    const matchedStores = storesByItemId[item.id] ?? [];

                    return (
                      <motion.div key={item.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }} className="group flex items-start gap-3 px-4 py-3">
                        <button
                          onClick={() => toggle.mutate({ id: item.id, checked: !item.checked })}
                          aria-label={item.checked ? `Uncheck ${item.name}` : `Check off ${item.name}`}
                          className={cn(
                            "mt-0.5 grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-lg border-2 transition-all",
                            item.checked ? "border-herb-500 bg-herb-500 text-white" : "border-line hover:border-herb-500",
                          )}
                        >
                          {item.checked && <Check className="h-4 w-4" strokeWidth={3} />}
                        </button>
                        <div className={cn("min-w-0 flex-1 transition-opacity", item.checked && "opacity-50")}>
                          <div className={cn("font-medium capitalize", item.checked && "line-through")}>
                            {item.name}
                            {quantityText(item) && <span className="ml-2 text-sm font-normal text-muted normal-case">{quantityText(item)}</span>}
                          </div>
                          {item.recipes.length > 0 && (
                            <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted">
                              for{" "}
                              {item.recipes.map((r, i) => (
                                <Link key={r.id} to={`/recipe/${r.id}`} className="hover:text-saffron-500 hover:underline">
                                  {r.title}
                                  {i < item.recipes.length - 1 ? "," : ""}
                                </Link>
                              ))}
                            </div>
                          )}
                          {matchedStores.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {matchedStores.map((store, index) => (
                                <a
                                  key={`${item.id}-${store.storeName}-${store.distanceMiles}-${index}`}
                                  href={store.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs transition hover:border-saffron-500/60"
                                >
                                  <span className="font-medium text-saffron-500">{store.storeName}</span>
                                  <span className="text-muted">· {store.distanceMiles} mi</span>
                                  {typeof store.price === "number" && (
                                    <span className="rounded bg-saffron-500/15 px-1.5 py-0.5 font-semibold text-foreground">
                                      ${store.price.toFixed(2)}
                                    </span>
                                  )}
                                  {store.url && <ExternalLink className="h-3 w-3 text-muted" />}
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => del.mutate(item.id)}
                          aria-label={`Remove ${item.name}`}
                          className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-muted opacity-100 transition-opacity hover:bg-tomato-500/10 hover:text-tomato-500 sm:opacity-0 sm:group-hover:opacity-100 print:hidden"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </Card>
            </section>
          ))}

          <div className="flex flex-wrap justify-end gap-2 print:hidden">
            <Button variant="ghost" size="sm" onClick={() => clearChecked.mutate()} disabled={!items.some((i) => i.checked)} loading={clearChecked.isPending}>
              <Check className="h-4 w-4" /> Clear checked
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-tomato-500"
              loading={clearAll.isPending}
              onClick={() => {
                if (window.confirm("Clear the whole shopping list?")) clearAll.mutate();
              }}
            >
              <Trash2 className="h-4 w-4" /> Clear all
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
