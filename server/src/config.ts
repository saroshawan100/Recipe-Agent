import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(here, "../..");
const SERVER_DIR = path.resolve(here, "..");

dotenv.config({ path: path.join(ROOT_DIR, ".env") });

const DEFAULT_MONGO_URI = "mongodb://127.0.0.1:27017/pantry-chef";

export type StorageMode = "browser" | "mongo";

function resolveStorage(): StorageMode {
  const explicit = process.env.STORAGE?.trim().toLowerCase();
  if (explicit === "browser" || explicit === "mongo") return explicit;
  return process.env.MONGODB_URI ? "mongo" : "browser";
}

export const config = {
  storage: resolveStorage(),
  port: Number(process.env.PORT ?? 5000),
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
  imageModel: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1-mini",
  imageQuality: (process.env.OPENAI_IMAGE_QUALITY || "medium") as "low" | "medium" | "high",
  mongoUri: process.env.MONGODB_URI || DEFAULT_MONGO_URI,
  usingDefaultMongo: !process.env.MONGODB_URI,
  generatedDir: path.join(SERVER_DIR, "public", "generated"),
  clientDistDir: path.join(ROOT_DIR, "client", "dist"),
  isProduction: process.env.NODE_ENV === "production",
};

if (!config.openaiApiKey) {
  console.warn("[config] OPENAI_API_KEY is not set. AI features will fail until it is added to .env");
}
