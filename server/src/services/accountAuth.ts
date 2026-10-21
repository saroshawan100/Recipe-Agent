import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { Request, Response } from "express";
import { AccountSession } from "../models/AccountSession.js";
import { config } from "../config.js";

const scrypt = promisify(scryptCallback);
export const SESSION_COOKIE = "pantry_chef_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return { salt, hash: derived.toString("hex") };
}

export async function verifyPassword(password: string, salt: string, expectedHex: string) {
  const actual = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function readSessionToken(req: Request) {
  const cookies = req.headers.cookie?.split(";") ?? [];
  const entry = cookies.map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  if (!entry) return null;
  try {
    return decodeURIComponent(entry.slice(SESSION_COOKIE.length + 1));
  } catch {
    return null;
  }
}

export const hashSessionToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function issueSession(accountId: string, res: Response) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await AccountSession.create({ tokenHash: hashSessionToken(token), accountId, expiresAt });
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function revokeSession(req: Request, res: Response) {
  const token = readSessionToken(req);
  if (token) await AccountSession.deleteOne({ tokenHash: hashSessionToken(token) });
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, secure: config.isProduction, sameSite: "lax", path: "/" });
}
