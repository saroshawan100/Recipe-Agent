import type { RequestHandler } from "express";
import { isDbConnected } from "../db.js";
import { HttpError } from "../lib/httpError.js";

export const requireDb: RequestHandler = (_req, _res, next) => {
  if (!isDbConnected()) {
    return next(new HttpError(503, "Database is not connected yet. Check MONGODB_URI in .env and try again."));
  }
  next();
};
