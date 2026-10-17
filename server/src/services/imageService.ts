import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { config } from "../config.js";
import { dedupe } from "../lib/dedupe.js";
import { HttpError } from "../lib/httpError.js";
import { Recipe, type RecipeDocument } from "../models/Recipe.js";
import type { RecipeCard } from "../schemas/recipe.js";
import { openai } from "./openaiService.js";

export type ImageCard = Pick<RecipeCard, "title" | "description" | "cuisine">;

export interface StepReference {
  title: string;
  instruction: string;
}

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

export async function getOrCreateStepReferenceImage(
  recipeKey: string,
  stepIndex: number,
  recipeTitle: string,
  step: StepReference,
): Promise<string> {
  const id = createHash("sha256").update(`${recipeKey}:step:${stepIndex}`).digest("hex");
  const fileName = `${id}.webp`;
  const filePath = path.join(config.generatedDir, fileName);
  try {
    await fs.access(filePath);
    return `/generated/${fileName}`;
  } catch {
    // Generate this reference on first request and reuse it on later requests.
  }

  return dedupe(`step-image:${id}`, async () => {
    const prompt = `Create a clear instructional food photograph showing the expected appearance of the CURRENT cooking step, not a finished-dish hero photo.
Recipe: ${recipeTitle}
Current step: ${step.title}
Instructions: ${step.instruction}
Show a realistic close-up of the food and cookware at the point described by this step, with the relevant color, texture, cut size, browning, liquid level, or other visible cue made easy to judge. Keep the scene simple and plausible for a home kitchen. No text, labels, diagrams, collage, people, hands, or decorative plating. This is an illustrative reference; prioritize matching the written step over adding ingredients or actions not mentioned.`;

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
    if (!b64) throw new HttpError(502, "Image generation returned no reference image");
    await fs.mkdir(config.generatedDir, { recursive: true });
    await fs.writeFile(filePath, Buffer.from(b64, "base64"));
    return `/generated/${fileName}`;
  });
}
