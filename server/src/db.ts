import mongoose from "mongoose";
import { config } from "./config.js";

mongoose.set("strictQuery", true);
// Fail fast instead of buffering queries for 10s when the database is unreachable.
mongoose.set("bufferCommands", false);

const RETRY_MS = 10_000;

function describeTarget(uri: string): string {
  try {
    const url = new URL(uri.replace(/^mongodb(\+srv)?:\/\//, "http://"));
    return `${url.hostname}${url.pathname}`;
  } catch {
    return "configured database";
  }
}

export function isDbConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

export async function connectDb(): Promise<void> {
  const target = describeTarget(config.mongoUri);
  try {
    await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 8000 });
    console.log(`[db] connected to ${target}`);
  } catch (err) {
    console.error(`[db] could not connect to ${target}: ${(err as Error).message}`);
    if (config.usingDefaultMongo) {
      console.error("[db] MONGODB_URI is not set in .env, so a local MongoDB at 127.0.0.1:27017 was tried.");
    } else {
      console.error("[db] Check the connection string and that your IP is allowed under Atlas > Network Access.");
    }
    console.error(`[db] retrying in ${RETRY_MS / 1000}s...`);
    setTimeout(() => void connectDb(), RETRY_MS);
  }
}
