import OpenAI from "openai";
import { config } from "../config.js";
import { geocodeLocation } from "./geocodingService.js";

export interface StoreSearchResult {
  storeName: string;
  distanceMiles: number;
  address?: string;
  price: number | null;
  inStock: boolean;
  url?: string;
}

interface NearbyStore {
  storeName: string;
  latitude: number;
  longitude: number;
  address?: string;
  url?: string;
}

interface PlacesNewResponse {
  places?: {
    displayName?: { text?: string };
    formattedAddress?: string;
    location?: {
      latitude: number;
      longitude: number;
    };
  }[];
}

interface SerpApiShoppingItem {
  title?: string;
  source?: string;
  price?: string | number;
  extracted_price?: number;
  product_link?: string;
  link?: string;
}

interface SerpApiShoppingResponse {
  shopping_results?: SerpApiShoppingItem[];
  error?: string;
}

interface StoreMatch {
  inStock: boolean;
  price: number | null;
  url?: string;
}

const SHOPPING_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const shoppingCache = new Map<
  string,
  { expiresAt: number; results: SerpApiShoppingItem[] }
>();

const openaiClient = config.openaiApiKey
  ? new OpenAI({ apiKey: config.openaiApiKey })
  : null;

function milesBetween(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRadians = (degrees: number) => degrees * (Math.PI / 180);
  const earthRadiusMiles = 3958.8;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(earthRadiusMiles * c * 10) / 10;
}

export function normalizeItemQuery(itemName: string): string {
  return itemName
    .toLowerCase()
    .replace(
      /\b(\d+\s*(oz|lb|lbs|g|kg|ml|l|ct|pk|pack|bunch|bag|can|cans|jar|jars|gal|gallon))\b/gi,
      "",
    )
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

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

function normalizeLinkKey(url?: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    const normalizedPath = parsed.pathname.replace(/\/+$/, "") || "/";
    return `${parsed.origin}${normalizedPath}${parsed.search}`.toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

export function deduplicateStoreResults(
  stores: StoreSearchResult[],
): StoreSearchResult[] {
  const byKey = new Map<string, StoreSearchResult>();

  for (const store of stores) {
    const linkKey = normalizeLinkKey(store.url);
    // Keep distinct product links from the same store; fall back to normalized store name when unlinked.
    const dedupeKey = linkKey
      ? `url:${linkKey}`
      : `store:${normalizeStoreName(store.storeName) || store.storeName.trim().toLowerCase()}`;

    const existing = byKey.get(dedupeKey);
    if (!existing || store.distanceMiles < existing.distanceMiles) {
      byKey.set(dedupeKey, store);
    }
  }

  return [...byKey.values()].sort((a, b) => a.distanceMiles - b.distanceMiles);
}

function parsePrice(item: SerpApiShoppingItem): number | null {
  if (
    typeof item.extracted_price === "number" &&
    Number.isFinite(item.extracted_price)
  ) {
    return item.extracted_price;
  }
  if (typeof item.price === "number" && Number.isFinite(item.price)) {
    return item.price;
  }
  if (typeof item.price === "string") {
    const cleaned = Number.parseFloat(item.price.replace(/[^0-9.]/g, ""));
    return Number.isFinite(cleaned) ? cleaned : null;
  }
  return null;
}

async function isGroceryListingWithOpenAI(
  requestedItem: string,
  listingTitle: string,
  listingSource: string,
): Promise<boolean> {
  if (!openaiClient || !listingTitle.trim()) {
    return true;
  }

  try {
    const completion = await openaiClient.chat.completions.create({
      model: config.model,
      temperature: 0,
      max_completion_tokens: 20,
      messages: [
        {
          role: "system",
          content:
            "You are a grocery shopping filter. Reply with only YES or NO. Reply YES if the product listing is a food, beverage, ingredient, or household grocery item matching the requested shopping item. Reply NO only if it is clearly a non-food item like a plush toy, figurine, toy, clothing, book, poster, or pet toy.",
        },
        {
          role: "user",
          content: `Requested item: "${requestedItem}"\nListing title: "${listingTitle}"\nStore/source: "${listingSource}"`,
        },
      ],
    });

    const rawContent = completion.choices[0]?.message?.content?.trim();
    if (!rawContent) {
      return true;
    }

    const answer = rawContent.toUpperCase();
    const allowed = !answer.startsWith("NO");
    if (!allowed) {
      console.log(
        `[OpenAI Guardrail] Rejected "${listingTitle}" (${listingSource}) for "${requestedItem}" -> "${rawContent}"`,
      );
    }
    return allowed;
  } catch (err) {
    console.error("[OpenAI Guardrail] Check failed, allowing listing:", err);
    return true;
  }
}

async function fetchShoppingResultsForStore(
  normalizedQuery: string,
  storeName: string,
  location: string,
): Promise<SerpApiShoppingItem[]> {
  const serpApiKey = config.serpApiKey;
  if (!serpApiKey) {
    return [];
  }

  const cleanStore = normalizeStoreName(storeName);
  const query = cleanStore ? `${normalizedQuery} ${cleanStore}` : normalizedQuery;
  const cacheKey = `${location.toLowerCase().trim()}::${query}`;
  const cached = shoppingCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.results;
  }

  const params = new URLSearchParams({
    engine: "google_shopping",
    q: query,
    location,
    api_key: serpApiKey,
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
  console.log(
    `[SerpApi] q="${query}" (${location}) -> ${results.length} results`,
    results.slice(0, 3).map((r) => ({
      title: r.title,
      source: r.source,
      price: r.price,
    })),
  );

  shoppingCache.set(cacheKey, {
    expiresAt: Date.now() + SHOPPING_CACHE_TTL_MS,
    results,
  });

  return results;
}

async function matchStoreListing(
  requestedItem: string,
  normalizedQuery: string,
  storeName: string,
  results: SerpApiShoppingItem[],
): Promise<StoreMatch> {
  const queryTokens = normalizedQuery.split(" ").filter((t) => t.length > 1);
  const normStore = normalizeStoreName(storeName);
  const storeTokens = normStore.split(" ").filter((t) => t.length > 2);

  if (!normStore || results.length === 0) {
    return { inStock: false, price: null };
  }

  for (const listing of results) {
    const title = (listing.title ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ");
    const source = normalizeStoreName(listing.source ?? "");

    if (!source) continue;

    const itemMatches =
      queryTokens.length === 0 ||
      queryTokens.every((token) => title.includes(token));

    const storeMatches =
      source.includes(normStore) ||
      normStore.includes(source) ||
      (storeTokens.length > 0 &&
        storeTokens.some((token) => source.includes(token)));

    if (itemMatches && storeMatches) {
      const isValidGrocery = await isGroceryListingWithOpenAI(
        requestedItem,
        listing.title ?? "",
        listing.source ?? storeName,
      );

      if (!isValidGrocery) {
        continue;
      }

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

export async function findNearbyStores(
  itemName: string,
  location: string,
  limit: number,
): Promise<StoreSearchResult[]> {
  const coordinates = await geocodeLocation(location);

  if (!coordinates) {
    return [];
  }

  const candidateCount = Math.min(Math.max(limit * 4, 10), 20);
  const stores = await getNearbyStores(
    coordinates.latitude,
    coordinates.longitude,
    candidateCount,
  );

  const candidateStores: StoreSearchResult[] = stores
    .map((store) => ({
      storeName: store.storeName,
      distanceMiles: milesBetween(
        coordinates.latitude,
        coordinates.longitude,
        store.latitude,
        store.longitude,
      ),
      price: null,
      address: store.address,
      inStock: false,
      url: store.url,
    }))
    .sort((a, b) => a.distanceMiles - b.distanceMiles);

  const normalizedQuery = normalizeItemQuery(itemName);
  const hasSerpApiKey = Boolean(config.serpApiKey);

  if (!normalizedQuery || candidateStores.length === 0) {
    return [];
  }

  const enriched = await Promise.all(
    candidateStores.map(async (store) => {
      if (!hasSerpApiKey) {
        return store;
      }

      try {
        const listings = await fetchShoppingResultsForStore(
          normalizedQuery,
          store.storeName,
          location,
        );
        const match = await matchStoreListing(
          itemName,
          normalizedQuery,
          store.storeName,
          listings,
        );

        return {
          ...store,
          inStock: match.inStock,
          price: match.price ?? store.price,
          url: match.url ?? store.url,
        };
      } catch (err) {
        console.error(`SerpApi lookup warning for ${store.storeName}:`, err);
        return store;
      }
    }),
  );

  const sortedEnriched = [...enriched].sort(
    (a, b) => a.distanceMiles - b.distanceMiles,
  );

  if (hasSerpApiKey) {
    const inStockStores = sortedEnriched.filter((store) => store.inStock);
    return deduplicateStoreResults(inStockStores).slice(0, limit);
  }

  return deduplicateStoreResults(sortedEnriched).slice(0, limit);
}

async function getNearbyStores(
  latitude: number,
  longitude: number,
  maxResults: number,
): Promise<NearbyStore[]> {
  if (!config.googleMapsApiKey) {
    throw new Error("Missing GOOGLE_MAPS_API_KEY");
  }

  const response = await fetch(
    "https://places.googleapis.com/v1/places:searchNearby",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": config.googleMapsApiKey,
        "X-Goog-FieldMask":
          "places.displayName,places.formattedAddress,places.location",
      },
      body: JSON.stringify({
        includedPrimaryTypes: [
          "supermarket",
          "grocery_store",
          "warehouse_store",
          "asian_grocery_store",
          "butcher_shop",
          "bakery",
          "market",
        ],
        maxResultCount: Math.min(Math.max(maxResults, 1), 20),
        locationRestriction: {
          circle: {
            center: { latitude, longitude },
            radius: 20000,
          },
        },
      }),
    },
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(
      `Google Places request failed (${response.status}): ${errText}`,
    );
  }

  const data = (await response.json()) as PlacesNewResponse;

  return (data.places ?? []).flatMap((place) => {
    const storeName = place.displayName?.text;
    const loc = place.location;
    if (!storeName || !loc) return [];

    return [
      {
        storeName,
        latitude: loc.latitude,
        longitude: loc.longitude,
        address: place.formattedAddress,
        url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          storeName,
        )}`,
      },
    ];
  });
}
