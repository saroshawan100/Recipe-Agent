import { config } from "../config.js";
import type { StoreSearchResult } from "./storeSearchService.js";

interface ShoppingResultItem {
  title?: string;
  source?: string;
  price?: string | number;
  extracted_price?: number;
  link?: string;
  product_link?: string;
}

interface SerpApiShoppingResponse {
  shopping_results?: ShoppingResultItem[];
  error?: string;
}

interface StoreMatch {
  inStock: boolean;
  price: number | null;
  url?: string;
}

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const shoppingCache = new Map<
  string,
  { expiresAt: number; results: ShoppingResultItem[] }
>();

/**
 * Normalizes a shopping list item name so search lookups and token checks
 * match product titles reliably.
 */
export function normalizeItemQuery(itemName: string): string {
  return itemName
    .toLowerCase()
    .replace(
      /\b(\d+\s*(oz|lb|lbs|g|kg|ml|l|ct|pk|pack|bunch|bag|can|cans|jar|jars))\b/gi,
      "",
    )
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalizes store names (e.g. "Safeway #1422" -> "safeway")
 * so nearby Places names match shopping listing sources.
 */
export function normalizeStoreName(storeName: string): string {
  return storeName
    .toLowerCase()
    .replace(/#\d+/g, "")
    .replace(
      /\b(store|supermarket|market|grocery|groceries|pharmacy|inc|llc|co)\b/gi,
      "",
    )
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePrice(item: ShoppingResultItem): number | null {
  if (typeof item.extracted_price === "number" && Number.isFinite(item.extracted_price)) {
    return item.extracted_price;
  }
  if (typeof item.price === "number" && Number.isFinite(item.price)) {
    return item.price;
  }
  if (typeof item.price === "string") {
    const cleaned = parseFloat(item.price.replace(/[^0-9.]/g, ""));
    return Number.isFinite(cleaned) ? cleaned : null;
  }
  return null;
}

async function fetchShoppingResults(
  normalizedQuery: string,
  storeNames: string[],
  location: string,
): Promise<ShoppingResultItem[]> {
  if (!config.serpApiKey) {
    return [];
  }

  const storeHint = storeNames
    .map(normalizeStoreName)
    .filter(Boolean)
    .slice(0, 3)
    .join(" ");

  const query = storeHint ? `${normalizedQuery} ${storeHint}` : normalizedQuery;
  const cacheKey = `${location.toLowerCase().trim()}::${query}`;
  const cached = shoppingCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.results;
  }

  const params = new URLSearchParams({
    engine: "google_shopping",
    q: query,
    location,
    api_key: config.serpApiKey,
  });

  const response = await fetch(
    `https://serpapi.com/search.json?${params.toString()}`,
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(
      `SerpApi shopping request failed (${response.status}): ${errText}`,
    );
  }

  const data = (await response.json()) as SerpApiShoppingResponse;
  if (data.error) {
    throw new Error(`SerpApi error: ${data.error}`);
  }

  const results = data.shopping_results ?? [];
  shoppingCache.set(cacheKey, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    results,
  });

  return results;
}

function findBestMatchForStore(
  normalizedQuery: string,
  storeName: string,
  results: ShoppingResultItem[],
): StoreMatch {
  const queryTokens = normalizedQuery.split(" ").filter((t) => t.length > 1);
  const normStore = normalizeStoreName(storeName);
  const storeTokens = normStore.split(" ").filter((t) => t.length > 2);

  for (const listing of results) {
    const title = (listing.title ?? "").toLowerCase();
    const source = normalizeStoreName(listing.source ?? "");

    const itemMatches =
      queryTokens.length === 0 ||
      queryTokens.every((token) => title.includes(token));

    const storeMatches =
      normStore.length > 0 &&
      (source.includes(normStore) ||
        normStore.includes(source) ||
        storeTokens.some((token) => source.includes(token)));

    if (itemMatches && storeMatches) {
      return {
        inStock: true,
        price: parsePrice(listing),
        url: listing.product_link ?? listing.link,
      };
    }
  }

  return {
    inStock: false,
    price: null,
  };
}

/**
 * Checks nearby stores for evidence of the item via SerpApi Google Shopping.
 */
export async function resolveStoreInventory(
  itemName: string,
  stores: StoreSearchResult[],
  location: string,
  options?: { filterOnlyInStock?: boolean },
): Promise<StoreSearchResult[]> {
  const normalizedQuery = normalizeItemQuery(itemName);
  if (!normalizedQuery || stores.length === 0) {
    return [];
  }

  let listings: ShoppingResultItem[] = [];
  try {
    listings = await fetchShoppingResults(
      normalizedQuery,
      stores.map((s) => s.storeName),
      location,
    );
  } catch (err) {
    console.error("Inventory lookup warning:", err);
  }

  const resolved = stores.map((store) => {
    const match = findBestMatchForStore(normalizedQuery, store.storeName, listings);

    return {
      ...store,
      inStock: match.inStock,
      price: match.price ?? store.price,
      url: match.url ?? store.url,
    };
  });

  if (options?.filterOnlyInStock) {
    return resolved.filter((store) => store.inStock);
  }

  return resolved;
}