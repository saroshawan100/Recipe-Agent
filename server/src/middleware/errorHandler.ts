import type { ErrorRequestHandler } from "express";
import mongoose from "mongoose";
import OpenAI from "openai";
import { ZodError } from "zod";
import { HttpError } from "../lib/httpError.js";

export function toHttpError(err: unknown): HttpError {
  if (err instanceof HttpError) return err;

  if (err instanceof ZodError) {
    const issue = err.issues[0];
    const where = issue?.path.length ? `${issue.path.join(".")}: ` : "";
    return new HttpError(400, `Invalid request. ${where}${issue?.message ?? ""}`.trim());
  }

  if (err instanceof OpenAI.APIError) {
    if (err.status === 401) return new HttpError(500, "The OpenAI API key is missing or invalid. Check OPENAI_API_KEY in .env.");
    if (err.status === 429) return new HttpError(429, "OpenAI is rate limiting us or the quota is used up. Try again shortly.");
    if (err.status === 403) return new HttpError(502, `OpenAI refused the request: ${err.message}`);
    return new HttpError(502, "The AI chef had trouble responding. Please try again.");
  }

  if (err instanceof mongoose.Error.CastError) return new HttpError(404, "Not found");
  if (err instanceof mongoose.Error.ValidationError) return new HttpError(400, err.message);
  if (err instanceof Error && /Mongo|mongoose/i.test(err.name)) {
    return new HttpError(503, "Database is unavailable right now. Please try again.");
  }

  if (err && typeof err === "object" && "type" in err && (err as { type: string }).type === "entity.parse.failed") {
    return new HttpError(400, "Malformed JSON body");
  }

  return new HttpError(500, "Something went wrong in the kitchen. Please try again.");
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const httpErr = toHttpError(err);
  if (httpErr.status >= 500) {
    console.error(`[error] ${req.method} ${req.originalUrl}:`, err);
  }
  if (res.headersSent) {
    res.end();
    return;
  }
  res.status(httpErr.status).json({ error: httpErr.message });
};
