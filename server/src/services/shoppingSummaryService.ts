import OpenAI from "openai";
import { config } from "../config.js";
import type { StoreSearchResult } from "./storeSearchService.js";

export interface ItemPriceSummaryInput {
  itemName: string;
  stores: StoreSearchResult[];
}

export async function generateShoppingSummary(
  location: string,
  items: ItemPriceSummaryInput[],
): Promise<string | null> {
  if (!config.openaiApiKey || items.length === 0) {
    return null;
  }

  const openai = new OpenAI({ apiKey: config.openaiApiKey });

  const compactPayload = items.map((entry) => ({
    item: entry.itemName,
    matchedStores: entry.stores.map((s) => ({
      store: s.storeName,
      distanceMiles: s.distanceMiles,
      price: s.price,
    })),
  }));

  const response = await openai.chat.completions.create({
    model: config.model,
    temperature: 0.2,
    max_tokens: 480,
    messages: [
      {
        role: "system",
        content:
          "You are a concise grocery shopping assistant. For each shopping item in the results, identify both the cheapest store (lowest price, including price and distance in miles) and the closest store (smallest distanceMiles, including distance and price if available). If two stores tie or a store has no price, note that clearly. Never invent prices, distances, or stores not in the data.",
      },
      {
        role: "user",
        content: `Location: ${location}\nResults: ${JSON.stringify(compactPayload)}`,
      },
    ],
  });

  return response.choices[0]?.message?.content?.trim() ?? null;
}