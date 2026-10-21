import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { Account } from "../models/Account.js";
import { AccountSession } from "../models/AccountSession.js";
import { Pantry } from "../models/Pantry.js";
import { Preferences } from "../schemas/recipe.js";
import { hashPassword, hashSessionToken, issueSession, readSessionToken, revokeSession, verifyPassword } from "../services/accountAuth.js";
import { requireAccount } from "../middleware/requireAccount.js";
import { requireDb } from "../middleware/requireDb.js";
import { HttpError } from "../lib/httpError.js";

export const accountRouter = Router();
const authLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 10, standardHeaders: "draft-7", legacyHeaders: false });
const Credentials = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(12, "Password must be at least 12 characters.").max(128),
});
const PantryBody = z.object({
  items: z.array(z.object({ name: z.string().trim().min(1).max(80), category: z.string().max(40).optional(), quantity: z.string().max(40).optional(), useSoon: z.boolean().optional() })).max(200),
  staples: z.array(z.string().trim().min(1).max(60)).max(40),
});
const RegisterBody = Credentials.extend({ preferences: Preferences.default({}), pantry: PantryBody.default({ items: [], staples: [] }) });

function publicAccount(account: { id: string; email: string; preferences?: unknown }) {
  return { id: account.id, email: account.email, preferences: Preferences.parse(account.preferences ?? {}) };
}

async function profile(accountId: string) {
  const account = await Account.findById(accountId).lean();
  if (!account) throw new HttpError(401, "Account session has expired. Sign in again.");
  const pantry = await Pantry.findOne({ clientId: accountId }).lean();
  return {
    user: publicAccount({ id: String(account._id), email: account.email, preferences: account.preferences }),
    pantry: { items: pantry?.items ?? [], staples: pantry?.staples ?? [] },
  };
}

accountRouter.post("/register", requireDb, authLimiter, async (req, res) => {
  const body = RegisterBody.parse(req.body);
  const exists = await Account.exists({ email: body.email });
  if (exists) throw new HttpError(409, "An account with that email already exists. Sign in instead.");

  const password = await hashPassword(body.password);
  let account;
  try {
    account = await Account.create({ email: body.email, passwordSalt: password.salt, passwordHash: password.hash, preferences: body.preferences });
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === 11000) {
      throw new HttpError(409, "An account with that email already exists. Sign in instead.");
    }
    throw err;
  }

  await Pantry.findOneAndUpdate(
    { clientId: String(account._id) },
    { $set: { items: body.pantry.items, staples: body.pantry.staples } },
    { upsert: true, new: true },
  );
  await issueSession(String(account._id), res);
  res.status(201).json(await profile(String(account._id)));
});

accountRouter.post("/login", requireDb, authLimiter, async (req, res) => {
  const body = Credentials.parse(req.body);
  const account = await Account.findOne({ email: body.email }).select("+passwordSalt +passwordHash");
  if (!account || !(await verifyPassword(body.password, account.passwordSalt, account.passwordHash))) {
    throw new HttpError(401, "Email or password is incorrect.");
  }
  await issueSession(String(account._id), res);
  res.json(await profile(String(account._id)));
});

accountRouter.post("/logout", requireDb, async (req, res) => {
  await revokeSession(req, res);
  res.json({ ok: true });
});

accountRouter.get("/me", requireDb, requireAccount, async (req, res) => {
  const token = readSessionToken(req);
  if (token) {
    const session = await AccountSession.findOne({ tokenHash: hashSessionToken(token) });
    if (session) {
      session.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await session.save();
    }
  }
  res.json(await profile(req.userId!));
});

accountRouter.put("/preferences", requireDb, requireAccount, async (req, res) => {
  const preferences = Preferences.parse(req.body?.preferences);
  const account = await Account.findByIdAndUpdate(req.userId, { $set: { preferences } }, { new: true }).lean();
  if (!account) throw new HttpError(401, "Account session has expired. Sign in again.");
  res.json({ preferences: Preferences.parse(account.preferences) });
});
