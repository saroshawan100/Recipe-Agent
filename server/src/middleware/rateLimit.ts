import rateLimit from "express-rate-limit";

export const aiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => req.clientId || req.ip || "anonymous",
  message: { error: "Whoa, that's a lot of requests. Give the chef a minute and try again." },
});
