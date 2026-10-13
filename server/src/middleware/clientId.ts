import type { RequestHandler } from "express";
import { HttpError } from "../lib/httpError.js";

const CLIENT_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

export const requireClientId: RequestHandler = (req, _res, next) => {
  const id = req.header("x-client-id");
  if (!id || !CLIENT_ID_RE.test(id)) {
    return next(new HttpError(400, "Missing or invalid X-Client-Id header"));
  }
  req.clientId = id;
  next();
};
