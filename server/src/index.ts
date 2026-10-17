import fs from "node:fs";
import path from "node:path";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { config } from "./config.js";
import { connectDb, isDbConnected } from "./db.js";
import { HttpError } from "./lib/httpError.js";
import { requireClientId } from "./middleware/clientId.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { requireDb } from "./middleware/requireDb.js";
import { aiRouter } from "./routes/ai.js";
import { chatRouter } from "./routes/chat.js";
import { cookRouter } from "./routes/cook.js";
import { pantryRouter } from "./routes/pantry.js";
import { recipesRouter } from "./routes/recipes.js";
import { savedRouter } from "./routes/saved.js";
import { shoppingListRouter } from "./routes/shoppingList.js";

const app = express();
app.set("trust proxy", 1);

// The SPA loads Google Fonts, TheMealDB ingredient images and an inline theme script, so the default CSP is disabled.
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: config.isProduction ? false : true }));
app.use(express.json({ limit: "5mb" }));

fs.mkdirSync(config.generatedDir, { recursive: true });
app.use("/generated", express.static(config.generatedDir, { maxAge: "30d", immutable: true }));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    storage: config.storage,
    db: config.storage === "browser" ? "not used" : isDbConnected() ? "connected" : "disconnected",
    openai: config.openaiApiKey ? "configured" : "missing",
    model: config.model,
  });
});

const api = express.Router();
api.use(requireClientId);
api.use("/ai", aiRouter);
if (config.storage === "mongo") {
  const data = express.Router();
  data.use(requireDb);
  data.use("/recipes", recipesRouter);
  data.use("/cook", cookRouter);
  data.use("/chat", chatRouter);
  data.use("/pantry", pantryRouter);
  data.use("/saved", savedRouter);
  data.use("/shopping-list", shoppingListRouter);
  api.use(data);
}
api.use((_req, _res, next) => next(new HttpError(404, "Unknown API route")));
app.use("/api", api);

if (fs.existsSync(path.join(config.clientDistDir, "index.html"))) {
  app.use(express.static(config.clientDistDir));
  app.get(/^(?!\/api|\/generated).*/, (_req, res) => res.sendFile(path.join(config.clientDistDir, "index.html")));
}

app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`[server] Pantry Chef API listening on http://localhost:${config.port} (model: ${config.model})`);
  console.log(
    config.storage === "browser"
      ? "[server] storage: browser (data is saved in each user's browser; MongoDB is not used)"
      : "[server] storage: MongoDB",
  );
});

if (config.storage === "mongo") void connectDb();
