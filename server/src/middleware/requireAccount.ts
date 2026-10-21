import type { RequestHandler } from "express";
import { HttpError } from "../lib/httpError.js";

export const requireAccount: RequestHandler = (req, _res, next) => {
  if (!req.userId) return next(new HttpError(401, "Sign in to access your synced account."));
  next();
};
