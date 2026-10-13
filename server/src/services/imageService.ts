import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";
import { dedupe } from "../lib/dedupe.js";
import { HttpError } from "../lib/httpError.js";
import { Recipe, type RecipeDocument } from "../models/Recipe.js";
import type { RecipeCard } from "../schemas/recipe.js";
import { openai } from "./openaiService.js";

export type ImageCard = Pick<RecipeCard, "title" | "description" | "cuisine">;

/** Generates a dish photo, writes it to `public/generated/{fileId}.webp` and returns its public URL. */
export async function generateRecipeImage({ title, description, cuisine }: ImageCard, fileId: string): Promise<string> {
  const prompt = `Professional food photography of ${title}, a ${cuisine} dish: ${description}
Beautifully plated and ready to eat, styled on a rustic wooden table with soft natural window light, shallow depth of field, rich appetizing colors, three-quarter angle. No text, no labels, no people, no hands.`;

  const result = await openai.images.generate({
    model: config.imageModel,
    prompt,
    n: 1,
    size: "1536x1024",
    quality: config.imageQuality,
    output_format: "webp",
    output_compression: 82,
  });

  const b64 = result.data?.[0]?.b64_json;
  if (!b64) throw new HttpError(502, "Image generation returned no image");

  await fs.mkdir(config.generatedDir, { recursive: true });
  const fileName = `${fileId}.webp`;
  await fs.writeFile(path.join(config.generatedDir, fileName), Buffer.from(b64, "base64"));
  return `/generated/${fileName}`;
}

export async function getOrCreateRecipeImage(recipe: RecipeDocument): Promise<string> {
  if (recipe.imageUrl) return recipe.imageUrl;
  const id = recipe.id as string;

  return dedupe(`image:${id}`, async () => {
    const url = await generateRecipeImage(recipe.card, id);
    await Recipe.updateOne({ _id: id }, { $set: { imageUrl: url } });
    return url;
  });
}
