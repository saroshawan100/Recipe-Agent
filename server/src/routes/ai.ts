import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { dedupe } from "../lib/dedupe.js";
import { HttpError } from "../lib/httpError.js";
import { streamCompletion } from "../lib/sse.js";
import { toChatCompletionMessages } from "../lib/chatMessages.js";
import { aiLimiter } from "../middleware/rateLimit.js";
import { AskMessages, AskRequest, ChatMessage, CheckinRequest } from "../schemas/coaching.js";
import { RecipeCard, RecipeDetails, ScanRequest, SuggestRequest } from "../schemas/recipe.js";
import { generateCheckin, generateCoachingScript } from "../services/coachService.js";
import { generateRecipeImage, getOrCreateStepReferenceImage } from "../services/imageService.js";
import { generateDetails, scanPantryPhoto, suggestRecipes } from "../services/openaiService.js";
import { askSystemPrompt, chatSystemPrompt } from "../services/prompts.js";

/**
 * Stateless AI endpoints used in browser-storage mode: the client sends the recipe
 * context each call needs and keeps the results in its own storage. `/scan` is also used in MongoDB mode.
 */
export const aiRouter = Router();
aiRouter.use(aiLimiter);

const RecipeRef = z.object({ title: z.string().min(1).max(200), details: RecipeDetails });

function checkStep(details: RecipeDetails, stepIndex: number) {
  if (stepIndex >= details.steps.length) throw new HttpError(400, "That step doesn't exist in this recipe");
}

aiRouter.post("/suggest", async (req, res) => {
  res.json(await suggestRecipes(SuggestRequest.parse(req.body)));
});

aiRouter.post("/scan", async (req, res) => {
  const { image, knownNames } = ScanRequest.parse(req.body);
  res.json(await scanPantryPhoto(image, knownNames));
});

aiRouter.post("/details", async (req, res) => {
  const { card, context } = z.object({ card: RecipeCard, context: SuggestRequest }).parse(req.body);
  res.json(await generateDetails(card, context));
});

aiRouter.post("/image", async (req, res) => {
  const { card, key } = z
    .object({
      card: RecipeCard.pick({ title: true, description: true, cuisine: true }),
      key: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/).optional(),
    })
    .parse(req.body);
  const imageUrl = await dedupe(`image:${key ?? randomUUID()}`, () => generateRecipeImage(card, randomUUID()));
  res.json({ imageUrl });
});

aiRouter.post("/step-image", async (req, res) => {
  const { key, title, stepIndex, step } = z
    .object({
      key: z.string().regex(/^[A-Za-z0-9_-]{8,100}$/),
      title: z.string().min(1).max(200),
      stepIndex: z.number().int().min(0).max(99),
      step: z.object({ title: z.string().min(1).max(200), instruction: z.string().min(1).max(2000) }),
    })
    .parse(req.body);
  const imageUrl = await getOrCreateStepReferenceImage(key, stepIndex, title, step);
  res.json({ imageUrl });
});

aiRouter.post("/coach", async (req, res) => {
  const { title, details, stepIndex } = RecipeRef.extend({ stepIndex: z.number().int().min(0) }).parse(req.body);
  checkStep(details, stepIndex);
  res.json(await generateCoachingScript(title, details, stepIndex));
});

aiRouter.post("/checkin", async (req, res) => {
  const { title, details, stepIndex, ...input } = CheckinRequest.omit({ recipeId: true, sessionId: true, cueId: true })
    .extend({ ...RecipeRef.shape, cueText: z.string().max(300).optional() })
    .parse(req.body);
  checkStep(details, stepIndex);
  res.json(await generateCheckin(title, details, stepIndex, input));
});

aiRouter.post("/ask", async (req, res) => {
  const { title, details, stepIndex, elapsedSeconds, messages } = z.object({
    ...RecipeRef.shape,
    stepIndex: z.number().int().min(0),
    elapsedSeconds: z.number().min(0).max(86_400).default(0),
    messages: AskMessages,
  })
    .parse(req.body);
  checkStep(details, stepIndex);
  await streamCompletion(res, [
    { role: "system", content: askSystemPrompt(title, details, stepIndex, elapsedSeconds) },
    ...toChatCompletionMessages(messages),
  ]);
});

aiRouter.post("/chat", async (req, res) => {
  const { messages, pantry, recipe } = z
    .object({
      messages: z.array(ChatMessage).min(1).max(30),
      pantry: z.array(z.string().max(80)).max(100).default([]),
      recipe: z.object({ title: z.string().max(200), details: RecipeDetails.nullable() }).nullable().default(null),
    })
    .parse(req.body);
  await streamCompletion(res, [{ role: "system", content: chatSystemPrompt(pantry, recipe) }, ...messages]);
});
