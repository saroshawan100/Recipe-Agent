import { Router } from "express";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { streamCompletion } from "../lib/sse.js";
import { aiLimiter } from "../middleware/rateLimit.js";
import { Recipe } from "../models/Recipe.js";
import { ChatMessage } from "../schemas/coaching.js";
import { chatSystemPrompt } from "../services/prompts.js";

export const chatRouter = Router();

const ChatRequest = z.object({
  messages: z.array(ChatMessage).min(1).max(30),
  context: z
    .object({
      pantry: z.array(z.string().max(80)).max(100).default([]),
      recipeId: z.string().nullable().optional(),
    })
    .default({}),
});

chatRouter.post("/", aiLimiter, async (req, res) => {
  const { messages, context } = ChatRequest.parse(req.body);

  let recipe = null;
  if (context.recipeId && isValidObjectId(context.recipeId)) {
    const doc = await Recipe.findOne({ _id: context.recipeId, clientId: req.clientId }).catch(() => null);
    if (doc) recipe = { title: doc.card.title, details: doc.details };
  }

  await streamCompletion(res, [{ role: "system", content: chatSystemPrompt(context.pantry, recipe) }, ...messages]);
});
