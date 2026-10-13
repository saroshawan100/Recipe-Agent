import { Router } from "express";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { dedupe } from "../lib/dedupe.js";
import { HttpError, notFound } from "../lib/httpError.js";
import { findRecipe, requireDetails } from "../lib/recipes.js";
import { streamCompletion } from "../lib/sse.js";
import { aiLimiter } from "../middleware/rateLimit.js";
import { CookSession, toSessionDto } from "../models/CookSession.js";
import { Recipe } from "../models/Recipe.js";
import { AskRequest, CheckinRequest, SessionPatch, type CoachingScript } from "../schemas/coaching.js";
import { generateCheckin, generateCoachingScript } from "../services/coachService.js";
import { askSystemPrompt } from "../services/prompts.js";

export const cookRouter = Router();

cookRouter.post("/sessions", async (req, res) => {
  const { recipeId } = z.object({ recipeId: z.string() }).parse(req.body);
  await findRecipe(req.clientId, recipeId);
  let session = await CookSession.findOne({ clientId: req.clientId, recipeId, status: "active" }).sort({ updatedAt: -1 });
  if (!session) {
    session = await CookSession.create({ clientId: req.clientId, recipeId });
  }
  res.json(toSessionDto(session));
});

cookRouter.post("/sessions/:id/restart", async (req, res) => {
  if (!isValidObjectId(req.params.id)) throw notFound("Session");
  const session = await CookSession.findOneAndUpdate(
    { _id: req.params.id, clientId: req.clientId },
    { $set: { currentStep: 0, stepElapsedSeconds: 0, completedSteps: [], status: "active", startedAt: new Date(), finishedAt: null } },
    { new: true },
  );
  if (!session) throw notFound("Session");
  res.json(toSessionDto(session));
});

cookRouter.patch("/sessions/:id", async (req, res) => {
  if (!isValidObjectId(req.params.id)) throw notFound("Session");
  const patch = SessionPatch.parse(req.body);
  const update: Record<string, unknown> = { ...patch };
  if (patch.status === "completed") update.finishedAt = new Date();
  const session = await CookSession.findOneAndUpdate({ _id: req.params.id, clientId: req.clientId }, { $set: update }, { new: true });
  if (!session) throw notFound("Session");
  res.json(toSessionDto(session));
});

cookRouter.post("/:recipeId/steps/:index/coach", aiLimiter, async (req, res) => {
  const recipe = await findRecipe(req.clientId, String(req.params.recipeId));
  const details = await requireDetails(recipe);
  const index = Number(req.params.index);
  if (!Number.isInteger(index) || index < 0 || index >= details.steps.length) {
    throw new HttpError(400, "That step doesn't exist in this recipe");
  }

  const cached = recipe.coaching?.[String(index)];
  if (cached) return void res.json(cached);

  const script: CoachingScript = await dedupe(`coach:${recipe.id}:${index}`, async () => {
    const generated = await generateCoachingScript(recipe.card.title, details, index);
    await Recipe.updateOne({ _id: recipe._id }, { $set: { [`coaching.${index}`]: generated } });
    return generated;
  });
  res.json(script);
});

cookRouter.post("/checkin", aiLimiter, async (req, res) => {
  const input = CheckinRequest.parse(req.body);
  const recipe = await findRecipe(req.clientId, input.recipeId);
  const details = await requireDetails(recipe);
  if (input.stepIndex >= details.steps.length) throw new HttpError(400, "That step doesn't exist in this recipe");

  const cueText = input.cueId
    ? recipe.coaching?.[String(input.stepIndex)]?.cues.find((c) => c.id === input.cueId)?.say
    : undefined;
  const result = await generateCheckin(recipe.card.title, details, input.stepIndex, { ...input, cueText });

  if (input.sessionId && isValidObjectId(input.sessionId)) {
    await CookSession.updateOne(
      { _id: input.sessionId, clientId: req.clientId },
      {
        $push: {
          checkins: {
            stepIndex: input.stepIndex,
            cueId: input.cueId,
            answer: input.answer,
            issue: input.issue,
            note: input.note,
            response: result.message,
            at: new Date(),
          },
        },
      },
    );
  }
  res.json(result);
});

cookRouter.post("/ask", aiLimiter, async (req, res) => {
  const input = AskRequest.parse(req.body);
  const recipe = await findRecipe(req.clientId, input.recipeId);
  const details = await requireDetails(recipe);
  const stepIndex = Math.min(input.stepIndex, details.steps.length - 1);
  await streamCompletion(res, [
    { role: "system", content: askSystemPrompt(recipe.card.title, details, stepIndex, input.elapsedSeconds) },
    ...input.messages,
  ]);
});
