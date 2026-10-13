import { ApiError } from "../client";
import { localBackend } from "./local";
import { remoteBackend } from "./remote";
import type { Backend, StorageMode } from "./types";

export type * from "./types";

let backendPromise: Promise<Backend> | null = null;

async function resolveBackend(): Promise<Backend> {
  let storage: StorageMode | undefined;
  try {
    const res = await fetch("/api/health");
    if (res.ok) storage = ((await res.json()) as { storage?: StorageMode }).storage;
  } catch {
    /* handled below */
  }
  if (!storage) throw new ApiError(0, "Can't reach the server. Is the backend running?");
  return storage === "mongo" ? remoteBackend : localBackend;
}

/** The server decides where data lives (`/api/health` reports `storage`); resolved once per page load. */
export function getBackend(): Promise<Backend> {
  backendPromise ??= resolveBackend().catch((err) => {
    backendPromise = null;
    throw err;
  });
  return backendPromise;
}
