import { useMemo, useState } from "react";
import { Refrigerator } from "lucide-react";
import { toast } from "sonner";
import { usePantry, useSavePantry } from "@/api/hooks";
import type { PantryItem, RecipeDetails } from "@/api/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";

type UnitGroup = "count" | "mass" | "volume";
const units: Record<string, { group: UnitGroup; factor: number }> = {
  egg: { group: "count", factor: 1 }, eggs: { group: "count", factor: 1 }, item: { group: "count", factor: 1 }, items: { group: "count", factor: 1 },
  piece: { group: "count", factor: 1 }, pieces: { group: "count", factor: 1 }, clove: { group: "count", factor: 1 }, cloves: { group: "count", factor: 1 },
  lb: { group: "mass", factor: 453.592 }, lbs: { group: "mass", factor: 453.592 }, pound: { group: "mass", factor: 453.592 }, pounds: { group: "mass", factor: 453.592 },
  oz: { group: "mass", factor: 28.3495 }, ounce: { group: "mass", factor: 28.3495 }, ounces: { group: "mass", factor: 28.3495 },
  g: { group: "mass", factor: 1 }, gram: { group: "mass", factor: 1 }, grams: { group: "mass", factor: 1 }, kg: { group: "mass", factor: 1000 },
  ml: { group: "volume", factor: 1 }, milliliter: { group: "volume", factor: 1 }, milliliters: { group: "volume", factor: 1 },
  l: { group: "volume", factor: 1000 }, liter: { group: "volume", factor: 1000 }, liters: { group: "volume", factor: 1000 },
  tsp: { group: "volume", factor: 4.929 }, teaspoon: { group: "volume", factor: 4.929 }, teaspoons: { group: "volume", factor: 4.929 },
  tbsp: { group: "volume", factor: 14.787 }, tablespoon: { group: "volume", factor: 14.787 }, tablespoons: { group: "volume", factor: 14.787 },
  cup: { group: "volume", factor: 236.588 }, cups: { group: "volume", factor: 236.588 }, pint: { group: "volume", factor: 473.176 }, pints: { group: "volume", factor: 473.176 },
  quart: { group: "volume", factor: 946.353 }, quarts: { group: "volume", factor: 946.353 }, gallon: { group: "volume", factor: 3785.41 }, gallons: { group: "volume", factor: 3785.41 },
};

function normalizedUnit(unit: string | null | undefined) {
  return (unit ?? "").toLowerCase().replace(/[.]$/, "").trim();
}

function parseAmount(text: string): number | null {
  const value = text.trim().toLowerCase();
  if (value === "a dozen" || value === "dozen") return 12;
  if (value === "half a dozen" || value === "half dozen") return 6;
  const fraction = value.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (fraction) return Number(fraction[1]) / Number(fraction[2]);
  const mixed = value.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

function pantryAmount(quantity: string | undefined, recipeUnit: string | null): { value: number; group: UnitGroup } | null {
  if (!quantity?.trim()) return null;
  const text = quantity.toLowerCase();
  const dozenFactor = /half\s+(a\s+)?dozen/.test(text) ? 6 : /\bdozen\b/.test(text) ? 12 : 1;
  const number = text.match(/\d+\s+\d+\s*\/\s*\d+|\d+\s*\/\s*\d+|\d+(?:\.\d+)?/);
  const amount = number ? parseAmount(number[0]) : /\bdozen\b/.test(text) ? 1 : null;
  if (amount === null) return null;
  const rest = number ? text.slice(number.index! + number[0].length).trim() : text;
  const unit = rest.match(/^[a-z]+/)?.[0];
  const info = unit === "dozen" ? { group: "count" as const, factor: 1 } : units[unit ?? ""];
  if (info) return { value: amount * dozenFactor * info.factor, group: info.group };
  const fallback = units[normalizedUnit(recipeUnit)];
  return { value: amount * dozenFactor, group: fallback?.group ?? "count" };
}

function stockRatio(ingredient: RecipeDetails["ingredients"][number], stock: PantryItem): number | null {
  if (ingredient.amount === null) return null;
  const available = pantryAmount(stock.quantity, ingredient.unit);
  if (!available || available.value <= 0) return null;
  const recipeUnit = units[normalizedUnit(ingredient.unit)];
  const group = recipeUnit?.group ?? "count";
  if (group !== available.group) return null;
  return (ingredient.amount * (recipeUnit?.factor ?? 1)) / available.value;
}

function normalizedName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim().replace(/s$/, "");
}

function findStock(name: string, items: PantryItem[]) {
  const ingredient = normalizedName(name);
  return items.find((item) => {
    const stock = normalizedName(item.name);
    return stock === ingredient || stock.includes(ingredient) || ingredient.includes(stock);
  });
}

export function PantryConsumptionControl({ details }: { details: RecipeDetails }) {
  const pantry = usePantry();
  const savePantry = useSavePantry();
  const pantryItems = pantry.data?.items ?? [];
  const rows = useMemo(() => {
    const seen = new Set<string>();
    return details.ingredients
      .filter((ingredient) => ingredient.have)
      .map((ingredient) => ({ ingredient, stock: findStock(ingredient.name, pantryItems) }))
      .filter((row): row is { ingredient: RecipeDetails["ingredients"][number]; stock: PantryItem } => {
        if (!row.stock) return false;
        const key = normalizedName(row.stock.name);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }, [details.ingredients, pantryItems]);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const isChecked = (ingredient: RecipeDetails["ingredients"][number], stock: PantryItem) =>
    overrides[stock.name] ?? (stockRatio(ingredient, stock) ?? 0) >= 0.5;

  const removeSelected = () => {
    const removed = new Set(rows.filter(({ ingredient, stock }) => isChecked(ingredient, stock)).map(({ stock }) => normalizedName(stock.name)));
    if (!removed.size) return toast.info("Select ingredients to remove first");
    savePantry.mutate(
      { items: pantryItems.filter((item) => !removed.has(normalizedName(item.name))), staples: pantry.data?.staples ?? [] },
      {
        onSuccess: () => toast.success(`Removed ${removed.size} ingredient${removed.size === 1 ? "" : "s"} from your pantry`),
        onError: (error) => toast.error("Couldn't update your pantry", { description: error.message }),
      },
    );
  };

  if (pantry.isLoading || rows.length === 0) return null;
  return (
    <Card className="p-5 text-left">
      <div className="flex items-start gap-3">
        <Refrigerator className="mt-0.5 h-5 w-5 shrink-0 text-herb-500" />
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">Update your pantry</h2>
          <p className="mt-1 text-sm text-muted">Ingredients likely used up are checked. Uncheck anything you still have; check any small amount you want to remove.</p>
          <div className="mt-3 divide-y divide-line">
            {rows.map(({ ingredient, stock }) => (
              <label key={stock.name} className="flex cursor-pointer items-center gap-3 py-2.5 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-herb-600"
                  checked={isChecked(ingredient, stock)}
                  onChange={(event) => setOverrides((current) => ({ ...current, [stock.name]: event.target.checked }))}
                />
                <span className="flex-1">{stock.name}</span>
                <span className="text-muted">Used {ingredient.amount ?? "some"} {ingredient.unit ?? ""}</span>
              </label>
            ))}
          </div>
          <Button className="mt-3" size="sm" variant="outline" onClick={removeSelected} loading={savePantry.isPending}>
            <Refrigerator className="h-4 w-4" /> Remove selected from pantry
          </Button>
        </div>
      </div>
    </Card>
  );
}
