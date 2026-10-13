import { AISLES, type ShoppingItem } from "../types";

type Quantity = ShoppingItem["quantities"][number];

export interface IncomingItem {
  name: string;
  aisle: string;
  quantity: Quantity | null;
  recipe: { id: string; title: string } | null;
}

const normalizeName = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/(es|s)$/, "");

const normalizeUnit = (unit: string | null) => (unit ?? "").toLowerCase().replace(/\.$/, "").replace(/s$/, "");

function mergeQuantity(quantities: Quantity[], q: Quantity | null) {
  if (!q || (q.amount === null && !q.unit)) return;
  const match = quantities.find((existing) => normalizeUnit(existing.unit) === normalizeUnit(q.unit));
  if (match && match.amount !== null && q.amount !== null) {
    match.amount = Math.round((match.amount + q.amount) * 100) / 100;
  } else if (!match) {
    quantities.push({ amount: q.amount, unit: q.unit });
  }
}

/** Merges new items into the list: same-name items combine, same-unit amounts add up. Returns a new array. */
export function mergeItems(existing: ShoppingItem[], incoming: IncomingItem[], newId: () => string): ShoppingItem[] {
  const items = existing.map((i) => ({ ...i, quantities: i.quantities.map((q) => ({ ...q })), recipes: [...i.recipes] }));
  for (const inc of incoming) {
    const key = normalizeName(inc.name);
    let item = items.find((i) => normalizeName(i.name) === key);
    if (!item) {
      item = {
        id: newId(),
        name: inc.name,
        aisle: (AISLES as readonly string[]).includes(inc.aisle) ? inc.aisle : "Other",
        quantities: [],
        checked: false,
        recipes: [],
        addedAt: new Date().toISOString(),
      };
      items.push(item);
    } else {
      item.checked = false;
    }
    mergeQuantity(item.quantities, inc.quantity);
    if (inc.recipe && !item.recipes.some((r) => r.id === inc.recipe!.id)) item.recipes.push(inc.recipe);
  }
  return items;
}
