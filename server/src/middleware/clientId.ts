import type { RequestHandler } from "express";
import { AccountSession } from "../models/AccountSession.js";
import { config } from "../config.js";
import { hashSessionToken, readSessionToken } from "../services/accountAuth.js";
import { HttpError } from "../lib/httpError.js";

const CLIENT_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

export const requireClientId: RequestHandler = async (req, _res, next) => {
  try {
    const token = config.storage === "mongo" ? readSessionToken(req) : null;
    if (token) {
      const session = await AccountSession.findOne({ tokenHash: hashSessionToken(token), expiresAt: { $gt: new Date() } }).lean();
      if (session) {
        req.userId = session.accountId;
        req.clientId = session.accountId;
        return next();
      }
    }

    const id = req.header("x-client-id");
    if (!id || !CLIENT_ID_RE.test(id)) return next(new HttpError(400, "Missing or invalid X-Client-Id header"));
    req.clientId = id;
    next();
  } catch (err) {
    next(err);
  }
};
