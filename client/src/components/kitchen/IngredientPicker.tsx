import { useMemo, useState, type KeyboardEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Plus, Search, Sparkles, X } from "lucide-react";
import { Card } from "@/components/ui/primitives";
import { CATALOG, CATEGORIES, imageUrl, searchCatalog, type CatalogItem, type CategoryId } from "@/data/ingredients";
import { cn } from "@/lib/utils";
import { ingredientKey, useKitchenStore, type SelectedIngredient } from "@/store/useKitchenStore";
import { IngredientImage } from "./IngredientImage";

export function toSelected(item: CatalogItem): SelectedIngredient {
  return { key: ingredientKey(item.name), name: item.name, category: item.category, emoji: item.emoji, image: imageUrl(item.img) };
}

export function customIngredient(name: string): SelectedIngredient {
  const clean = name.trim().replace(/\s+/g, " ");
  const pretty = clean.charAt(0).toUpperCase() + clean.slice(1);
  return { key: ingredientKey(clean), name: pretty, category: "custom", emoji: "🥄", image: null };
}

export function IngredientPicker() {
  const [category, setCategory] = useState<CategoryId>("proteins");
  const [query, setQuery] = useState("");
  const selected = useKitchenStore((s) => s.selected);
  const toggle = useKitchenStore((s) => s.toggle);
  const add = useKitchenStore((s) => s.add);
  const selectedKeys = useMemo(() => new Set(selected.map((s) => s.key)), [selected]);

  const searching = query.trim().length > 0;
  const items = searching ? searchCatalog(query) : CATALOG.filter((i) => i.category === category);
  const exactMatch = searching && CATALOG.some((i) => i.name.toLowerCase() === query.trim().toLowerCase());
  const isList = /[,\n;]/.test(query);

  const countByCategory = useMemo(() => {
    const counts: Partial<Record<string, number>> = {};
    for (const s of selected) counts[s.category] = (counts[s.category] ?? 0) + 1;
    return counts;
  }, [selected]);

  const addFromText = (text: string) => {
    const parts = text
      .split(/[,\n;]/)
      .map((p) => p.trim())
      .filter(Boolean);
    for (const part of parts) {
      const match = CATALOG.find((i) => i.name.toLowerCase() === part.toLowerCase()) ?? searchCatalog(part, 1)[0];
      const useMatch = match && match.name.toLowerCase().includes(part.toLowerCase()) && part.length >= 3;
      add(useMatch ? toSelected(match) : customIngredient(part));
    }
    setQuery("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && query.trim()) {
      e.preventDefault();
      if (isList) return addFromText(query);
      const first = items[0];
      if (first && first.name.toLowerCase().startsWith(query.trim().toLowerCase())) {
        add(toSelected(first));
        setQuery("");
      } else addFromText(query);
    }
    if (e.key === "Escape") setQuery("");
  };

  return (
    <Card className="p-4 sm:p-6">
      <div className="flex flex-col gap-4">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search or type anything: 'chicken thighs, leftover rice, kimchi'"
            className="h-14 w-full rounded-2xl border border-line bg-surface pr-12 pl-12 text-base shadow-inner shadow-black/5 transition-colors outline-none placeholder:text-muted/70 focus:border-saffron-500 focus:ring-4 focus:ring-saffron-500/15"
            aria-label="Search ingredients"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute top-1/2 right-3 grid h-8 w-8 -translate-y-1/2 cursor-pointer place-items-center rounded-lg text-muted hover:bg-surface-2"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {!searching && (
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-none">
            {CATEGORIES.map(({ id, label, icon: Icon }) => {
              const active = id === category;
              const count = countByCategory[id];
              return (
                <button
                  key={id}
                  onClick={() => setCategory(id)}
                  className={cn(
                    "flex shrink-0 cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-all",
                    active
                      ? "border-transparent bg-fg text-bg shadow-lg"
                      : "border-line text-muted hover:border-muted/50 hover:text-fg",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                  {count ? (
                    <span className={cn("rounded-full px-1.5 text-xs", active ? "bg-saffron-500 text-stone-950" : "bg-saffron-500/20 text-saffron-600 dark:text-saffron-300")}>
                      {count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}

        {searching && !exactMatch && (
          <button
            onClick={() => addFromText(query)}
            className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-saffron-500/60 bg-saffron-500/5 px-4 py-3 text-left text-sm transition-colors hover:bg-saffron-500/10"
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-saffron-500 text-stone-950">
              {isList ? <Sparkles className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            </span>
            <span>
              {isList ? (
                <>
                  Add all <strong>{query.split(/[,\n;]/).filter((p) => p.trim()).length}</strong> items from your list
                </>
              ) : (
                <>
                  Add <strong>"{query.trim()}"</strong> to my pantry
                </>
              )}
              <span className="block text-xs text-muted">Press Enter</span>
            </span>
          </button>
        )}

        <motion.div layout className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6">
          <AnimatePresence mode="popLayout" initial={false}>
            {items.map((item) => (
              <IngredientTile
                key={item.name}
                item={item}
                selected={selectedKeys.has(ingredientKey(item.name))}
                onToggle={() => toggle(toSelected(item))}
              />
            ))}
          </AnimatePresence>
        </motion.div>

        {searching && items.length === 0 && (
          <p className="py-6 text-center text-sm text-muted">Not in our catalog, but you can still add it above.</p>
        )}
      </div>
    </Card>
  );
}

function IngredientTile({ item, selected, onToggle }: { item: CatalogItem; selected: boolean; onToggle: () => void }) {
  return (
    <motion.button
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.18 }}
      whileTap={{ scale: 0.94 }}
      onClick={onToggle}
      aria-pressed={selected}
      className={cn(
        "group relative flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl border p-2.5 pt-3 text-center transition-colors duration-200",
        selected
          ? "border-saffron-500 bg-saffron-500/10 shadow-lg shadow-saffron-500/10"
          : "border-line bg-surface/60 hover:border-saffron-500/50 hover:bg-surface",
      )}
    >
      <div className="relative grid h-14 w-14 place-items-center sm:h-16 sm:w-16">
        <IngredientImage
          src={imageUrl(item.img)}
          emoji={item.emoji}
          alt={item.name}
          className="h-full w-full transition-transform duration-300 group-hover:scale-110"
          emojiClassName="text-4xl transition-transform duration-300 group-hover:scale-110"
        />
      </div>
      <span className="line-clamp-2 text-xs leading-tight font-medium sm:text-[13px]">{item.name}</span>
      <span
        className={cn(
          "absolute top-1.5 right-1.5 grid h-5 w-5 place-items-center rounded-full transition-all duration-200",
          selected ? "scale-100 bg-saffron-500 text-stone-950" : "scale-0 bg-surface-2 text-muted group-hover:scale-100",
        )}
      >
        {selected ? <Check className="h-3 w-3" strokeWidth={3} /> : <Plus className="h-3 w-3" strokeWidth={3} />}
      </span>
    </motion.button>
  );
}
